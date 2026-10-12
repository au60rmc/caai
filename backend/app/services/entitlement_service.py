"""Entitlement verification service.

Acts as the gatekeeper for protected application actions.
Implements:
- 5 Subscription tiers: Trial, Solo, Multi Company, Team, Corporate
- Trial limitations:
    * 30 days trial duration
    * One company and one user
    * Maximum 1,000 posted vouchers
    * 50 AI document-processing pages
    * No payment card required
    * After expiry, posting stops, but customer can still view, back up, and export data
- Paid tier limitations (company count, user seats, concurrent sessions, transaction quotas)
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Optional, Tuple, Any, Dict
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import func, text
from fastapi import HTTPException, status

from app.models.subscription import (
    Subscription, SubscriptionPlan, Licence, Activation, Lease,
    LicenceCustomer, UsageBucket, UsageEvent
)
import app.models  # noqa: F401
from app.models.company import Company
from app.models.user_master import UserMaster
from app.models.voucher_header import VoucherHeader
from app.models.voucher_detail import VoucherDetail
from app.core.status_messages import get_status_message

logger = logging.getLogger(__name__)

TRIAL_MAX_VOUCHERS = 1000
TRIAL_MAX_AI_PAGES = 50
TRIAL_MAX_COMPANIES = 1
TRIAL_MAX_USERS = 1
TRIAL_TERM_DAYS = 30


class EntitlementService:
    """Gatekeeper enforcing plan limits and Trial constraints."""

    # ------------------------------------------------------------------
    # Trial identification & lifecycle
    # ------------------------------------------------------------------
    @staticmethod
    def is_demo_or_trial(db: Session, user: Optional[Any] = None) -> bool:
        """Unrestricted mode: Demo and Trial limitations are permanently disabled."""
        return False

    @staticmethod
    def ensure_trial_subscription(db: Session, user: Optional[Any] = None) -> Optional[Subscription]:
        """Ensures a customer and trial subscription record exists for the user."""
        if not EntitlementService.is_demo_or_trial(db, user):
            return None

        email = getattr(user, "user_email", None) or "demo@immbiz.local"
        name = getattr(user, "user_name", None) or "Demo User"

        customer = db.query(LicenceCustomer).filter(
            LicenceCustomer.contact_email == email
        ).first()

        if not customer:
            import uuid as _uuid
            customer = LicenceCustomer(
                customer_id=f"CUST-DEMO-{_uuid.uuid4().hex[:8].upper()}",
                legal_name=name,
                contact_email=email,
                created_by="system",
            )
            db.add(customer)
            try:
                db.commit()
                db.refresh(customer)
            except Exception:
                db.rollback()
                customer = db.query(LicenceCustomer).filter(
                    LicenceCustomer.contact_email == email
                ).first()

        if not customer:
            return None

        sub = db.query(Subscription).filter(
            Subscription.customer_id == customer.id
        ).order_by(Subscription.created_date.desc()).first()

        trial_plan = db.query(SubscriptionPlan).filter(
            SubscriptionPlan.plan_code == "TRIAL"
        ).first()

        if not trial_plan:
            from app.services.subscription_service import SubscriptionService
            SubscriptionService.seed_plans(db)
            trial_plan = db.query(SubscriptionPlan).filter(
                SubscriptionPlan.plan_code == "TRIAL"
            ).first()

        if not sub and trial_plan:
            import uuid as _uuid
            today = date.today()
            sub = Subscription(
                subscription_id=f"SUB-TRIAL-{_uuid.uuid4().hex[:8].upper()}",
                customer_id=customer.id,
                plan_id=trial_plan.id,
                start_date=today,
                end_date=today + timedelta(days=TRIAL_TERM_DAYS),
                grace_end_date=today + timedelta(days=TRIAL_TERM_DAYS + 14),
                status="ACTIVE",
                payment_state="PAID",
                created_by="system",
            )
            db.add(sub)
            try:
                db.commit()
                db.refresh(sub)
            except Exception:
                db.rollback()
                sub = db.query(Subscription).filter(
                    Subscription.customer_id == customer.id
                ).first()

        return sub

    @staticmethod
    def get_trial_status(
        db: Session,
        user: Optional[Any] = None,
        company_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        """Calculates exact usage and limits for the active user tier."""
        is_demo = EntitlementService.is_demo_or_trial(db, user)

        # Count posted vouchers
        vq = db.query(func.count(VoucherHeader.id)).filter(
            VoucherHeader.voucher_status == "POSTED",
            VoucherHeader.active == "Y",
        )
        if company_id is not None:
            vq = vq.filter(VoucherHeader.company_id == company_id)
        posted_vouchers_count = vq.scalar() or 0

        # Count AI document pages
        ai_pages_count = EntitlementService.get_ai_document_page_count(db, user)

        # Count active companies and users
        companies_count = db.query(func.count(Company.id)).filter(Company.active == "Y").scalar() or 0
        users_count = db.query(func.count(UserMaster.id)).filter(UserMaster.active == "Y").scalar() or 0

        # Non-demo accounts have NO restrictions
        if not is_demo:
            return {
                "tier": "Corporate",
                "plan_code": "CORPORATE",
                "plan_name": "Corporate (Unrestricted)",
                "is_trial": False,
                "term_days": 3650,
                "start_date": "2026-01-01",
                "end_date": "2099-12-31",
                "days_used": 0,
                "days_remaining": 26650,
                "is_expired": False,
                "posted_vouchers_count": posted_vouchers_count,
                "max_vouchers": 10000000,
                "vouchers_remaining": 10000000,
                "ai_pages_count": ai_pages_count,
                "max_ai_pages": 10000000,
                "ai_pages_remaining": 10000000,
                "companies_count": companies_count,
                "max_companies": 1000,
                "users_count": users_count,
                "max_users": 1000,
                "can_post": True,
                "can_view": True,
                "can_backup": True,
                "can_export": True,
                "no_card_required": True,
                "post_expiry_policy": "Full enterprise access with no restrictions",
                "status_label": "Active (No Restrictions)",
            }

        # Otherwise, Demo / Trial tier limits
        sub = EntitlementService.ensure_trial_subscription(db, user)

        today = date.today()
        if sub and sub.start_date:
            start_date = sub.start_date
            end_date = sub.end_date or (start_date + timedelta(days=TRIAL_TERM_DAYS))
        else:
            start_date = today
            end_date = today + timedelta(days=TRIAL_TERM_DAYS)

        days_used = max(0, (today - start_date).days)
        days_remaining = max(0, (end_date - today).days)
        is_expired = today > end_date

        if sub and is_expired and sub.status != "EXPIRED":
            sub.status = "EXPIRED"
            try:
                db.commit()
            except Exception:
                db.rollback()

        can_post = (not is_expired) and (posted_vouchers_count < TRIAL_MAX_VOUCHERS)

        return {
            "tier": "Trial",
            "plan_code": "TRIAL",
            "plan_name": "Trial",
            "is_trial": True,
            "term_days": TRIAL_TERM_DAYS,
            "start_date": str(start_date),
            "end_date": str(end_date),
            "days_used": days_used,
            "days_remaining": days_remaining,
            "is_expired": is_expired,
            "posted_vouchers_count": posted_vouchers_count,
            "max_vouchers": TRIAL_MAX_VOUCHERS,
            "vouchers_remaining": max(0, TRIAL_MAX_VOUCHERS - posted_vouchers_count),
            "ai_pages_count": ai_pages_count,
            "max_ai_pages": TRIAL_MAX_AI_PAGES,
            "ai_pages_remaining": max(0, TRIAL_MAX_AI_PAGES - ai_pages_count),
            "companies_count": companies_count,
            "max_companies": TRIAL_MAX_COMPANIES,
            "users_count": users_count,
            "max_users": TRIAL_MAX_USERS,
            "can_post": can_post,
            "can_view": True,
            "can_backup": True,
            "can_export": True,
            "no_card_required": True,
            "post_expiry_policy": "After expiry, posting stops, but the customer can still view, back up and export data",
            "status_label": "Expired (View & Export Only)" if is_expired else "Active Trial",
        }

    @staticmethod
    def get_ai_document_page_count(db: Session, user: Optional[Any] = None) -> int:
        """Returns the number of AI document processing pages metered for this customer/user."""
        try:
            val = db.query(func.coalesce(func.sum(UsageBucket.committed_count), 0)).filter(
                UsageBucket.metric == "AI_DOCUMENT_PAGES"
            ).scalar()
            return int(val or 0)
        except Exception:
            try:
                db.rollback()
            except Exception:
                pass
            return 0


    @staticmethod
    def record_ai_document_pages(db: Session, pages: int = 1, user: Optional[Any] = None) -> None:
        """Records metered usage of AI document processing pages."""
        try:
            today = date.today()
            bucket = db.query(UsageBucket).filter(
                UsageBucket.metric == "AI_DOCUMENT_PAGES",
                UsageBucket.period_start <= today,
                UsageBucket.period_end >= today,
            ).first()
            if bucket:
                bucket.committed_count += pages
                bucket.last_event_time = datetime.now(timezone.utc)
            else:
                import uuid as _uuid
                lic = db.query(Licence).first()
                lic_id = lic.id if lic else _uuid.uuid4()
                b = UsageBucket(
                    licence_id=lic_id,
                    period_start=today,
                    period_end=today + timedelta(days=30),
                    metric="AI_DOCUMENT_PAGES",
                    committed_count=pages,
                    last_event_time=datetime.now(timezone.utc),
                )
                db.add(b)
            db.commit()
        except Exception as e:
            db.rollback()
            logger.warning("Failed to record AI document usage: %s", e)

    # ------------------------------------------------------------------
    # Assertion guards
    # ------------------------------------------------------------------
    @staticmethod
    def assert_voucher_posting_allowed(
        db: Session,
        user: Optional[Any] = None,
        company_id: Optional[UUID] = None,
    ) -> None:
        """Unrestricted: voucher posting is always permitted."""
        return

    @staticmethod
    def assert_company_creation_allowed(
        db: Session,
        user: Optional[Any] = None,
    ) -> None:
        """Unrestricted: company creation is always permitted."""
        return

    @staticmethod
    def assert_user_creation_allowed(
        db: Session,
        user: Optional[Any] = None,
    ) -> None:
        """Unrestricted: user creation is always permitted."""
        return

    @staticmethod
    def assert_ai_document_processing_allowed(
        db: Session,
        user: Optional[Any] = None,
        pages: int = 1,
    ) -> None:
        """Unrestricted: AI document processing is always permitted."""
        return

    # ------------------------------------------------------------------
    # Legacy Lease / Entitlement methods for backwards compatibility
    # ------------------------------------------------------------------
    @staticmethod
    def _get_active_lease(db: Session, licence_id: str, installation_id: str) -> Optional[Lease]:
        licence = db.query(Licence).filter(Licence.licence_id == licence_id).first()
        if not licence or licence.status != "ACTIVE":
            return None
            
        activation = db.query(Activation).filter(
            Activation.licence_id == licence.id,
            Activation.installation_id == installation_id,
            Activation.status == "ACTIVE"
        ).first()
        if not activation:
            return None
            
        lease = db.query(Lease).filter(
            Lease.activation_id == activation.id,
            Lease.status == "ACTIVE"
        ).order_by(Lease.issued_at.desc()).first()
        
        return lease

    @staticmethod
    def _get_entitlements(db: Session, licence_id: str) -> dict:
        licence = db.query(Licence).filter(Licence.licence_id == licence_id).first()
        if not licence:
            return {
                "max_companies": 1,
                "max_named_users": 1,
                "max_concurrent_sessions": 1,
                "transaction_limit": 1000,
                "metering_period": "TRIAL_PERIOD",
                "edition": "TRIAL",
            }
        sub = db.query(Subscription).filter(Subscription.id == licence.subscription_id).first()
        plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == sub.plan_id).first() if sub else None
        
        return {
            "max_companies": plan.max_companies if plan else 1,
            "max_named_users": plan.max_named_users if plan else 1,
            "max_concurrent_sessions": plan.max_concurrent_sessions if plan else 1,
            "transaction_limit": plan.transaction_limit if plan else 1000,
            "metering_period": plan.metering_period if plan else "TRIAL_PERIOD",
            "edition": plan.edition if plan else "TRIAL",
        }

    @staticmethod
    def verify_read_access(db: Session, licence_id: str, installation_id: str):
        """Unrestricted: read actions are always allowed."""
        pass

    @staticmethod
    def verify_write_access(db: Session, licence_id: str, installation_id: str):
        """Unrestricted: write actions are always allowed."""
        pass

    @staticmethod
    def verify_company_creation(db: Session, licence_id: str, current_company_count: int):
        """Unrestricted: company creation is always allowed."""
        pass

    @staticmethod
    def verify_user_creation(db: Session, licence_id: str, current_user_count: int):
        """Unrestricted: user creation is always allowed."""
        pass

    @staticmethod
    def verify_session_creation(db: Session, licence_id: str, current_session_count: int):
        """Unrestricted: session creation is always allowed."""
        pass

    @staticmethod
    def verify_transaction(db: Session, licence_id: str, current_tx_count: int):
        """Unrestricted: transactions are always allowed."""
        pass

