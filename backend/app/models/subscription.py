"""Subscription, licensing and entitlement domain models.

Maps to the CAAI Security & Subscription Design document:
- Table 4  : Plan matrix (SubscriptionPlan)
- Table 7  : Customer lifecycle (Customer, Subscription)
- Table 8  : Signed entitlement token claims (EntitlementToken)
- Table 9  : Licence state enforcement (Lease)
- Table 17 : Data entities (all models)
- Table 10 : Roles (seeded in init_db)
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, DateTime, Date, Integer, BigInteger, Boolean,
    Text, Float, ForeignKey, Index, UniqueConstraint,
)
from sqlalchemy import Uuid as UUID
from sqlalchemy.sql import func

from app.core.database import Base


# ---------------------------------------------------------------------------
# Table 4 — Subscription Plan Matrix
# ---------------------------------------------------------------------------
class SubscriptionPlan(Base):
    """Configurable plan: Trial / Single / Multiuser / Corporate."""

    __tablename__ = "subscription_plan"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_code = Column(String(30), unique=True, nullable=False, index=True)
    plan_name = Column(String(100), nullable=False)
    edition = Column(String(30), nullable=False)           # TRIAL | SINGLE | MULTIUSER | CORPORATE

    # Term
    term_type = Column(String(20), nullable=False)         # DAYS | MONTHLY | ANNUAL | CONTRACTED
    term_days = Column(Integer, nullable=True)             # 30 for Trial

    # Entitlement dimensions (Table 5)
    max_companies = Column(Integer, nullable=False, default=1)
    max_named_users = Column(Integer, nullable=False, default=1)
    max_concurrent_sessions = Column(Integer, nullable=False, default=1)
    transaction_limit = Column(BigInteger, nullable=False, default=500)
    metering_period = Column(String(20), nullable=False, default="SUBSCRIPTION_YEAR")

    # Deployment
    deployment_model = Column(String(50), default="ONE_DEVICE")  # ONE_DEVICE | ONE_DEVICE_REHOST | LAN | MULTI_SITE

    # Feature flags (JSON string of boolean features)
    maker_checker = Column(String(1), default="N")         # Y/N
    mfa_mode = Column(String(30), default="LOCAL_PASSWORD")  # LOCAL_PASSWORD | OPTIONAL_TOTP | TOTP_PRIVILEGED | TOTP_MANDATORY_SSO_OPTIONAL
    backup_mode = Column(String(50), default="LOCAL_ENCRYPTED")
    support_tier = Column(String(30), default="KNOWLEDGE_BASE")

    # Feature gate flags (Table 5 Row 6)
    feature_flags = Column(Text, nullable=True)            # JSON: {"branches": true, "api": false, "sso": false, "cloud_backup": false}

    # Pricing (configurable, not hard-coded)
    price_monthly = Column(Float, nullable=True)
    price_annual = Column(Float, nullable=True)
    currency = Column(String(5), default="INR")

    is_active = Column(String(1), default="Y")
    version = Column(Integer, default=1)
    created_by = Column(String(100))
    created_date = Column(DateTime(timezone=True), server_default=func.now())
    modified_by = Column(String(100))
    modified_date = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ---------------------------------------------------------------------------
# Table 17 Row 1 — Customer
# ---------------------------------------------------------------------------
class LicenceCustomer(Base):
    """Customer record for the licensing system (Table 17 Row 1).

    Separate from the accounting party to keep licensing PII minimal (PRV-001).
    """

    __tablename__ = "licence_customer"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(String(50), unique=True, nullable=False, index=True)
    legal_name = Column(String(200), nullable=False)
    tax_id = Column(String(50), nullable=True)             # GSTIN / PAN
    contact_email = Column(String(100), nullable=False)
    contact_phone = Column(String(20), nullable=True)
    status = Column(String(20), nullable=False, default="ACTIVE")  # ACTIVE | SUSPENDED | TERMINATED
    created_by = Column(String(100))
    created_date = Column(DateTime(timezone=True), server_default=func.now())
    modified_by = Column(String(100))
    modified_date = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ---------------------------------------------------------------------------
# Table 17 Row 2 — Subscription
# ---------------------------------------------------------------------------
class Subscription(Base):
    """Subscription lifecycle (Table 7, Table 17 Row 2).

    State machine: CREATED → ACTIVE → PAST_DUE → GRACE → EXPIRED → CANCELLED
    Payment event is idempotent; subscription state has explicit transition rules.
    """

    __tablename__ = "subscription"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subscription_id = Column(String(50), unique=True, nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("master.licence_customer.id"), nullable=False, index=True)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("master.subscription_plan.id"), nullable=False)

    # Dates
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    renewal_date = Column(Date, nullable=True)
    grace_end_date = Column(Date, nullable=True)

    # State
    status = Column(String(20), nullable=False, default="CREATED")
    # CREATED | ACTIVE | PAST_DUE | GRACE | EXPIRED | CANCELLED

    # Payment
    payment_state = Column(String(20), default="PENDING")  # PENDING | PAID | FAILED | REFUNDED
    payment_provider = Column(String(50), nullable=True)
    payment_reference = Column(String(100), nullable=True)
    order_id = Column(String(100), nullable=True)

    # Entitlement version (immutable reference)
    entitlement_version = Column(Integer, default=1)

    created_by = Column(String(100))
    created_date = Column(DateTime(timezone=True), server_default=func.now())
    modified_by = Column(String(100))
    modified_date = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ---------------------------------------------------------------------------
# Table 17 Row 3 — Licence
# ---------------------------------------------------------------------------
class Licence(Base):
    """Licence identity (Table 17 Row 3).

    Immutable identity; changes create a new entitlement version.
    """

    __tablename__ = "licence"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    licence_id = Column(String(50), unique=True, nullable=False, index=True)
    product_id = Column(String(50), nullable=False, default="CAAI_FA")
    customer_id = Column(UUID(as_uuid=True), ForeignKey("master.licence_customer.id"), nullable=False, index=True)
    subscription_id = Column(UUID(as_uuid=True), ForeignKey("master.subscription.id"), nullable=False)
    edition = Column(String(30), nullable=False)
    status = Column(String(20), nullable=False, default="ACTIVE")
    # ACTIVE | SUSPENDED | REVOKED | EXPIRED
    entitlement_version = Column(Integer, default=1)

    created_by = Column(String(100))
    created_date = Column(DateTime(timezone=True), server_default=func.now())
    modified_by = Column(String(100))
    modified_date = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ---------------------------------------------------------------------------
# Table 17 Row 4 — Activation
# ---------------------------------------------------------------------------
class Activation(Base):
    """Device activation (Section 5.2, Table 17 Row 4).

    Never store raw unnecessary device identifiers.
    """

    __tablename__ = "activation"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    activation_id = Column(String(50), unique=True, nullable=False, index=True)
    licence_id = Column(UUID(as_uuid=True), ForeignKey("master.licence.id"), nullable=False, index=True)
    installation_id = Column(String(100), nullable=False, index=True)
    device_evidence_hash = Column(String(128), nullable=False)
    product_version = Column(String(30), nullable=True)
    os_build = Column(String(50), nullable=True)
    status = Column(String(20), nullable=False, default="ACTIVE")
    # ACTIVE | DEACTIVATED | REHOSTED
    activated_at = Column(DateTime(timezone=True), server_default=func.now())
    deactivated_at = Column(DateTime(timezone=True), nullable=True)
    deactivation_reason = Column(String(100), nullable=True)

    created_by = Column(String(100))
    created_date = Column(DateTime(timezone=True), server_default=func.now())
    modified_by = Column(String(100))
    modified_date = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ---------------------------------------------------------------------------
# Table 17 Row 5 — Lease (Table 9 states)
# ---------------------------------------------------------------------------
class Lease(Base):
    """Signed offline lease bound to an installation (Table 9, Table 17 Row 5).

    States: ACTIVE | REFRESH_DUE | GRACE | EXPIRED | REVOKED
    """

    __tablename__ = "lease"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lease_id = Column(String(50), unique=True, nullable=False, index=True)
    activation_id = Column(UUID(as_uuid=True), ForeignKey("master.activation.id"), nullable=False, index=True)
    token_id = Column(String(100), nullable=False)
    key_id = Column(String(50), nullable=False)

    # Dates
    issued_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    lease_end = Column(DateTime(timezone=True), nullable=False)
    grace_end = Column(DateTime(timezone=True), nullable=True)
    last_refresh = Column(DateTime(timezone=True), nullable=True)

    # Offline lease defaults (Section 5, Table 25 Row 4)
    offline_lease_days = Column(Integer, default=30)
    refresh_interval_days = Column(Integer, default=7)
    grace_period_days = Column(Integer, default=14)

    status = Column(String(20), nullable=False, default="ACTIVE")

    created_by = Column(String(100))
    created_date = Column(DateTime(timezone=True), server_default=func.now())
    modified_by = Column(String(100))
    modified_date = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ---------------------------------------------------------------------------
# Table 17 Row 6 — Usage Bucket
# ---------------------------------------------------------------------------
class UsageBucket(Base):
    """Server-side usage counter (Table 17 Row 6).

    Server count reconciles with signed local summary; never decrement silently.
    """

    __tablename__ = "usage_bucket"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    licence_id = Column(UUID(as_uuid=True), ForeignKey("master.licence.id"), nullable=False, index=True)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    metric = Column(String(30), nullable=False, default="POSTED_VOUCHERS")
    committed_count = Column(BigInteger, nullable=False, default=0)
    last_event_time = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("licence_id", "period_start", "metric", name="uq_usage_bucket_period"),
    )

    created_date = Column(DateTime(timezone=True), server_default=func.now())
    modified_date = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ---------------------------------------------------------------------------
# Table 17 Row 7 — Usage Event
# ---------------------------------------------------------------------------
class UsageEvent(Base):
    """Idempotent usage event (Table 17 Row 7, Table 6).

    Contains no amount or party data.
    """

    __tablename__ = "usage_event"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(String(50), unique=True, nullable=False, index=True)
    installation_id = Column(String(100), nullable=False, index=True)
    voucher_id_hash = Column(String(128), nullable=False)  # SHA-256 of voucher ID, not actual ID
    event_type = Column(String(30), nullable=False)        # POST | REVERSE | IMPORT_POST
    local_sequence = Column(BigInteger, nullable=False)
    occurred_at = Column(DateTime(timezone=True), nullable=False)
    licence_id = Column(UUID(as_uuid=True), ForeignKey("master.licence.id"), nullable=False, index=True)

    created_date = Column(DateTime(timezone=True), server_default=func.now())


# ---------------------------------------------------------------------------
# Table 17 Row 8 — User Seat
# ---------------------------------------------------------------------------
class UserSeat(Base):
    """Named-user seat tracking (Table 17 Row 8).

    Seat count based on enabled named users.
    """

    __tablename__ = "user_seat"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    licence_id = Column(UUID(as_uuid=True), ForeignKey("master.licence.id"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    user_pseudonymous_id = Column(String(128), nullable=False)  # Hashed user ID
    is_enabled = Column(String(1), default="Y")

    __table_args__ = (
        UniqueConstraint("licence_id", "user_pseudonymous_id", name="uq_user_seat_licence_user"),
    )

    created_date = Column(DateTime(timezone=True), server_default=func.now())
    modified_date = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ---------------------------------------------------------------------------
# Table 17 Row 9 — Backup Record
# ---------------------------------------------------------------------------
class BackupRecord(Base):
    """Backup metadata record (Table 17 Row 9).

    No recovery secret; off-site object is ciphertext.
    """

    __tablename__ = "backup_record"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id_hash = Column(String(128), nullable=False, index=True)
    backup_id = Column(String(50), unique=True, nullable=False, index=True)
    backup_time = Column(DateTime(timezone=True), nullable=False, default=func.now())
    backup_type = Column(String(20), nullable=False, default="FULL")  # FULL | INCREMENTAL
    target_class = Column(String(30), nullable=False, default="LOCAL")  # LOCAL | REMOVABLE | NETWORK | OFFSITE
    result = Column(String(20), nullable=False, default="SUCCESS")  # SUCCESS | FAILED | PARTIAL
    verified_time = Column(DateTime(timezone=True), nullable=True)
    integrity_ok = Column(String(1), default="Y")

    # Encryption metadata
    encryption_algorithm = Column(String(30), default="AES-256-GCM")
    key_id = Column(String(50), nullable=True)

    # Retention
    retention_policy = Column(String(30), default="STANDARD")  # STANDARD | CORPORATE | CUSTOM
    expires_at = Column(DateTime(timezone=True), nullable=True)

    created_date = Column(DateTime(timezone=True), server_default=func.now())


# ---------------------------------------------------------------------------
# Table 17 Row 10 — Licence Audit Event (OPS-001)
# ---------------------------------------------------------------------------
class LicenceAuditEvent(Base):
    """Immutable audit event for licence/security actions (Table 17 Row 10, OPS-001).

    Append-only, access-controlled, retained by policy.
    Excludes accounting details and secrets (OPS-002).
    """

    __tablename__ = "licence_audit_event"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor = Column(String(100), nullable=False)
    action = Column(String(50), nullable=False, index=True)
    # ACTIVATE | DEACTIVATE | REHOST | LEASE_ISSUE | LEASE_REFRESH | LEASE_EXPIRE
    # SUBSCRIPTION_CREATE | SUBSCRIPTION_RENEW | SUBSCRIPTION_CANCEL
    # BACKUP_CREATE | BACKUP_VERIFY | RESTORE_START | RESTORE_COMPLETE
    # ROLE_CHANGE | EXPORT | LOGIN | LOGOUT | PASSWORD_CHANGE | MFA_ENROLL
    target = Column(String(100), nullable=True)
    target_type = Column(String(50), nullable=True)        # LICENCE | ACTIVATION | SUBSCRIPTION | USER | BACKUP
    before_state = Column(Text, nullable=True)             # JSON snapshot (no secrets)
    after_state = Column(Text, nullable=True)              # JSON snapshot (no secrets)
    event_time = Column(DateTime(timezone=True), nullable=False, default=func.now())
    source = Column(String(30), default="API")             # API | PORTAL | DESKTOP | SYSTEM
    result = Column(String(20), default="SUCCESS")         # SUCCESS | DENIED | ERROR
    ip_address = Column(String(45), nullable=True)
    correlation_id = Column(String(100), nullable=True)

    created_date = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_licence_audit_time", "event_time"),
        Index("ix_licence_audit_actor", "actor"),
    )


# ---------------------------------------------------------------------------
# Active Session Registry (Section 6.2)
# ---------------------------------------------------------------------------
class ActiveSession(Base):
    """Enforces concurrency limits atomically (Section 6.2).

    Stale session cleared after configurable heartbeat timeout.
    """

    __tablename__ = "active_session"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    licence_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    session_token_hash = Column(String(128), nullable=False, unique=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(255), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    last_heartbeat = Column(DateTime(timezone=True), nullable=False, default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_active = Column(String(1), default="Y")

    created_date = Column(DateTime(timezone=True), server_default=func.now())


# ---------------------------------------------------------------------------
# Entitlement Token (Table 8 — all 6 field groups)
# ---------------------------------------------------------------------------
class EntitlementToken(Base):
    """Stored signed entitlement token (Table 8).

    The product key shown to a user is an activation locator and checksum,
    not a secret that unlocks the software. The authoritative object is this
    vendor-signed entitlement token.
    """

    __tablename__ = "entitlement_token"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Identity (Table 8 Row 1)
    schema_version = Column(Integer, nullable=False, default=1)
    licence_id = Column(String(50), nullable=False, index=True)
    customer_id = Column(String(50), nullable=False)
    product_id = Column(String(50), nullable=False, default="CAAI_FA")
    edition = Column(String(30), nullable=False)
    order_id = Column(String(100), nullable=True)

    # Entitlements (Table 8 Row 2)
    feature_flags = Column(Text, nullable=True)            # JSON
    max_companies = Column(Integer, nullable=False, default=1)
    max_named_users = Column(Integer, nullable=False, default=1)
    max_concurrent_sessions = Column(Integer, nullable=False, default=1)
    transaction_limit = Column(BigInteger, nullable=False, default=500)
    metering_period = Column(String(20), nullable=False, default="SUBSCRIPTION_YEAR")

    # Validity (Table 8 Row 3)
    issued_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    subscription_start = Column(Date, nullable=False)
    subscription_end = Column(Date, nullable=False)
    offline_lease_end = Column(DateTime(timezone=True), nullable=True)
    grace_end = Column(DateTime(timezone=True), nullable=True)
    server_time = Column(DateTime(timezone=True), nullable=True)

    # Binding (Table 8 Row 4)
    installation_id = Column(String(100), nullable=True)
    allowed_device_count = Column(Integer, default=1)
    deployment_site_id = Column(String(100), nullable=True)
    binding_policy_version = Column(Integer, default=1)

    # Cryptography (Table 8 Row 5)
    algorithm = Column(String(30), default="ECDSA-P256-SHA256")
    key_id = Column(String(50), nullable=False)
    token_id = Column(String(100), unique=True, nullable=False)
    nonce_jti = Column(String(100), nullable=False)
    signature = Column(Text, nullable=False)

    # Policy (Table 8 Row 6)
    backup_enforcement_profile = Column(String(30), default="STANDARD")
    minimum_supported_version = Column(String(30), nullable=True)
    update_channel = Column(String(30), default="STABLE")
    support_tier = Column(String(30), default="STANDARD")

    # Token status
    is_current = Column(String(1), default="Y")
    superseded_by = Column(String(100), nullable=True)

    created_date = Column(DateTime(timezone=True), server_default=func.now())


# ---------------------------------------------------------------------------
# Key Registry (Section 7.3)
# ---------------------------------------------------------------------------
class KeyRegistry(Base):
    """Key inventory (Section 7.3).

    Records key purpose, algorithm, owner, lifecycle without logging secret material.
    """

    __tablename__ = "key_registry"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key_id = Column(String(50), unique=True, nullable=False, index=True)
    purpose = Column(String(50), nullable=False)
    # LICENCE_SIGNING | INSTALLATION_KEK | COMPANY_DEK | BACKUP_DEK | RECOVERY_WRAPPER
    algorithm = Column(String(50), nullable=False)
    # ECDSA-P256 | AES-256-GCM | FERNET
    key_length_bits = Column(Integer, nullable=True)
    owner = Column(String(100), nullable=False)            # VENDOR | INSTALLATION | COMPANY | CUSTOMER
    status = Column(String(20), nullable=False, default="ACTIVE")
    # ACTIVE | DECRYPT_ONLY | RETIRED | DESTROYED
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    activated_at = Column(DateTime(timezone=True), nullable=True)
    rotation_date = Column(DateTime(timezone=True), nullable=True)
    retired_at = Column(DateTime(timezone=True), nullable=True)
    destroyed_at = Column(DateTime(timezone=True), nullable=True)
    version = Column(Integer, default=1)
    wrapped_by_key_id = Column(String(50), nullable=True)  # Parent key in hierarchy

    created_date = Column(DateTime(timezone=True), server_default=func.now())
    modified_date = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ---------------------------------------------------------------------------
# Login Attempt Tracker (Section 6.2 — rate limiting)
# ---------------------------------------------------------------------------
class LoginAttempt(Base):
    """Rate-limit failures, progressive delay and auditable temporary lock (Section 6.2)."""

    __tablename__ = "login_attempt"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    identifier = Column(String(255), nullable=False, index=True)  # email or IP
    attempt_time = Column(DateTime(timezone=True), nullable=False, default=func.now())
    success = Column(String(1), nullable=False, default="N")
    ip_address = Column(String(45), nullable=True)
    locked_until = Column(DateTime(timezone=True), nullable=True)
