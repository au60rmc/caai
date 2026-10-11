import os
import sys
import json
import uuid
from pathlib import Path
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import create_engine, MetaData, Table, select, text, Uuid

# Setup paths
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

# Import all models so Base.metadata is populated
import app.models  # noqa: F401
from app.models import (
    audit_log, auth, bank_account, company, cost_center, custom_field,
    gst, ledger, ledger_group, lov, party, product_item, system_setting,
    unit, user_master, user_company_map, user_role, app_feature_rolemap,
    app_features, app_module, subscription, voucher_detail, voucher_header,
    voucher_sequence, voucher_type,
)
from app.core.database import Base

PG_URL = "postgresql://postgres:Admin01@localhost:5432/masters_db"
SQLITE_PATH = backend_dir / "immbiz.db"
SQLITE_URL = f"sqlite:///{SQLITE_PATH}"

def serialize_for_sqlite(col, val):
    if val is None:
        return None
    if isinstance(val, UUID):
        return val.hex
    if isinstance(col.type, Uuid) or "UUID" in str(col.type).upper():
        try:
            return UUID(str(val)).hex
        except Exception:
            return str(val)
    if isinstance(val, (dict, list)):
        return json.dumps(val)
    if isinstance(val, Decimal):
        return float(val)
    return val

def export_pg_to_sqlite():
    if SQLITE_PATH.exists():
        SQLITE_PATH.unlink()
        print(f"Removed existing {SQLITE_PATH}")

    # Connect to PostgreSQL
    pg_engine = create_engine(PG_URL)

    # Connect to SQLite
    sqlite_engine = create_engine(
        SQLITE_URL,
        execution_options={"schema_translate_map": {"master": None}},
        connect_args={"check_same_thread": False, "timeout": 30}
    )

    # Create all tables in SQLite
    print("Creating tables in SQLite...")
    Base.metadata.create_all(bind=sqlite_engine)

    # Reflect PG metadata for master schema
    pg_meta = MetaData(schema="master")
    pg_meta.reflect(bind=pg_engine, schema="master")

    # Reflect SQLite metadata
    sqlite_meta = MetaData()
    sqlite_meta.reflect(bind=sqlite_engine)

    total_tables = 0
    total_rows = 0

    with pg_engine.connect() as pg_conn, sqlite_engine.begin() as sqlite_conn:
        sqlite_conn.execute(text("PRAGMA foreign_keys = OFF;"))
        
        for pg_table_name, pg_table in pg_meta.tables.items():
            bare_name = pg_table.name
            if bare_name not in sqlite_meta.tables:
                print(f"Skipping {bare_name} (not found in SQLite)")
                continue

            sqlite_table = sqlite_meta.tables[bare_name]

            # Fetch all rows from PG
            rows = pg_conn.execute(select(pg_table)).mappings().all()
            if not rows:
                continue

            # Convert rows to dicts with serialized types matched against column types
            data_to_insert = []
            for r in rows:
                row_dict = {}
                for k, v in dict(r).items():
                    if k in sqlite_table.columns:
                        col = sqlite_table.columns[k]
                        row_dict[k] = serialize_for_sqlite(col, v)
                data_to_insert.append(row_dict)

            # Insert into SQLite in chunks
            chunk_size = 500
            for i in range(0, len(data_to_insert), chunk_size):
                chunk = data_to_insert[i:i + chunk_size]
                sqlite_conn.execute(sqlite_table.insert(), chunk)

            count = len(data_to_insert)
            total_tables += 1
            total_rows += count
            print(f"  Exported {count:>4} rows -> {bare_name}")

        sqlite_conn.execute(text("PRAGMA foreign_keys = ON;"))

    print(f"\nSUCCESS! Exported {total_rows} rows across {total_tables} tables into {SQLITE_PATH}")

if __name__ == "__main__":
    export_pg_to_sqlite()
