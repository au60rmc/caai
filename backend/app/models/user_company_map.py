from sqlalchemy import Column, String, DateTime
from sqlalchemy import Uuid as UUID
from sqlalchemy.sql import func
from app.core.database import Base
import uuid


class UserCompanyMap(Base):
    __tablename__ = "user_company_map"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    is_default = Column(String(1), default="Y")
    active = Column(String(1), default="Y")
    created_by = Column(String, nullable=True)
    created_date = Column(DateTime(timezone=True), server_default=func.now())
    modified_by = Column(String, nullable=True)
    modified_date = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
