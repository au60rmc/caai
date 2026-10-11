from sqlalchemy import Column, String, DateTime, Date
from sqlalchemy import Uuid as UUID
from sqlalchemy.sql import func
from app.core.database import Base
import uuid


class UserMaster(Base):
    __tablename__ = "user_master"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_name = Column(String(100), nullable=True)
    user_email = Column(String(100), nullable=True, unique=True)
    oauthid = Column(String(100), nullable=True)
    gender = Column(String(10), nullable=True)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    profession = Column(String(100), nullable=True)
    nationality = Column(String(100), nullable=True)
    aca_qualification = Column(String(100), nullable=True)
    marital_status = Column(String(30), nullable=True)
    org_id = Column(UUID(as_uuid=True), nullable=True)
    created_by = Column(String, nullable=True)
    created_date = Column(DateTime(timezone=True), server_default=func.now())
    modified_by = Column(String, nullable=True)
    modified_date = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    active = Column(String(1), default="Y")
    dob = Column(Date, nullable=True)
    alt_email_id = Column(String(35), nullable=True)
    user_state = Column(String(15), nullable=True)
    user_type = Column(String(2), default="S")


class UserRoleMap(Base):
    __tablename__ = "user_rolemap"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_role_id = Column(UUID(as_uuid=True), nullable=True)
    user_id = Column(UUID(as_uuid=True), nullable=True)
    active = Column(String(1), default="Y")
    modified_by = Column(String, nullable=True)
    modified_date = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    created_by = Column(String, nullable=True)
    created_date = Column(DateTime(timezone=True), server_default=func.now())
