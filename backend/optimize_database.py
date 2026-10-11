"""Create the indexes used by the dashboard's production queries.

Run once against the deployed database, outside the request path:

    cd backend
    DATABASE_URL='...' python optimize_database.py

The statements are idempotent and only add indexes; they do not alter or
rewrite application data.
"""

import os
from sqlalchemy import text

# Ensure .env is loaded if DATABASE_URL not in environment
if "DATABASE_URL" not in os.environ:
    from pathlib import Path
    for env_path in [Path(".env"), Path("../.env"), Path(__file__).resolve().parent.parent / ".env"]:
        if env_path.is_file():
            from dotenv import load_dotenv
            load_dotenv(dotenv_path=env_path)
            break

from app.core.database import IS_SQLITE, engine


def main() -> None:
    schemas = [""] if IS_SQLITE else ["master", "demo"]
    for schema in schemas:
        prefix = f'{schema}_' if schema else ""
        table = (lambda name: name) if IS_SQLITE else (lambda name: f'{schema}."{name}"')
        statements = [
            (
                f"{prefix}ix_voucher_header_dashboard_scope",
                f"CREATE INDEX IF NOT EXISTS {prefix}ix_voucher_header_dashboard_scope "
                f"ON {table('voucher_header')} "
                "(company_id, voucher_status, active, voucher_date)",
            ),
            (
                f"{prefix}ix_voucher_header_type_status",
                f"CREATE INDEX IF NOT EXISTS {prefix}ix_voucher_header_type_status "
                f"ON {table('voucher_header')} "
                "(company_id, voucher_type, voucher_status, active)",
            ),
            (
                f"{prefix}ix_voucher_detail_voucher_active",
                f"CREATE INDEX IF NOT EXISTS {prefix}ix_voucher_detail_voucher_active "
                f"ON {table('voucher_detail')} (voucher_id, active)",
            ),
            (
                f"{prefix}ix_voucher_detail_ledger_active",
                f"CREATE INDEX IF NOT EXISTS {prefix}ix_voucher_detail_ledger_active "
                f"ON {table('voucher_detail')} (ledger_id, active)",
            ),
            (
                f"{prefix}ix_audit_log_created_date",
                f"CREATE INDEX IF NOT EXISTS {prefix}ix_audit_log_created_date "
                f"ON {table('audit_log')} (created_date)",
            ),
            (
                f"{prefix}ix_party_company_active",
                f"CREATE INDEX IF NOT EXISTS {prefix}ix_party_company_active "
                f"ON {table('party')} (company_id, active)",
            ),
            (
                f"{prefix}ix_ledger_company_active",
                f"CREATE INDEX IF NOT EXISTS {prefix}ix_ledger_company_active "
                f"ON {table('ledger')} (company_id, active)",
            ),
        ]
        with engine.begin() as connection:
            for name, statement in statements:
                try:
                    connection.execute(text(statement))
                    print(f"created or verified: {name}")
                except Exception as e:
                    print(f"notice for {name}: {e}")


if __name__ == "__main__":
    main()
