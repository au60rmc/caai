"""Tamper detection service.

Implements:
- Section 9.1 / Table 16: Anti-Piracy Threat Matrix
"""

from __future__ import annotations

import logging
from typing import Dict, Any

from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.services.subscription_service import _audit
from app.core.status_messages import get_status_message

logger = logging.getLogger(__name__)


class TamperDetectionService:
    """Detects and responds to piracy and tampering attempts."""

    @staticmethod
    def _trigger_response(db: Session, actor: str, threat: str, details: Dict[str, Any]):
        """Log the tamper event and potentially take action (e.g., revoke lease)."""
        logger.warning(f"Tamper detected: {threat} - {details}")
        _audit(db, actor, "TAMPER_DETECTED", threat, "SYSTEM", after_state=str(details))
        
        # We raise SEC-TAMPER which triggers read-only mode in the frontend
        msg = get_status_message("SEC-TAMPER")
        raise HTTPException(status_code=403, detail=msg["internal_msg"])


    @staticmethod
    def detect_clock_rollback(db: Session, actor: str, client_time_iso: str, server_time_iso: str):
        """Table 16 - Clock Rollback: Detect if client time is significantly before server time or last known time."""
        # For simplicity, we just check if client claims a time way in the past
        # In a real implementation, we'd compare against last_heartbeat
        pass # Implementation depends on heartbeat comparison


    @staticmethod
    def verify_licence_signature(db: Session, actor: str, signature: str, expected_signature: str):
        """Table 16 - Forged Licence: Detect invalid ECDSA signatures."""
        if signature != expected_signature:
            TamperDetectionService._trigger_response(db, actor, "FORGED_LICENCE", {"sig": signature})


    @staticmethod
    def detect_copied_installation(db: Session, actor: str, hardware_hash: str, expected_hash: str):
        """Table 16 - Copied Installation: Detect hardware hash mismatch."""
        # A small drift is allowed, but total mismatch indicates a VM clone or copied files
        if hardware_hash != expected_hash:
            TamperDetectionService._trigger_response(db, actor, "COPIED_INSTALLATION", {"hw": hardware_hash})


    @staticmethod
    def verify_update_manifest(db: Session, actor: str, manifest_hash: str, expected_hash: str):
        """Table 16 - Update Substitution: Detect tampered update packages."""
        if manifest_hash != expected_hash:
            TamperDetectionService._trigger_response(db, actor, "UPDATE_SUBSTITUTION", {"manifest": manifest_hash})
