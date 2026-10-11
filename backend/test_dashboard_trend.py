"""Regression test for the dashboard's six-month aggregate trend query.

Run with: python test_dashboard_trend.py
"""

import os
from datetime import date
from uuid import uuid4

# Keep this test isolated from the developer or deployed database settings.
os.environ["DEBUG"] = "false"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from app.core.database import Base, SessionLocal, engine
from app.models.voucher_header import VoucherHeader
from app.services.dashboard_service import DashboardService


def check_summary_cache() -> None:
    DashboardService.invalidate_cache()
    company_id = uuid4()
    calls = 0
    original = DashboardService._summary_uncached

    def fake_summary(_db, _company_id, _period, _compare):
        nonlocal calls
        calls += 1
        return {"value": calls}

    DashboardService._summary_uncached = staticmethod(fake_summary)
    try:
        assert DashboardService.summary(None, company_id, "THIS_MONTH", "") == {"value": 1}
        assert DashboardService.summary(None, company_id, "THIS_MONTH", "") == {"value": 1}
        assert calls == 1

        DashboardService.invalidate_cache(company_id)
        assert DashboardService.summary(None, company_id, "THIS_MONTH", "") == {"value": 2}
        assert calls == 2
        print("dashboard summary cache: ok")
    finally:
        DashboardService._summary_uncached = staticmethod(original)
        DashboardService.invalidate_cache()


def main() -> None:
    check_summary_cache()
    Base.metadata.create_all(engine)
    db = SessionLocal()
    try:
        company_id = uuid4()
        db.add_all(
            [
                VoucherHeader(
                    id=uuid4(),
                    company_id=company_id,
                    voucher_type="SALES",
                    voucher_date=date.today(),
                    voucher_status="POSTED",
                    active="Y",
                    total_debit=100,
                ),
                VoucherHeader(
                    id=uuid4(),
                    company_id=company_id,
                    voucher_type="PURCHASE",
                    voucher_date=date.today(),
                    voucher_status="POSTED",
                    active="Y",
                    total_debit=40,
                ),
            ]
        )
        db.commit()

        current_month = DashboardService._compute_performance_trend(db, company_id)[-1]
        assert current_month == {
            "month": date.today().strftime("%b"),
            "year": date.today().year,
            "revenue": 100.0,
            "expenses": 40.0,
            "net_profit": 60.0,
        }, current_month
        print("dashboard trend aggregate: ok")
    finally:
        db.close()


if __name__ == "__main__":
    main()
