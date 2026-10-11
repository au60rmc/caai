from sqlalchemy import Column, String, DateTime
from sqlalchemy import Uuid as UUID
from app.core.database import Base


class CustomerSignup(Base):
    __tablename__ = "customer_signup"
    __table_args__ = {"schema": "master", "extend_existing": True}

    id = Column(UUID(as_uuid=True), primary_key=True)
    user_name = Column(String(100))
    useremail = Column(String(100))
    first_name = Column(String(100))
    last_name = Column(String(100))
    mobile = Column(String(20))
    created_by = Column(String(100))
    created_date = Column(DateTime(timezone=True))
    modified_by = Column(String(100))
    modified_date = Column(DateTime(timezone=True))
    active = Column(String(10))


class UserAttr(Base):
    __tablename__ = "user_attr"
    __table_args__ = {"schema": "master", "extend_existing": True}

    id = Column(UUID(as_uuid=True), primary_key=True)
    user_id = Column(UUID(as_uuid=True))
    attr_name = Column(String(100))
    attr_value = Column(String(255))
    active = Column(String(10))
    created_by = Column(String(100))
    created_date = Column(DateTime(timezone=True))
    modified_by = Column(String(100))
    modified_date = Column(DateTime(timezone=True))


class UserLoginAudit(Base):
    __tablename__ = "user_login_audit"
    __table_args__ = {"schema": "master", "extend_existing": True}

    id = Column(UUID(as_uuid=True), primary_key=True)
    user_id = Column(UUID(as_uuid=True))
    log_in_date = Column(DateTime(timezone=True))
    log_out_date = Column(DateTime(timezone=True))
    created_by = Column(String(100))
    created_date = Column(DateTime(timezone=True))
    modified_by = Column(String(100))
    modified_date = Column(DateTime(timezone=True))
