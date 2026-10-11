from sqlalchemy import Column, String, DateTime, Integer
from sqlalchemy import Uuid as UUID
from sqlalchemy.sql import func
from app.core.database import Base
import uuid


class AppModule(Base):
    __tablename__ = "app_module"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    module_name = Column(String(100), nullable=False)
    module_code = Column(String(50), nullable=False, index=True)
    active = Column(String(1), default="Y")
    module_dis_order = Column(Integer, default=0)
    created_time = Column(DateTime(timezone=True), server_default=func.now())
    updated_time = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
