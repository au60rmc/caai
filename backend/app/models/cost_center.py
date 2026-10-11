import uuid
from sqlalchemy import Column, String, DateTime
from sqlalchemy import Uuid as UUID
from sqlalchemy.sql import func
from app.core.database import Base


class CostCenter(Base):
    """Departments, projects and branches for MIS / profitability reporting."""

    __tablename__ = "cost_center"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False, index=True)
    code = Column(String(20))
    kind = Column(String(15), default="DEPARTMENT")  # DEPARTMENT/PROJECT/BRANCH
    parent_id = Column(UUID(as_uuid=True), nullable=True)
    active = Column(String(1), default="Y")
    created_by = Column(String(100))
    modified_by = Column(String(100))
    created_date = Column(DateTime(timezone=True), default=func.now())
    modified_date = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
