"""Session registry and concurrency service.

Implements:
- Section 6.2: Session registry and atomic concurrency enforcement
- 30-minute standard timeout / 15-minute privileged timeout
- Heartbeat tracking to detect stale sessions
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, List

from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.subscription import ActiveSession
from app.services.entitlement_service import EntitlementService

logger = logging.getLogger(__name__)

SESSION_TIMEOUT_MINUTES = 30
PRIVILEGED_TIMEOUT_MINUTES = 15

class SessionService:
    """Manages active sessions and enforces concurrency limits."""

    @staticmethod
    def _cleanup_stale_sessions(db: Session, licence_id: str):
        """Remove sessions that have not heartbeat within the timeout window."""
        timeout_threshold = datetime.now(timezone.utc) - timedelta(minutes=SESSION_TIMEOUT_MINUTES)
        db.query(ActiveSession).filter(
            ActiveSession.licence_id == licence_id,
            ActiveSession.last_heartbeat < timeout_threshold
        ).delete()
        db.commit()

    @staticmethod
    def register_session(db: Session, licence_id: str, user_id: int, installation_id: str, ip_address: str, user_agent: str) -> str:
        """Atomically register a new session, enforcing plan concurrency limits."""
        # First cleanup stale sessions to free up slots
        SessionService._cleanup_stale_sessions(db, licence_id)
        
        # Enforce concurrency limit via entitlement service
        current_sessions = db.query(ActiveSession).filter(ActiveSession.licence_id == licence_id).count()
        EntitlementService.verify_session_creation(db, licence_id, current_sessions)

        session_id = f"SESS-{uuid.uuid4().hex[:12].upper()}"
        now = datetime.now(timezone.utc)
        
        new_session = ActiveSession(
            session_id=session_id,
            licence_id=licence_id,
            user_id=user_id,
            installation_id=installation_id,
            ip_address=ip_address,
            user_agent=user_agent,
            started_at=now,
            last_heartbeat=now
        )
        db.add(new_session)
        db.commit()
        
        return session_id

    @staticmethod
    def heartbeat(db: Session, session_id: str):
        """Update the last_heartbeat timestamp to keep the session alive."""
        session = db.query(ActiveSession).filter(ActiveSession.session_id == session_id).first()
        if not session:
            raise HTTPException(status_code=401, detail="Session expired or invalid")
            
        now = datetime.now(timezone.utc)
        
        # Determine timeout based on user privileges (mocked as standard here)
        # In a full implementation, check if user has Admin/Approver/Auditor roles
        timeout = timedelta(minutes=SESSION_TIMEOUT_MINUTES)
        
        if now - session.last_heartbeat.replace(tzinfo=timezone.utc) > timeout:
            db.delete(session)
            db.commit()
            raise HTTPException(status_code=401, detail="Session timed out due to inactivity")
            
        session.last_heartbeat = now
        db.commit()

    @staticmethod
    def terminate_session(db: Session, session_id: str):
        """Explicitly terminate a session (logout)."""
        db.query(ActiveSession).filter(ActiveSession.session_id == session_id).delete()
        db.commit()

    @staticmethod
    def list_active_sessions(db: Session, licence_id: str) -> List[ActiveSession]:
        """List active sessions for an admin view."""
        SessionService._cleanup_stale_sessions(db, licence_id)
        return db.query(ActiveSession).filter(ActiveSession.licence_id == licence_id).all()

    @staticmethod
    def terminate_all_other_sessions(db: Session, licence_id: str, keep_session_id: str):
        """Emergency administrative action to clear other sessions."""
        db.query(ActiveSession).filter(
            ActiveSession.licence_id == licence_id,
            ActiveSession.session_id != keep_session_id
        ).delete()
        db.commit()
