"""Seed realistic sample business data into the local SQLite database.

Idempotent; uses the app's own SQLAlchemy models. Targets the same local
SQLite file the desktop app uses (honours IMMBIZ_DB_PATH / DATABASE_URL).

Usage (from the backend/ directory):
    python seed_sample_data.py
"""
import os
import sys
from datetime import date
from decimal import Decimal
from pathlib import Path


def _default_sqlite_url() -> str:
    if sys.platform.startswith("win"):
        base = Path(os.getenv("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
    elif sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support"
    else:
        base = Path(os.getenv("XDG_DATA_HOME", Path.home() / ".local" / "share"))
    db_path = os.getenv("IMMBIZ_DB_PATH") or str(base / "ImmBizBooks" / "immbiz.db")
    return f"sqlite:///{db_path}"


os.environ.setdefault("DATABASE_URL", _default_sqlite_url())

from app.core.database import SessionLocal  # noqa: E402
from app.core.init_db import init_db, _seed_ledger_groups  # noqa: E402
from app.models.bank_account import BankAccount  # noqa: E402
from app.models.company import Company  # noqa: E402
from app.models.ledger import Ledger  # noqa: E402
from app.models.ledger_group import LedgerGroup  # noqa: E402
from app.models.party import Party  # noqa: E402
from app.models.product_item import ProductItem  # noqa: E402
from app.models.voucher_detail import VoucherDetail  # noqa: E402
from app.models.voucher_header import VoucherHeader  # noqa: E402
from app.models.voucher_sequence import VoucherSequence  # noqa: E402
from app.models.voucher_type import VoucherType  # noqa: E402

ACTOR = "system"

LEDGERS = [
    ("Cash", "Cash-in-hand", "DR", 100000, "Cash in hand", "cash"),
    ("HDFC Bank - 5521", "Bank Accounts", "DR", 250000, "HDFC current account", "bank"),
    ("Sales Account", "Sales Accounts", "CR", 0, "Sales revenue", "income"),
    ("Purchase Account", "Office Expenses", "DR", 0, "Purchases", "expense"),
    ("General Expenses", "Office Expenses", "DR", 0, "Miscellaneous expenses", "expense"),
    ("GST Payable", "Duties & Taxes", "CR", 0, "Output GST liability", "tax"),
]

CUSTOMERS = [
    dict(first="Tech", last="Solutions", company="Tech Solutions Pvt Ltd",
         display="Tech Solutions Pvt Ltd", email="accounts@techsol.com",
         mobile="9876543201", city="Mumbai", state="Maharashtra",
         terms="Net 30", credit=100000, opening=15000,
         gstin="27AAPFU0939F1ZV"),
    dict(first="XYZ", last="Trading", company="XYZ Trading Co",
         display="XYZ Trading", email="billing@xyztrading.com",
         mobile="9876543211", city="Bengaluru", state="Karnataka",
         terms="Net 15", credit=50000, opening=25000, gstin=None),
    dict(first="Retail", last="Partners", company="Retail Partners Ltd",
         display="Retail Partners Ltd", email="info@retailpartners.com",
         mobile="9876543203", city="Pune", state="Maharashtra",
         terms="Due on receipt", credit=75000, opening=0, gstin=None),
]

VENDORS = [
    dict(first="Global", last="Imports", company="Global Imports",
         display="Global Imports", email="purchase@globalimports.com",
         mobile="9876543202", city="Delhi", state="Delhi",
         terms="Net 30", credit=0, opening=20000, gstin=None),
    dict(first="ABC", last="Supplies", company="ABC Supplies",
         display="ABC Supplies", email="accounts@abcsupplies.com",
         mobile="9876543210", city="Chennai", state="Tamil Nadu",
         terms="Net 45", credit=0, opening=50000, gstin="33GSPTN0591G1ZK"),
]

PRODUCTS = [
    ("ITEM001", "Office Chair", "9401", "PCS",
     "Ergonomic office chair with adjustable height", 2500, 3500, 18, 50, 10, 100, "G"),
    ("ITEM002", "Desktop Computer", "8471", "PCS",
     "Intel i5, 8GB RAM, 256GB SSD", 35000, 45000, 18, 20, 5, 50, "G"),
    ("ITEM003", "Printer Paper A4", "4802", "REAM",
     "White A4 paper, 70 GSM, 500 sheets", 300, 400, 12, 100, 20, 200, "G"),
    ("ITEM004", "USB Cable Type-C", "8544", "PCS",
     "High speed USB-C cable 1m", 150, 250, 18, 100, 25, 250, "G"),
    ("ITEM005", "IT Support (hourly)", "998313", "HR",
     "On-site IT support services", 0, 1500, 18, 0, 0, 0, "S"),
]


def _make_party(d: dict, kind: str) -> Party:
    return Party(
        key_group=kind,
        active="Y",
        created_by=ACTOR,
        gstin=d.get("gstin"),
        name_contact_info={
            "title": None,
            "first_name": d["first"],
            "last_name": d["last"],
            "company_name": d["company"],
            "display_name": d["display"],
            "email": d["email"],
            "mobile_number": d["mobile"],
            "website": None,
        },
        address_info={
            "billing_address": {
                "address_line1": None,
                "address_line2": None,
                "city": d["city"],
                "state": d["state"],
                "country": "India",
                "pincode": None,
            },
            "same_as_billing": True,
        },
        payment_info={
            "payment_method": None,
            "terms": d["terms"],
            "credit_limit": d["credit"],
        },
        additional_info={
            "opening_bal": d["opening"],
            "date": None,
            "customer_type": None,
        },
    )


def main() -> None:
    init_db()

    db = SessionLocal()
    created = {k: 0 for k in ("ledger_group", "ledger", "party", "product_item", "bank", "voucher")}
    try:
        company = (
            db.query(Company)
            .filter(Company.is_default == "Y", Company.active == "Y")
            .first()
        )
        if db.query(LedgerGroup).count() == 0:
            _seed_ledger_groups(db)
            db.flush()
            created["ledger_group"] = db.query(LedgerGroup).count()

        subs = {
            g.name: g
            for g in db.query(LedgerGroup).filter(LedgerGroup.key_group == "S").all()
        }

        for name, group_name, bt, opening, desc, cat in LEDGERS:
            if db.query(Ledger).filter(Ledger.name == name).first():
                continue
            grp = subs.get(group_name)
            db.add(Ledger(
                name=name,
                ledger_group_id=grp.id if grp else None,
                category=cat,
                balance_type=bt,
                opening_balance=Decimal(str(opening)),
                opening_balance_date=date.today(),
                description=desc,
                is_bank="Y" if cat == "bank" else "N",
                is_cash="Y" if cat == "cash" else "N",
                active="Y",
                is_system="N",
                created_by=ACTOR,
            ))
            created["ledger"] += 1
        db.flush()

        hdfc = db.query(Ledger).filter(Ledger.name == "HDFC Bank - 5521").first()
        cash = db.query(Ledger).filter(Ledger.name == "Cash").first()
        if hdfc and not db.query(BankAccount).filter(BankAccount.ledger_id == hdfc.id).first():
            db.add(BankAccount(account_type="BANK", bank_name="HDFC Bank - 5521",
                               account_number="50100255215521", ifsc_code="HDFC0000521",
                               branch="Anna Nagar", ledger_id=hdfc.id, active="Y"))
            created["bank"] += 1
        if cash and not db.query(BankAccount).filter(BankAccount.ledger_id == cash.id).first():
            db.add(BankAccount(account_type="CASH", bank_name="Cash",
                               ledger_id=cash.id, active="Y"))
            created["bank"] += 1

        for d in CUSTOMERS:
            exists = any(
                (p.name_contact_info or {}).get("display_name") == d["display"]
                for p in db.query(Party).filter(Party.key_group == "C").all()
            )
            if not exists:
                db.add(_make_party(d, "C"))
                created["party"] += 1
        for d in VENDORS:
            exists = any(
                (p.name_contact_info or {}).get("display_name") == d["display"]
                for p in db.query(Party).filter(Party.key_group == "V").all()
            )
            if not exists:
                db.add(_make_party(d, "V"))
                created["party"] += 1

        for code, pname, hsn, unit_sym, desc, pur, sale, gst, op, mn, mx, itype in PRODUCTS:
            if db.query(ProductItem).filter(ProductItem.item_code == code).first():
                continue
            db.add(ProductItem(
                item_code=code,
                item_name=pname,
                item_type=itype,
                hsn_sac=hsn,
                unit=unit_sym,
                description=desc,
                purchase_rate=Decimal(str(pur)),
                sale_rate=Decimal(str(sale)),
                gst_percent=Decimal(str(gst)),
                track_inventory="Y" if itype == "G" else "N",
                opening_stock=Decimal(str(op)),
                min_stock_level=Decimal(str(mn)),
                max_stock_level=Decimal(str(mx)),
                status="Active",
            ))
            created["product_item"] += 1

        db.flush()

        has_journal = db.query(VoucherHeader).filter(
            VoucherHeader.voucher_type == "JOURNAL",
            VoucherHeader.company_id == (company.id if company else None),
        ).first()
        if not has_journal:
            cash = db.query(Ledger).filter(Ledger.name == "Cash").first()
            sales = db.query(Ledger).filter(Ledger.name == "Sales Account").first()
            seq = db.query(VoucherSequence).filter(
                VoucherSequence.voucher_type == "JOURNAL",
                VoucherSequence.active == "Y",
            ).first()
            journal_type = (
                db.query(VoucherType)
                .filter(
                    VoucherType.company_id == (company.id if company else None),
                    VoucherType.base_voucher_type == "JOURNAL",
                    VoucherType.active == "Y",
                )
                .order_by(VoucherType.is_system.desc())
                .first()
            )
            if company and cash and sales and seq and journal_type:
                seq.last_number = (seq.last_number or 0) + 1
                voucher_no = f"{seq.prefix}{str(seq.last_number).zfill(seq.number_width or 4)}"
                header = VoucherHeader(
                    company_id=company.id,
                    voucher_no=voucher_no,
                    voucher_type="JOURNAL",
                    voucher_type_id=journal_type.id,
                    voucher_type_name=journal_type.name,
                    voucher_date=date.today(),
                    narration="Cash sales",
                    voucher_status="POSTED",
                    total_debit=Decimal("10000"),
                    total_credit=Decimal("10000"),
                    active="Y",
                    created_by=ACTOR,
                )
                db.add(header)
                db.flush()
                db.add(VoucherDetail(
                    voucher_id=header.id, line_no=1, ledger_id=cash.id,
                    debit_amount=Decimal("10000"), credit_amount=Decimal("0"),
                    remarks="Cash received", active="Y", created_by=ACTOR,
                ))
                db.add(VoucherDetail(
                    voucher_id=header.id, line_no=2, ledger_id=sales.id,
                    debit_amount=Decimal("0"), credit_amount=Decimal("10000"),
                    remarks="Sales income", active="Y", created_by=ACTOR,
                ))
                created["voucher"] += 1

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    print("[seed_sample_data] DB:", os.environ["DATABASE_URL"])
    print("[seed_sample_data] created this run:", created)


if __name__ == "__main__":
    main()
