import uuid
from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy import Uuid as UUID
from sqlalchemy.sql import func
from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity = Column(String(50), index=True)
    entity_id = Column(String(50), index=True)
    entity_name = Column(String(100))
    action = Column(String(15))
    changes = Column(Text)
    actor = Column(String(100))
    created_date = Column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
