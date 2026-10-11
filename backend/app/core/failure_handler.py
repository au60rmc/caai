"""Failure behavior and supportability (Section 12, Table 20).

Each failure mode has a required behavior, support-safe evidence, and a
resolution path that never deletes, corrupts or encrypts customer data
as a licensing action (Section 1.1).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class FailureSpec:
    """Specification for a recoverable failure mode."""
    code: str
    failure: str
    required_behavior: str
    support_evidence: str
    resolution: str


# ---------------------------------------------------------------------------
# Table 20 — Failure Behavior
# ---------------------------------------------------------------------------
FAILURE_SPECS: dict[str, FailureSpec] = {}

_RAW = [
    (
        "FAIL-NO-INTERNET",
        "No internet",
        "Use valid signed offline lease; accounting remains functional.",
        "Lease dates, last successful refresh and non-sensitive error code.",
        "Connect to internet when available; offline lease provides continued access.",
    ),
    (
        "FAIL-SERVICE-OUTAGE",
        "Licensing service outage",
        "Exponential retry; resilience window; no immediate lockout.",
        "Service status, correlation ID and cached token version.",
        "System retries automatically; cached lease prevents desktop outage.",
    ),
    (
        "FAIL-CORRUPT-ENTITLEMENT",
        "Corrupt entitlement",
        "Reject protected actions, fall back to last valid token if safe, preserve read/backup/export.",
        "Signature result and token metadata, never private keys.",
        "Re-activate or contact support for fresh entitlement.",
    ),
    (
        "FAIL-PAYMENT-PENDING",
        "Subscription payment pending",
        "Use dunning/grace policy; communicate date and resolution.",
        "Order/provider reconciliation status.",
        "Complete payment or contact billing support.",
    ),
    (
        "FAIL-COUNTER-MISMATCH",
        "Counter mismatch",
        "Reconcile from immutable voucher/audit data; do not discard postings.",
        "Counter chain, ledger-derived total and repair record.",
        "Automatic reconciliation; support review if persistent.",
    ),
    (
        "FAIL-BACKUP-UNAVAILABLE",
        "Backup target unavailable",
        "Queue, notify and retry; allow alternate target.",
        "Target class, OS error, free space and last success.",
        "Check target availability or configure alternate backup destination.",
    ),
    (
        "FAIL-UPDATE-FAILED",
        "Update fails",
        "Rollback to known-good executable and schema; preserve database safety backup.",
        "Installer log, signature, versions and migration result.",
        "Automatic rollback; re-attempt or contact support.",
    ),
    (
        "FAIL-LOST-COMPUTER",
        "Lost computer",
        "Rehost licence and restore encrypted backup using customer recovery material.",
        "Identity check, rehost approval and restore verification.",
        "Use customer portal to deactivate lost device and rehost licence.",
    ),
]

for code, failure, behavior, evidence, resolution in _RAW:
    FAILURE_SPECS[code] = FailureSpec(
        code=code,
        failure=failure,
        required_behavior=behavior,
        support_evidence=evidence,
        resolution=resolution,
    )


def handle_failure(code: str, context: Optional[dict] = None) -> dict:
    """Return the prescribed failure response for a given failure code.

    Never returns data that would worsen the customer's condition.
    Always preserves read/report/export access.
    """
    spec = FAILURE_SPECS.get(code)
    if spec is None:
        logger.warning("Unknown failure code: %s", code)
        return {
            "error_code": code,
            "message": "An unexpected error occurred.",
            "action": "Contact support.",
            "read_access": True,
            "export_access": True,
            "backup_access": True,
        }

    logger.info("Handling failure %s: %s", code, spec.failure)
    return {
        "error_code": spec.code,
        "failure": spec.failure,
        "message": spec.required_behavior,
        "action": spec.resolution,
        "support_evidence_fields": spec.support_evidence,
        # Section 1.1 — non-negotiable customer protections:
        "read_access": True,
        "report_access": True,
        "export_access": True,
        "backup_access": True,
        "context": context or {},
    }


def get_all_failure_specs() -> list[dict]:
    """Return all failure specifications for documentation/admin UI."""
    return [
        {
            "code": s.code,
            "failure": s.failure,
            "required_behavior": s.required_behavior,
            "support_evidence": s.support_evidence,
            "resolution": s.resolution,
        }
        for s in FAILURE_SPECS.values()
    ]
