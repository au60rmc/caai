"""Subscription & plan management service.

Implements:
- Section 3  : Plan matrix and entitlement dimensions (Table 4, 5)
- Section 3.2: Transaction counting rule (Table 6)
- Section 4  : Customer and subscription lifecycle (Table 7, steps 1–11)
- Table 9    : Licence state enforcement
- Table 25   : Required product decisions / defaults
"""

from __future__ import annotations

import json
import logging
import uuid as _uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.subscription import (
    SubscriptionPlan, LicenceCustomer, Subscription, Licence,
    UsageBucket, UsageEvent, UserSeat, LicenceAuditEvent,
)
from app.core.status_messages import format_status

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Plan Matrix — 5 Subscription Tiers (Trial, Solo, Multi Company, Team, Corporate)
# ---------------------------------------------------------------------------

PLAN_SEED = [
    {
        "plan_code": "TRIAL",
        "plan_name": "Trial",
        "edition": "TRIAL",
        "term_type": "DAYS",
        "term_days": 30,
        "max_companies": 1,
        "max_named_users": 1,
        "max_concurrent_sessions": 1,
        "transaction_limit": 1000,
        "metering_period": "TRIAL_PERIOD",
        "deployment_model": "CLOUD_AND_STANDALONE",
        "maker_checker": "N",
        "mfa_mode": "LOCAL_PASSWORD",
        "backup_mode": "LOCAL_AND_CLOUD",
        "support_tier": "COMMUNITY",
        "price_monthly": 0.0,
        "price_annual": 0.0,
        "currency": "INR",
        "feature_flags": json.dumps({
            "badge": "Free Trial",
            "tier_type": "Trial",
            "ai_doc_limit": 50,
            "no_card_required": True,
            "standalone_concurrent": 1,
            "saas_concurrent": 1,
            "standalone_transaction_limit": "1,000 posted vouchers",
            "saas_transaction_limit": "1,000 posted vouchers",
            "post_expiry_policy": "After expiry, posting stops, but the customer can still view, back up and export data",
            "suitable_for": "Evaluation & new user onboarding",
            "custom_roles": False,
            "maker_checker": False,
            "approvals": False,
            "advanced_audit": False,
            "api_access": False,
            "sso": False,
            "service_accounts": False,
            "branches": False,
            "premium_support": False,
            "description": "30 days, one company and one user. Maximum 1,000 posted vouchers and 50 AI document-processing pages. No payment card required. After expiry, posting stops, but customer can still view, back up and export data.",
            "features": [
                "30 days duration",
                "One company and one user",
                "Maximum 1,000 posted vouchers",
                "50 AI document-processing pages",
                "No payment card required",
                "After expiry: posting stops, view, back up and export data remain available"
            ]
        }),
    },
    {
        "plan_code": "SOLO",
        "plan_name": "Solo",
        "edition": "SOLO",
        "term_type": "ANNUAL",
        "term_days": 365,
        "max_companies": 1,
        "max_named_users": 1,
        "max_concurrent_sessions": 1,
        "transaction_limit": 5000,
        "metering_period": "FINANCIAL_YEAR",
        "deployment_model": "ONE_DEVICE_REHOST",
        "maker_checker": "N",
        "mfa_mode": "OPTIONAL_TOTP",
        "backup_mode": "LOCAL_REMOVABLE",
        "support_tier": "STANDARD",
        "price_monthly": 499.0,
        "price_annual": 4999.0,
        "currency": "INR",
        "feature_flags": json.dumps({
            "badge": "Proprietor",
            "tier_type": "Solo",
            "ai_doc_limit": 500,
            "no_card_required": False,
            "standalone_concurrent": 1,
            "saas_concurrent": 1,
            "standalone_transaction_limit": "No transaction limit",
            "saas_transaction_limit": "5,000 chargeable documents per financial year",
            "post_expiry_policy": "Grace period followed by read, backup and export access",
            "suitable_for": "Proprietor or small business",
            "custom_roles": False,
            "maker_checker": False,
            "approvals": False,
            "advanced_audit": False,
            "api_access": False,
            "sso": False,
            "service_accounts": False,
            "branches": False,
            "premium_support": False,
            "description": "One company, one named user and one concurrent session. Suitable for a proprietor or small business. Standalone version has no transaction limit; SaaS includes 5,000 chargeable documents per financial year.",
            "features": [
                "One company",
                "One named user and one concurrent session",
                "Suitable for a proprietor or small business",
                "Standalone version has no transaction limit",
                "SaaS includes 5,000 chargeable documents per financial year",
                "Standard GST filing and financial reports"
            ]
        }),
    },
    {
        "plan_code": "MULTI_COMPANY",
        "plan_name": "Multi Company",
        "edition": "MULTI_COMPANY",
        "term_type": "ANNUAL",
        "term_days": 365,
        "max_companies": 5,
        "max_named_users": 1,
        "max_concurrent_sessions": 1,
        "transaction_limit": 25000,
        "metering_period": "FINANCIAL_YEAR",
        "deployment_model": "LAN",
        "maker_checker": "N",
        "mfa_mode": "OPTIONAL_TOTP",
        "backup_mode": "LOCAL_AND_CLOUD",
        "support_tier": "STANDARD",
        "price_monthly": 999.0,
        "price_annual": 9999.0,
        "currency": "INR",
        "feature_flags": json.dumps({
            "badge": "Accountant",
            "tier_type": "Multi Company",
            "ai_doc_limit": 1500,
            "no_card_required": False,
            "standalone_concurrent": 1,
            "saas_concurrent": 1,
            "standalone_transaction_limit": "No transaction limit",
            "saas_transaction_limit": "25,000 chargeable documents per financial year",
            "post_expiry_policy": "Grace period followed by read, backup and export access",
            "suitable_for": "Owner or accountant managing several companies",
            "custom_roles": False,
            "maker_checker": False,
            "approvals": False,
            "advanced_audit": False,
            "api_access": False,
            "sso": False,
            "service_accounts": False,
            "branches": False,
            "premium_support": False,
            "description": "Up to five companies, one named user. Suitable for an owner or accountant managing several companies. This tier is multi-company, but it is not multi-user.",
            "features": [
                "Up to five companies",
                "One named user",
                "Suitable for an owner or accountant managing several companies",
                "This tier is multi-company, but it is not multi-user",
                "Standalone version has no transaction limit",
                "SaaS includes 25,000 documents per financial year"
            ]
        }),
    },
    {
        "plan_code": "TEAM",
        "plan_name": "Team",
        "edition": "TEAM",
        "term_type": "ANNUAL",
        "term_days": 365,
        "max_companies": 10,
        "max_named_users": 10,
        "max_concurrent_sessions": 10,
        "transaction_limit": 100000,
        "metering_period": "FINANCIAL_YEAR",
        "deployment_model": "LAN",
        "maker_checker": "Y",
        "mfa_mode": "TOTP_PRIVILEGED",
        "backup_mode": "LOCAL_NETWORK_REMOVABLE",
        "support_tier": "PRIORITY",
        "price_monthly": 2499.0,
        "price_annual": 24999.0,
        "currency": "INR",
        "feature_flags": json.dumps({
            "badge": "Collaborative",
            "tier_type": "Team",
            "ai_doc_limit": 5000,
            "no_card_required": False,
            "standalone_concurrent": 5,
            "saas_concurrent": 10,
            "standalone_transaction_limit": "No transaction limit",
            "saas_transaction_limit": "100,000 chargeable documents per financial year",
            "post_expiry_policy": "Grace period followed by read, backup and export access",
            "suitable_for": "Collaborative accounting teams and growing businesses",
            "custom_roles": True,
            "maker_checker": True,
            "approvals": True,
            "advanced_audit": True,
            "api_access": True,
            "sso": False,
            "service_accounts": False,
            "branches": True,
            "premium_support": False,
            "description": "Up to ten companies, ten named users. Five concurrent users for standalone and ten for SaaS. Includes custom roles, maker-checker, approvals, advanced audit controls and API access.",
            "features": [
                "Up to ten companies",
                "Ten named users",
                "Five concurrent users for standalone and ten for SaaS",
                "Custom roles & permission matrix",
                "Maker-checker & voucher approvals",
                "Advanced audit controls & immutable audit log",
                "API access for third-party systems"
            ]
        }),
    },
    {
        "plan_code": "CORPORATE",
        "plan_name": "Corporate",
        "edition": "CORPORATE",
        "term_type": "ANNUAL",
        "term_days": 365,
        "max_companies": 50,
        "max_named_users": 25,
        "max_concurrent_sessions": 25,
        "transaction_limit": 1000000,
        "metering_period": "FINANCIAL_YEAR",
        "deployment_model": "MULTI_SITE",
        "maker_checker": "Y",
        "mfa_mode": "TOTP_MANDATORY_SSO_OPTIONAL",
        "backup_mode": "POLICY_MANAGED_OFFSITE",
        "support_tier": "NAMED_ESCALATION_SLA",
        "price_monthly": 4999.0,
        "price_annual": 49999.0,
        "currency": "INR",
        "feature_flags": json.dumps({
            "badge": "Enterprise",
            "tier_type": "Corporate",
            "ai_doc_limit": 25000,
            "no_card_required": False,
            "standalone_concurrent": 15,
            "saas_concurrent": 25,
            "standalone_transaction_limit": "No transaction limit",
            "saas_transaction_limit": "1,000,000 chargeable documents per financial year",
            "post_expiry_policy": "Grace period followed by read, backup and export access",
            "suitable_for": "Large enterprises, multi-branch groups and conglomerates",
            "custom_roles": True,
            "maker_checker": True,
            "approvals": True,
            "advanced_audit": True,
            "api_access": True,
            "sso": True,
            "service_accounts": True,
            "branches": True,
            "advanced_controls": True,
            "premium_support": True,
            "description": "Up to 50 companies, 25 named users. Fifteen concurrent users for standalone and 25 for SaaS. Includes advanced controls, SSO, service accounts, more branches, higher usage limits and premium support.",
            "features": [
                "Up to 50 companies",
                "25 named users",
                "Fifteen concurrent users for standalone and 25 for SaaS",
                "Advanced controls & governance policies",
                "Single Sign-On (SSO) & Service Accounts",
                "Multi-branch organizational hierarchy",
                "Higher usage limits & Premium SLA support"
            ]
        }),
    },
]


