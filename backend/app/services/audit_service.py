import json
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog
from app.models.user_master import UserMaster
from typing import List, Optional, Dict, Any
from uuid import UUID


class AuditService:
    @staticmethod
    def list(
        db: Session,
        entity: Optional[str] = None,
        entity_id: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        q = db.query(AuditLog)
        if entity:
            q = q.filter(AuditLog.entity == entity)
        if entity_id:
            q = q.filter(AuditLog.entity_id == entity_id)
        rows = q.order_by(AuditLog.created_date.desc()).limit(limit).all()

        # Resolve actor UUIDs to user names for a readable activity timeline.
        actor_names: Dict[str, str] = {}
        for r in rows:
            if r.actor and r.actor not in actor_names:
                try:
                    u = db.query(UserMaster).filter(UserMaster.id == UUID(r.actor)).first()
                    actor_names[r.actor] = (
                        f"{u.first_name or ''} {u.last_name or ''}".strip() or u.user_name
                    ) if u else r.actor
                except (ValueError, TypeError):
                    actor_names[r.actor] = r.actor

        out = []
        for r in rows:
            changes = None
            if r.changes:
                try:
                    changes = json.loads(r.changes)
                except ValueError:
                    changes = None
            out.append(
                {
                    "id": str(r.id),
                    "entity": r.entity,
                    "entityId": r.entity_id,
                    "entityName": r.entity_name,
                    "action": r.action,
                    "changes": changes,
                    "actor": actor_names.get(r.actor, r.actor),
                    "createdDate": r.created_date.isoformat() if r.created_date else None,
                }
            )
        return out
