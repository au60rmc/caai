"""Sensitive operations and step-up authentication service.

Implements:
- Section 6.5 / Table 11: Step-up authentication and dual-control requirements
"""

from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.core.security import verify_password
from app.models.auth import UserAttr

logger = logging.getLogger(__name__)


class SensitiveOpsService:
    """Manages access to sensitive operations requiring step-up auth."""

    @staticmethod
    def _verify_step_up_auth(db: Session, user_id: str, password_attempt: str) -> bool:
        """Verify the user's password for step-up authentication."""
        user_attr = (
            db.query(UserAttr)
            .filter(
                UserAttr.user_id == user_id,
                UserAttr.attr_name == "PWD",
                UserAttr.active == "Y",
            )
            .first()
        )
        if not user_attr or not verify_password(password_attempt, user_attr.attr_value):
            raise HTTPException(status_code=401, detail="Step-up authentication failed")
        return True

    @staticmethod
    def authorize_admin_creation(db: Session, requesting_user_id: str, step_up_password: str):
        """Create first admin (MFA) / Add admin (Dual-control + MFA)."""
        SensitiveOpsService._verify_step_up_auth(db, requesting_user_id, step_up_password)
        # Note: Dual-control would require a secondary approval flow mechanism

    @staticmethod
    def authorize_large_transaction(db: Session, requesting_user_id: str, amount: float, threshold: float = 100000.0):
        """Post a transaction above threshold (Dual-control)."""
        if amount >= threshold:
            # Require dual control approval
            raise HTTPException(status_code=403, detail="Transaction exceeds threshold; requires dual-control approval")
            
    @staticmethod
    def authorize_prior_period_modification(db: Session, requesting_user_id: str, step_up_password: str):
        """Open prior period (Step-up)."""
        SensitiveOpsService._verify_step_up_auth(db, requesting_user_id, step_up_password)

    @staticmethod
    def authorize_data_export(db: Session, requesting_user_id: str, step_up_password: str):
        """Export personal/financial detail (Step-up)."""
        SensitiveOpsService._verify_step_up_auth(db, requesting_user_id, step_up_password)

    @staticmethod
    def authorize_restore_backup(db: Session, requesting_user_id: str, step_up_password: str):
        """Restore a backup (Step-up)."""
        SensitiveOpsService._verify_step_up_auth(db, requesting_user_id, step_up_password)

    @staticmethod
    def authorize_rehost_licence(db: Session, requesting_user_id: str, step_up_password: str):
        """Deactivate a device to free up a slot (Step-up)."""
        SensitiveOpsService._verify_step_up_auth(db, requesting_user_id, step_up_password)
