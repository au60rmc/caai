import uuid
from sqlalchemy import Column, String, DateTime
from sqlalchemy import Uuid as UUID
from sqlalchemy.sql import func
from app.core.database import Base


class LedgerGroup(Base):
    __tablename__ = "ledger_group"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(50), index=True)
    code = Column(String(50), unique=True, index=True, nullable=True)
    parent_id = Column(UUID, nullable=True)
    key_group = Column(String(1))
    balance_type = Column(String(2))
    hierarchy_path = Column(String(255))
    active = Column(String(1), default="Y")
    is_system = Column(String(1), default="N")
    created_by = Column(String(100))
    modified_by = Column(String(100))
    created_date = Column(DateTime(timezone=True), default=func.now())
    modified_date = Column(
        DateTime(timezone=True), default=func.now(), onupdate=func.now()
    )
