"""Status messages — Appendix A (Table 26).

Every denial displays the exact entitlement, current usage, resolution and
support route (ACC-001).
"""

from typing import Optional


class StatusMessage:
    """Immutable status message with user-facing text and primary action."""

    __slots__ = ("code", "message_template", "primary_action", "severity")

    def __init__(self, code: str, message_template: str, primary_action: str,
                 severity: str = "INFO"):
        self.code = code
        self.message_template = message_template
        self.primary_action = primary_action
        self.severity = severity  # INFO | WARNING | ERROR | CRITICAL

    def format(self, **kwargs) -> dict:
        """Return a JSON-serializable dict with interpolated message."""
        return {
            "code": self.code,
            "message": self.message_template.format(**kwargs),
            "primary_action": self.primary_action,
            "severity": self.severity,
        }


# ---------------------------------------------------------------------------
# Appendix A — Table 26
# ---------------------------------------------------------------------------

LIC_ACTIVE = StatusMessage(
    code="LIC-ACTIVE",
    message_template="Your subscription is active. Next licence check is due on {date}.",
    primary_action="None.",
    severity="INFO",
)

LIC_REFRESH = StatusMessage(
    code="LIC-REFRESH",
    message_template="Licence verification is due. Accounting remains available while we retry.",
    primary_action="Connect to internet or use offline renewal.",
    severity="WARNING",
)

LIC_GRACE = StatusMessage(
    code="LIC-GRACE",
    message_template="Your licence needs renewal by {date}. You can continue posting during the grace period.",
    primary_action="Renew or import offline response.",
    severity="WARNING",
)

LIC_READONLY = StatusMessage(
    code="LIC-READONLY",
    message_template="New entries are paused because the subscription has expired. Your reports, export and backup remain available.",
    primary_action="Renew or contact support.",
    severity="ERROR",
)

ENT_TRANSACTION = StatusMessage(
    code="ENT-TRANSACTION",
    message_template="This plan has reached {used} of {limit} posted vouchers for {period}.",
    primary_action="Upgrade or contact sales.",
    severity="ERROR",
)

ENT_USERS = StatusMessage(
    code="ENT-USERS",
    message_template="All named-user seats are assigned.",
    primary_action="Disable an unused user or upgrade.",
    severity="ERROR",
)

ENT_CONCURRENCY = StatusMessage(
    code="ENT-CONCURRENCY",
    message_template="All concurrent sessions are in use.",
    primary_action="End a stale session or wait.",
    severity="ERROR",
)

BAK_CRITICAL = StatusMessage(
    code="BAK-CRITICAL",
    message_template="No verified backup has completed for {days} days. Create a backup before posting.",
    primary_action="Back up now, select a target or request emergency override.",
    severity="CRITICAL",
)

SEC_TAMPER = StatusMessage(
    code="SEC-TAMPER",
    message_template="The application or licence could not be verified. Your data remains available for backup and export.",
    primary_action="Run repair from the official signed installer and contact support.",
    severity="CRITICAL",
)

# ---------------------------------------------------------------------------
# Lookup by code
# ---------------------------------------------------------------------------

_ALL_MESSAGES = {
    msg.code: msg
    for msg in [
        LIC_ACTIVE, LIC_REFRESH, LIC_GRACE, LIC_READONLY,
        ENT_TRANSACTION, ENT_USERS, ENT_CONCURRENCY,
        BAK_CRITICAL, SEC_TAMPER,
    ]
}


def get_status_message(code: str) -> Optional[StatusMessage]:
    """Look up a status message by its code."""
    return _ALL_MESSAGES.get(code)


def format_status(code: str, **kwargs) -> dict:
    """Convenience: look up and format a status message."""
    msg = get_status_message(code)
    if msg is None:
        return {"code": code, "message": f"Unknown status: {code}", "severity": "ERROR"}
    return msg.format(**kwargs)
