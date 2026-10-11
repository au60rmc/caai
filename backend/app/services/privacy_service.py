"""Data privacy and minimization service.

Implements:
- Section 11.1: Data Minimization (PRV-001, PRV-002)
- Table 3: Boundary Crossing Rules
"""

from __future__ import annotations

import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


class PrivacyService:
    """Enforces data minimization and privacy boundaries."""

    @staticmethod
    def strip_sensitive_telemetry(payload: Dict[str, Any]) -> Dict[str, Any]:
        """PRV-001: Ensure telemetry contains NO financial or personal identifiers.
        
        This strips anything that isn't strictly necessary for licence metering.
        """
        allowed_keys = {
            "licence_id", "installation_id", "timestamp", "event_type", 
            "usage_counts", "hardware_hash", "client_version"
        }
        
        # Strip all other keys
        minimized = {k: v for k, v in payload.items() if k in allowed_keys}
        
        # Redact specific nested fields if they exist
        if "usage_counts" in minimized:
            # We only want raw counts, not the items being counted
            if isinstance(minimized["usage_counts"], dict):
                minimized["usage_counts"] = {
                    k: (v if isinstance(v, (int, float)) else "REDACTED")
                    for k, v in minimized["usage_counts"].items()
                }

        return minimized

    @staticmethod
    def check_boundary_crossing(action: str, data_class: str) -> bool:
        """Table 3: Validates if a data class is allowed to cross a boundary."""
        # Highly sensitive data (Financial, Auth) should never leave the customer boundary
        # except when explicitly exported by an admin or encrypted in backup.
        if data_class == "FINANCIAL" and action == "TELEMETRY":
            return False
            
        if data_class == "AUTH_SECRETS":
            return False
            
        return True
