"""Merge a legacy ImmBiz SQLite database into the configured Supabase database.

The migration preserves richer Supabase rows, maps logical duplicates by their
business keys, remaps relationships, and imports only missing local records.
It runs in a single target transaction and rolls back unless --apply is passed.
"""

from __future__ import annotations

import argparse
import uuid
from collections import Counter
from pathlib import Path
from typing import Any, Iterable, Mapping

from sqlalchemy import MetaData, Table, and_, create_engine, func, select, text
from sqlalchemy.engine import Connection, Engine, RowMapping

from app.core.config import settings


DEFAULT_SOURCE = (
    Path.home() / "Library" / "Application Support" / "ImmBizBooks" / "immbiz.db"
)


def _key(value: Any) -> str:
    return str(value) if value is not None else ""


def _display_name(value: Any) -> str:
    data = value if isinstance(value, dict) else {}
    return str(
        data.get("display_name")
        or data.get("company_name")
        or data.get("first_name")
        or ""
    ).strip()


class Merge:
    def __init__(self, source_path: Path, target_url: str, company_name: str):
        self.source_engine = create_engine(f"sqlite:///{source_path}")
        self.target_engine = create_engine(target_url, pool_pre_ping=True)
        self.source_metadata = MetaData()
        self.target_metadata = MetaData(schema="master")
        self.source_metadata.reflect(bind=self.source_engine)
        self.target_metadata.reflect(bind=self.target_engine, schema="master")
        self.company_name = company_name
        self.maps: dict[str, dict[str, Any]] = {}
        self.stats: Counter[str] = Counter()
        self.source: Connection
        self.target: Connection
        self.company_id: Any = None

    def table(self, name: str, target: bool = False) -> Table:
        metadata = self.target_metadata if target else self.source_metadata
        key = f"master.{name}" if target else name
        return metadata.tables[key]

    def source_rows(self, name: str) -> list[RowMapping]:
        table = self.table(name)
        return list(self.source.execute(select(table)).mappings())

    def remember(self, table: str, source_id: Any, target_id: Any) -> None:
        self.maps.setdefault(table, {})[_key(source_id)] = target_id

    def mapped(self, table: str, source_id: Any) -> Any:
        if source_id is None:
            return None
        return self.maps[table][_key(source_id)]

    def convert(self, column: Any, value: Any) -> Any:
        if value is None:
            return None
        try:
            python_type = column.type.python_type
        except (AttributeError, NotImplementedError):
            return value
        if python_type is uuid.UUID and not isinstance(value, uuid.UUID):
            return uuid.UUID(str(value))
        return value

    def common_data(self, name: str, row: Mapping[str, Any]) -> dict[str, Any]:
        target = self.table(name, target=True)
        return {
            column.name: self.convert(column, row[column.name])
            for column in target.columns
            if column.name in row
        }

    def allocate_id(self, name: str, source_id: Any) -> Any:
        table = self.table(name, target=True)
        column = table.c.id
        candidate = self.convert(column, source_id)
        exists = self.target.execute(
            select(column).where(column == candidate)
        ).scalar_one_or_none()
        if exists is None:
            return candidate
        try:
            python_type = column.type.python_type
        except (AttributeError, NotImplementedError):
            python_type = str
        if python_type is uuid.UUID:
            return uuid.uuid4()
        if python_type is int:
            maximum = self.target.execute(select(func.max(column))).scalar() or 0
            return int(maximum) + 1
        raise RuntimeError(f"Cannot allocate a replacement ID for {name}")

    def insert(self, name: str, data: dict[str, Any]) -> Any:
        table = self.table(name, target=True)
        converted = {
            key: self.convert(table.c[key], value)
            for key, value in data.items()
            if key in table.c
        }
        self.target.execute(table.insert().values(**converted))
        self.stats[f"{name}.inserted"] += 1
        return converted.get("id")

    def existing_id(self, name: str, *conditions: Any) -> Any:
        table = self.table(name, target=True)
        return self.target.execute(
            select(table.c.id).where(and_(*conditions)).limit(1)
        ).scalar_one_or_none()

    def migrate_natural(
        self,
        name: str,
        key_columns: Iterable[str],
        overrides: Any = None,
    ) -> None:
        target = self.table(name, target=True)
        for row in self.source_rows(name):
            conditions = [
                target.c[column] == self.convert(target.c[column], row[column])
                for column in key_columns
            ]
            target_id = self.existing_id(name, *conditions)
            if target_id is None:
                data = self.common_data(name, row)
                data["id"] = self.allocate_id(name, row["id"])
                if overrides:
                    data.update(overrides(row))
                target_id = self.insert(name, data)
            else:
                self.stats[f"{name}.reused"] += 1
            self.remember(name, row["id"], target_id)

    def migrate_modules_features_roles(self) -> None:
        self.migrate_natural("app_module", ("module_code",))
        feature_target = self.table("app_features", target=True)
        for row in self.source_rows("app_features"):
            target_id = self.existing_id(
                "app_features", feature_target.c.feature_code == row["feature_code"]
            )
            if target_id is None:
                data = self.common_data("app_features", row)
                data["id"] = self.allocate_id("app_features", row["id"])
                data["app_module_id"] = self.mapped(
                    "app_module", row["app_module_id"]
                )
                target_id = self.insert("app_features", data)
            else:
                self.stats["app_features.reused"] += 1
            self.remember("app_features", row["id"], target_id)

        self.migrate_natural("user_role", ("role_code",))

        mapping_target = self.table("app_feature_rolemap", target=True)
        for row in self.source_rows("app_feature_rolemap"):
            feature_id = self.mapped("app_features", row["app_feature_id"])
            role_id = self.mapped("user_role", row["user_role_id"])
            target_id = self.existing_id(
                "app_feature_rolemap",
                mapping_target.c.app_feature_id == feature_id,
                mapping_target.c.user_role_id == role_id,
            )
            if target_id is None:
                data = self.common_data("app_feature_rolemap", row)
                data.update(
                    id=self.allocate_id("app_feature_rolemap", row["id"]),
                    app_feature_id=feature_id,
                    user_role_id=role_id,
                )
                target_id = self.insert("app_feature_rolemap", data)
            else:
                self.stats["app_feature_rolemap.reused"] += 1
            self.remember("app_feature_rolemap", row["id"], target_id)

    def migrate_users(self) -> None:
        user_target = self.table("user_master", target=True)
        for row in self.source_rows("user_master"):
            condition = (
                user_target.c.user_email == row["user_email"]
                if row.get("user_email")
                else user_target.c.user_name == row["user_name"]
            )
            target_id = self.existing_id("user_master", condition)
            if target_id is None:
                data = self.common_data("user_master", row)
                data["id"] = self.allocate_id("user_master", row["id"])
                target_id = self.insert("user_master", data)
            else:
                self.stats["user_master.reused"] += 1
            self.remember("user_master", row["id"], target_id)

        self.migrate_natural("customer_signup", ("useremail",))

        for name in ("user_attr", "user_login_audit"):
            target = self.table(name, target=True)
            for row in self.source_rows(name):
                source_id = row["id"]
                candidate = self.convert(target.c.id, source_id)
                target_id = self.target.execute(
                    select(target.c.id).where(target.c.id == candidate)
                ).scalar_one_or_none()
                if target_id is None:
                    data = self.common_data(name, row)
                    data.update(
                        id=self.allocate_id(name, source_id),
                        user_id=self.mapped("user_master", row["user_id"]),
                    )
                    target_id = self.insert(name, data)
                else:
                    self.stats[f"{name}.reused"] += 1
                self.remember(name, source_id, target_id)

        rolemap_target = self.table("user_rolemap", target=True)
        for row in self.source_rows("user_rolemap"):
            role_id = self.mapped("user_role", row["user_role_id"])
            user_id = self.mapped("user_master", row["user_id"])
            target_id = self.existing_id(
                "user_rolemap",
                rolemap_target.c.user_role_id == role_id,
                rolemap_target.c.user_id == user_id,
            )
            if target_id is None:
                data = self.common_data("user_rolemap", row)
                data.update(
                    id=self.allocate_id("user_rolemap", row["id"]),
                    user_role_id=role_id,
                    user_id=user_id,
                )
                target_id = self.insert("user_rolemap", data)
            else:
                self.stats["user_rolemap.reused"] += 1
            self.remember("user_rolemap", row["id"], target_id)

    def migrate_lov_settings(self) -> None:
        self.migrate_natural("lov", ("key_grp", "key_value"))
        self.migrate_natural("system_setting", ("key_name",))

    def group_path(self, row: Mapping[str, Any], rows: dict[str, RowMapping]) -> str:
        names = [str(row["name"])]
        seen: set[str] = set()
        parent_id = row.get("parent_id")
        while parent_id and _key(parent_id) not in seen:
            seen.add(_key(parent_id))
            parent = rows.get(_key(parent_id))
            if parent is None:
                break
            names.insert(0, str(parent["name"]))
            parent_id = parent.get("parent_id")
        return " > ".join(names)

    def migrate_groups(self) -> None:
        rows = {_key(row["id"]): row for row in self.source_rows("ledger_group")}
        target = self.table("ledger_group", target=True)
        pending = dict(rows)
        while pending:
            progressed = False
            for source_id, row in list(pending.items()):
                parent_id = row.get("parent_id")
                if parent_id and _key(parent_id) not in self.maps.get("ledger_group", {}):
                    continue
                target_id = self.existing_id(
                    "ledger_group",
                    target.c.name == row["name"],
                    target.c.key_group == row["key_group"],
                    target.c.balance_type == row["balance_type"],
                )
                if target_id is None:
                    data = self.common_data("ledger_group", row)
                    data.update(
                        id=self.allocate_id("ledger_group", row["id"]),
                        parent_id=self.mapped("ledger_group", parent_id)
                        if parent_id
                        else None,
                        hierarchy_path=self.group_path(row, rows),
                    )
                    target_id = self.insert("ledger_group", data)
                else:
                    self.stats["ledger_group.reused"] += 1
                self.remember("ledger_group", row["id"], target_id)
                del pending[source_id]
                progressed = True
            if not progressed:
                raise RuntimeError("Could not resolve the local ledger-group hierarchy")

    def ledger_defaults(self, group_name: str, ledger_name: str) -> dict[str, Any]:
        categories = {
            "Bank Accounts": "bank",
            "Cash-in-hand": "cash",
            "Sundry Debtors": "customer",
            "Sundry Creditors": "vendor",
            "Sales Accounts": "income",
            "Purchase Accounts": "expense",
            "Office Expenses": "expense",
            "Duties & Taxes": "tax",
        }
        category = categories.get(group_name)
        is_bank = "Y" if category == "bank" or "bank" in ledger_name.lower() else "N"
        is_cash = "Y" if category == "cash" else "N"
        return {"category": category, "is_bank": is_bank, "is_cash": is_cash}

    def migrate_ledgers(self) -> None:
        target = self.table("ledger", target=True)
        source_groups = {
            _key(row["id"]): str(row["name"])
            for row in self.source_rows("ledger_group")
        }
        for row in self.source_rows("ledger"):
            target_id = self.existing_id(
                "ledger",
                target.c.company_id == self.company_id,
                func.lower(target.c.name) == str(row["name"]).lower(),
            )
            if target_id is None:
                data = self.common_data("ledger", row)
                group_name = source_groups.get(_key(row.get("ledger_group_id")), "")
                data.update(
                    id=self.allocate_id("ledger", row["id"]),
                    company_id=self.company_id,
                    ledger_group_id=self.mapped(
                        "ledger_group", row["ledger_group_id"]
                    )
                    if row.get("ledger_group_id")
                    else None,
                    **self.ledger_defaults(group_name, str(row["name"])),
                )
                target_id = self.insert("ledger", data)
            else:
                self.stats["ledger.reused"] += 1
            self.remember("ledger", row["id"], target_id)

    def migrate_parties(self) -> None:
        target = self.table("party", target=True)
        target_rows = self.target.execute(
            select(target).where(target.c.company_id == self.company_id)
        ).mappings()
        by_name = {
            _display_name(row["name_contact_info"]).lower(): row["id"]
            for row in target_rows
        }
        for row in self.source_rows("party"):
            name = _display_name(row["name_contact_info"]).lower()
            target_id = by_name.get(name)
            if target_id is None:
                data = self.common_data("party", row)
                data.update(
                    id=self.allocate_id("party", row["id"]),
                    company_id=self.company_id,
                    ledger_id=self.mapped("ledger", row["ledger_id"])
                    if row.get("ledger_id")
                    else None,
                )
                target_id = self.insert("party", data)
                by_name[name] = target_id
            else:
                self.stats["party.reused"] += 1
            self.remember("party", row["id"], target_id)

    def migrate_products(self) -> None:
        target = self.table("product_item", target=True)
        for row in self.source_rows("product_item"):
            target_id = self.existing_id(
                "product_item", target.c.item_code == row["item_code"]
            )
            if target_id is None:
                data = self.common_data("product_item", row)
                data.update(
                    id=self.allocate_id("product_item", row["id"]),
                    company_id=self.company_id,
                    item_type="G",
                    track_inventory="Y"
                    if (row.get("opening_stock") or 0) > 0
                    else "N",
                )
                target_id = self.insert("product_item", data)
            else:
                self.stats["product_item.reused"] += 1
            self.remember("product_item", row["id"], target_id)

    def migrate_sequences(self) -> None:
        target = self.table("voucher_sequence", target=True)
        for row in self.source_rows("voucher_sequence"):
            target_id = self.existing_id(
                "voucher_sequence", target.c.voucher_type == row["voucher_type"]
            )
            if target_id is None:
                data = self.common_data("voucher_sequence", row)
                data["id"] = self.allocate_id("voucher_sequence", row["id"])
                target_id = self.insert("voucher_sequence", data)
            else:
                current = self.target.execute(
                    select(target.c.last_number).where(target.c.id == target_id)
                ).scalar() or 0
                source_last = row.get("last_number") or 0
                if source_last > current:
                    self.target.execute(
                        target.update()
                        .where(target.c.id == target_id)
                        .values(last_number=source_last)
                    )
                    self.stats["voucher_sequence.updated"] += 1
                else:
                    self.stats["voucher_sequence.reused"] += 1
            self.remember("voucher_sequence", row["id"], target_id)

    def migrate_vouchers(self) -> None:
        header_target = self.table("voucher_header", target=True)
        type_target = self.table("voucher_type", target=True)
        type_rows = self.target.execute(
            select(
                type_target.c.id,
                type_target.c.name,
                type_target.c.base_voucher_type,
            ).where(
                type_target.c.company_id == self.company_id,
                type_target.c.is_system == "Y",
            )
        ).mappings()
        types = {
            str(row["base_voucher_type"]): (row["id"], row["name"])
            for row in type_rows
        }
        for row in self.source_rows("voucher_header"):
            candidate = self.convert(header_target.c.id, row["id"])
            target_id = self.target.execute(
                select(header_target.c.id).where(header_target.c.id == candidate)
            ).scalar_one_or_none()
            if target_id is None:
                base_type = str(row["voucher_type"])
                type_id, type_name = types[base_type]
                data = self.common_data("voucher_header", row)
                data.update(
                    id=self.allocate_id("voucher_header", row["id"]),
                    company_id=self.company_id,
                    voucher_type_id=type_id,
                    voucher_type_name=type_name,
                )
                target_id = self.insert("voucher_header", data)
            else:
                self.stats["voucher_header.reused"] += 1
            self.remember("voucher_header", row["id"], target_id)

        detail_target = self.table("voucher_detail", target=True)
        for row in self.source_rows("voucher_detail"):
            candidate = self.convert(detail_target.c.id, row["id"])
            target_id = self.target.execute(
                select(detail_target.c.id).where(detail_target.c.id == candidate)
            ).scalar_one_or_none()
            if target_id is None:
                data = self.common_data("voucher_detail", row)
                data.update(
                    id=self.allocate_id("voucher_detail", row["id"]),
                    voucher_id=self.mapped("voucher_header", row["voucher_id"]),
                    ledger_id=self.mapped("ledger", row["ledger_id"]),
                )
                target_id = self.insert("voucher_detail", data)
            else:
                self.stats["voucher_detail.reused"] += 1
            self.remember("voucher_detail", row["id"], target_id)

    def reset_product_sequence(self) -> None:
        self.target.execute(
            text(
                "SELECT setval(pg_get_serial_sequence('master.product_item', 'id'), "
                "GREATEST((SELECT COALESCE(MAX(id), 1) FROM master.product_item), 1), true)"
            )
        )

    def run(self, apply: bool) -> Counter[str]:
        self.source = self.source_engine.connect()
        self.target = self.target_engine.connect()
        transaction = self.target.begin()
        try:
            company = self.table("company", target=True)
            self.company_id = self.target.execute(
                select(company.c.id)
                .where(
                    company.c.company_name == self.company_name,
                    company.c.active == "Y",
                )
                .order_by(company.c.is_default.desc())
                .limit(1)
            ).scalar_one_or_none()
            if self.company_id is None:
                raise RuntimeError(
                    f"Active target company '{self.company_name}' was not found"
                )

            self.migrate_modules_features_roles()
            self.migrate_users()
            self.migrate_lov_settings()
            self.migrate_groups()
            self.migrate_ledgers()
            self.migrate_parties()
            self.migrate_products()
            self.migrate_sequences()
            self.migrate_vouchers()
            self.reset_product_sequence()

            if apply:
                transaction.commit()
            else:
                transaction.rollback()
            return self.stats
        except Exception:
            transaction.rollback()
            raise
        finally:
            self.source.close()
            self.target.close()
            self.source_engine.dispose()
            self.target_engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--company", default="My Company")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if not args.source.is_file():
        raise SystemExit(f"Source SQLite database not found: {args.source}")
    if not settings.DATABASE_URL.startswith("postgresql"):
        raise SystemExit("Configured target is not PostgreSQL/Supabase")

    merge = Merge(args.source, settings.DATABASE_URL, args.company)
    stats = merge.run(apply=args.apply)
    mode = "APPLIED" if args.apply else "DRY RUN (rolled back)"
    print(mode)
    for key, value in sorted(stats.items()):
        print(f"{key}={value}")


if __name__ == "__main__":
    main()