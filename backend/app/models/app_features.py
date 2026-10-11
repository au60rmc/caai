from sqlalchemy import Column, String, DateTime
from sqlalchemy import Uuid as UUID
from sqlalchemy.sql import func
from app.core.database import Base
import uuid


class AppFeature(Base):
    __tablename__ = "app_features"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    feature_name = Column(String(100), nullable=False)
    feature_url = Column(String(255))
    feature_code = Column(String(50), nullable=False, index=True)
    active = Column(String(1), default="Y")
    app_module_id = Column(UUID(as_uuid=True))
    key_type = Column(String(1))
    created_time = Column(DateTime(timezone=True), server_default=func.now())
    updated_time = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