class SubscriptionService:
    """Manages plans, customers and subscriptions."""

    # ------------------------------------------------------------------
    # Plan management
    # ------------------------------------------------------------------
    @staticmethod
    def seed_plans(db: Session) -> int:
        """Idempotent: upsert plans from PLAN_SEED."""
        count = 0
        for seed in PLAN_SEED:
            plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_code == seed["plan_code"]).first()
            if plan:
                for k, v in seed.items():
                    setattr(plan, k, v)
                count += 1
            else:
                db.add(SubscriptionPlan(**seed))
                count += 1
        db.commit()
        return count

    @staticmethod
    def serialize_plan(plan: SubscriptionPlan) -> dict:
        flags = {}
        if plan.feature_flags:
            try:
                flags = json.loads(plan.feature_flags) if isinstance(plan.feature_flags, str) else plan.feature_flags
            except Exception:
                flags = {}
        return {
            "id": str(plan.id),
            "plan_code": plan.plan_code,
            "plan_name": plan.plan_name,
            "edition": plan.edition,
            "term_type": plan.term_type,
            "term_days": plan.term_days,
            "max_companies": plan.max_companies,
            "max_named_users": plan.max_named_users,
            "max_concurrent_sessions": plan.max_concurrent_sessions,
            "transaction_limit": plan.transaction_limit,
            "metering_period": plan.metering_period,
            "deployment_model": plan.deployment_model,
            "maker_checker": plan.maker_checker,
            "mfa_mode": plan.mfa_mode,
            "backup_mode": plan.backup_mode,
            "support_tier": plan.support_tier,
            "price_monthly": plan.price_monthly,
            "price_annual": plan.price_annual,
            "currency": plan.currency,
            "is_active": plan.is_active,
            "feature_flags": flags,
            "ai_doc_limit": flags.get("ai_doc_limit", 50),
            "no_card_required": flags.get("no_card_required", False),
            "post_expiry_policy": flags.get(
                "post_expiry_policy",
                "After expiry, posting stops, but customer can still view, back up and export data",
            ),
            "standalone_concurrent": flags.get("standalone_concurrent", plan.max_concurrent_sessions),
            "saas_concurrent": flags.get("saas_concurrent", plan.max_concurrent_sessions),
            "standalone_transaction_limit": flags.get(
                "standalone_transaction_limit",
                "No limit" if plan.edition != "TRIAL" else "1,000 posted vouchers",
            ),
            "saas_transaction_limit": flags.get(
                "saas_transaction_limit", f"{plan.transaction_limit:,} documents"
            ),
            "description": flags.get("description", ""),
            "suitable_for": flags.get("suitable_for", ""),
            "features": flags.get("features", flags.get("highlights", [])),
            "badge": flags.get("badge", ""),
        }

    @staticmethod
    def list_plans(db: Session) -> list[dict]:
        plans = (
            db.query(SubscriptionPlan)
            .filter(SubscriptionPlan.is_active == "Y")
            .order_by(SubscriptionPlan.max_companies.asc())
            .all()
        )
        if not plans or len(plans) < len(PLAN_SEED):
            SubscriptionService.seed_plans(db)
            plans = (
                db.query(SubscriptionPlan)
                .filter(SubscriptionPlan.is_active == "Y")
                .order_by(SubscriptionPlan.max_companies.asc())
                .all()
            )
        return [SubscriptionService.serialize_plan(p) for p in plans]

    @staticmethod
    def get_plan(db: Session, plan_code: str) -> Optional[SubscriptionPlan]:
        return db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_code == plan_code).first()

    @staticmethod
    def get_plan_by_id(db: Session, plan_id) -> Optional[SubscriptionPlan]:
        return db.query(SubscriptionPlan).filter(SubscriptionPlan.id == plan_id).first()

    # ------------------------------------------------------------------
    # Customer lifecycle (Table 7 Steps 1-2)
    # ------------------------------------------------------------------
    @staticmethod
    def create_customer(
        db: Session,
        legal_name: str,
        contact_email: str,
        tax_id: Optional[str] = None,
        contact_phone: Optional[str] = None,
        actor: str = "system",
    ) -> LicenceCustomer:
        """Step 2 — Register customer."""
        existing = db.query(LicenceCustomer).filter(
            LicenceCustomer.contact_email == contact_email
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Customer with this email already exists.",
            )
        customer = LicenceCustomer(
            customer_id=f"CUST-{_uuid.uuid4().hex[:12].upper()}",
            legal_name=legal_name,
            contact_email=contact_email,
            tax_id=tax_id,
            contact_phone=contact_phone,
            created_by=actor,
        )
        db.add(customer)
        db.commit()
        db.refresh(customer)

        _audit(db, actor, "CUSTOMER_CREATE", customer.customer_id, "CUSTOMER")
        return customer

    @staticmethod
    def get_customer(db: Session, customer_id: str) -> Optional[LicenceCustomer]:
        return db.query(LicenceCustomer).filter(
            LicenceCustomer.customer_id == customer_id
        ).first()

    # ------------------------------------------------------------------
    # Subscription lifecycle (Table 7 Steps 3-4, 10-11)
    # ------------------------------------------------------------------
    @staticmethod
    def create_subscription(
        db: Session,
        customer_db_id,
        plan_code: str,
        payment_reference: Optional[str] = None,
        actor: str = "system",
    ) -> Subscription:
        """Step 3 — Create order and subscription.

        Never trust browser success page; reconcile webhook and provider status
        (Table 7 Row 3).
        """
        plan = SubscriptionService.get_plan(db, plan_code)
        if not plan:
            raise HTTPException(status_code=404, detail=f"Plan '{plan_code}' not found.")

        today = date.today()

        # Calculate end date based on plan term
        if plan.term_type == "DAYS":
            end_date = today + timedelta(days=plan.term_days or 30)
        elif plan.term_type == "MONTHLY":
            end_date = today + timedelta(days=30)
        elif plan.term_type in ("ANNUAL", "CONTRACTED"):
            end_date = today + timedelta(days=365)
        else:
            end_date = today + timedelta(days=30)

        # Grace = 14 days after end (Table 25 Row 4)
        grace_end = end_date + timedelta(days=14)

        subscription = Subscription(
            subscription_id=f"SUB-{_uuid.uuid4().hex[:12].upper()}",
            customer_id=customer_db_id,
            plan_id=plan.id,
            start_date=today,
            end_date=end_date,
            grace_end_date=grace_end,
            status="ACTIVE" if plan.edition == "TRIAL" else "CREATED",
            payment_state="PAID" if plan.edition == "TRIAL" else "PENDING",
            payment_reference=payment_reference,
            order_id=f"ORD-{_uuid.uuid4().hex[:8].upper()}",
            created_by=actor,
        )
        db.add(subscription)
        db.commit()
        db.refresh(subscription)

        _audit(db, actor, "SUBSCRIPTION_CREATE", subscription.subscription_id, "SUBSCRIPTION",
               after_state=json.dumps({"plan": plan_code, "status": subscription.status}))
        return subscription

    @staticmethod
    def activate_subscription(db: Session, subscription_id: str, actor: str = "system") -> Subscription:
        """Transition subscription to ACTIVE after payment confirmation."""
        sub = db.query(Subscription).filter(Subscription.subscription_id == subscription_id).first()
        if not sub:
            raise HTTPException(status_code=404, detail="Subscription not found.")

        old_status = sub.status
        if sub.status not in ("CREATED", "PAST_DUE"):
            raise HTTPException(status_code=400, detail=f"Cannot activate subscription in state '{sub.status}'.")

        sub.status = "ACTIVE"
        sub.payment_state = "PAID"
        db.commit()

        _audit(db, actor, "SUBSCRIPTION_ACTIVATE", sub.subscription_id, "SUBSCRIPTION",
               before_state=json.dumps({"status": old_status}),
               after_state=json.dumps({"status": "ACTIVE"}))
        return sub

    @staticmethod
    def renew_subscription(db: Session, subscription_id: str, actor: str = "system") -> Subscription:
        """Step 10 — Renew subscription (Table 7 Row 10)."""
        sub = db.query(Subscription).filter(Subscription.subscription_id == subscription_id).first()
        if not sub:
            raise HTTPException(status_code=404, detail="Subscription not found.")

        plan = SubscriptionService.get_plan_by_id(db, sub.plan_id)
        old_end = sub.end_date

        # Extend from current end date or today, whichever is later
        base = max(sub.end_date, date.today())
        if plan and plan.term_type == "DAYS":
            sub.end_date = base + timedelta(days=plan.term_days or 30)
        elif plan and plan.term_type == "MONTHLY":
            sub.end_date = base + timedelta(days=30)
        elif plan and plan.term_type in ("ANNUAL", "CONTRACTED"):
            sub.end_date = base + timedelta(days=365)
        else:
            sub.end_date = base + timedelta(days=30)

        sub.grace_end_date = sub.end_date + timedelta(days=14)
        sub.status = "ACTIVE"
        sub.payment_state = "PAID"
        sub.entitlement_version += 1
        db.commit()

        _audit(db, actor, "SUBSCRIPTION_RENEW", sub.subscription_id, "SUBSCRIPTION",
               before_state=json.dumps({"end_date": str(old_end)}),
               after_state=json.dumps({"end_date": str(sub.end_date)}))
        return sub

    @staticmethod
    def cancel_subscription(db: Session, subscription_id: str, actor: str = "system") -> Subscription:
        """Step 11 — End subscription (Table 7 Row 11).

        Expiry/cancellation transitions to read-only after grace.
        Export and backup continue. Reactivation restores posting without data conversion.
        """
        sub = db.query(Subscription).filter(Subscription.subscription_id == subscription_id).first()
        if not sub:
            raise HTTPException(status_code=404, detail="Subscription not found.")

        old_status = sub.status
        sub.status = "CANCELLED"
        db.commit()

        _audit(db, actor, "SUBSCRIPTION_CANCEL", sub.subscription_id, "SUBSCRIPTION",
               before_state=json.dumps({"status": old_status}),
               after_state=json.dumps({"status": "CANCELLED"}))
        return sub

    @staticmethod
    def check_subscription_state(db: Session, subscription_id: str) -> dict:
        """Evaluate current subscription state against Table 9 rules."""
        sub = db.query(Subscription).filter(Subscription.subscription_id == subscription_id).first()
        if not sub:
            return format_status("LIC-READONLY")

        today = date.today()

        if sub.status == "CANCELLED":
            return format_status("LIC-READONLY")

        if sub.status == "ACTIVE" and sub.end_date >= today:
            return format_status("LIC-ACTIVE", date=str(sub.end_date))

        if sub.end_date < today and sub.grace_end_date and sub.grace_end_date >= today:
            return format_status("LIC-GRACE", date=str(sub.grace_end_date))

        if sub.end_date < today:
            return format_status("LIC-READONLY")

        return format_status("LIC-REFRESH")

    # ------------------------------------------------------------------
    # Plan upgrade/downgrade (Table 5 Row 1)
    # ------------------------------------------------------------------
    @staticmethod
    def change_plan(
        db: Session,
        subscription_id: str,
        new_plan_code: str,
        actor: str = "system",
    ) -> Subscription:
        """Plan upgrade takes effect on the next valid lease (Table 5 Row 1)."""
        sub = db.query(Subscription).filter(Subscription.subscription_id == subscription_id).first()
        if not sub:
            raise HTTPException(status_code=404, detail="Subscription not found.")

        new_plan = SubscriptionService.get_plan(db, new_plan_code)
        if not new_plan:
            raise HTTPException(status_code=404, detail=f"Plan '{new_plan_code}' not found.")

        old_plan = SubscriptionService.get_plan_by_id(db, sub.plan_id)
        sub.plan_id = new_plan.id
        sub.entitlement_version += 1
        db.commit()

        _audit(db, actor, "PLAN_CHANGE", sub.subscription_id, "SUBSCRIPTION",
               before_state=json.dumps({"plan": old_plan.plan_code if old_plan else "UNKNOWN"}),
               after_state=json.dumps({"plan": new_plan_code}))
        return sub

    # ------------------------------------------------------------------
    # Usage metering (Section 3.2, Table 6)
    # ------------------------------------------------------------------
    @staticmethod
    def record_usage_event(
        db: Session,
        licence_db_id,
        installation_id: str,
        voucher_id_hash: str,
        event_type: str,
        local_sequence: int,
    ) -> UsageEvent:
        """Record a transaction event per Table 6 counting rules.

        One posted voucher = one transaction, regardless of debit/credit lines.
        Drafts, auto-save, auto-journal lines do NOT count.
        Reversals DO count (they are new accounting events).
        """
        # Idempotent: check for duplicate event
        existing = db.query(UsageEvent).filter(
            UsageEvent.installation_id == installation_id,
            UsageEvent.voucher_id_hash == voucher_id_hash,
            UsageEvent.event_type == event_type,
        ).first()
        if existing:
            return existing  # Idempotent — same event already recorded

        event = UsageEvent(
            event_id=f"EVT-{_uuid.uuid4().hex[:12].upper()}",
            installation_id=installation_id,
            voucher_id_hash=voucher_id_hash,
            event_type=event_type,
            local_sequence=local_sequence,
            occurred_at=datetime.now(timezone.utc),
            licence_id=licence_db_id,
        )
        db.add(event)
        db.flush()

        # Update the bucket counter
        today = date.today()
        bucket = db.query(UsageBucket).filter(
            UsageBucket.licence_id == licence_db_id,
            UsageBucket.period_start <= today,
            UsageBucket.period_end >= today,
            UsageBucket.metric == "POSTED_VOUCHERS",
        ).first()

        if bucket:
            bucket.committed_count += 1
            bucket.last_event_time = event.occurred_at
        else:
            # Create a new bucket for the current year
            year_start = date(today.year, 4, 1) if today.month >= 4 else date(today.year - 1, 4, 1)
            year_end = date(year_start.year + 1, 3, 31)
            db.add(UsageBucket(
                licence_id=licence_db_id,
                period_start=year_start,
                period_end=year_end,
                metric="POSTED_VOUCHERS",
                committed_count=1,
                last_event_time=event.occurred_at,
            ))

        db.commit()
        return event

    @staticmethod
    def get_usage_summary(db: Session, licence_db_id) -> dict:
        """Get current period usage vs limit."""
        today = date.today()
        bucket = db.query(UsageBucket).filter(
            UsageBucket.licence_id == licence_db_id,
            UsageBucket.period_start <= today,
            UsageBucket.period_end >= today,
            UsageBucket.metric == "POSTED_VOUCHERS",
        ).first()

        used = bucket.committed_count if bucket else 0

        # Get the licence and its plan limit
        licence = db.query(Licence).filter(Licence.id == licence_db_id).first()
        limit = 500  # Default
        if licence:
            sub = db.query(Subscription).filter(Subscription.id == licence.subscription_id).first()
            if sub:
                plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == sub.plan_id).first()
                if plan:
                    limit = plan.transaction_limit

        # Warning thresholds at 80, 90 and 100 percent (Table 5 Row 5)
        pct = (used / limit * 100) if limit > 0 else 0
        warning_level = None
        if pct >= 100:
            warning_level = "LIMIT_REACHED"
        elif pct >= 90:
            warning_level = "WARNING_90"
        elif pct >= 80:
            warning_level = "WARNING_80"

        return {
            "used": used,
            "limit": limit,
            "percentage": round(pct, 1),
            "warning_level": warning_level,
            "period_start": str(bucket.period_start) if bucket else None,
            "period_end": str(bucket.period_end) if bucket else None,
        }

    # ------------------------------------------------------------------
    # Seat management (Table 17 Row 8)
    # ------------------------------------------------------------------
    @staticmethod
    def get_seat_count(db: Session, licence_db_id) -> int:
        """Count enabled named users for a licence."""
        return db.query(UserSeat).filter(
            UserSeat.licence_id == licence_db_id,
            UserSeat.is_enabled == "Y",
        ).count()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _audit(
    db: Session,
    actor: str,
    action: str,
    target: str,
    target_type: str,
    before_state: Optional[str] = None,
    after_state: Optional[str] = None,
) -> None:
    """Write a licence audit event (OPS-001)."""
    db.add(LicenceAuditEvent(
        actor=actor,
        action=action,
        target=target,
        target_type=target_type,
        before_state=before_state,
        after_state=after_state,
        event_time=datetime.now(timezone.utc),
    ))
    try:
        db.commit()
    except Exception:
        db.rollback()
        logger.warning("Failed to write licence audit event: %s %s", action, target)
