from sqlalchemy import Column, String, DateTime
from sqlalchemy import Uuid as UUID
from sqlalchemy.sql import func
from app.core.database import Base
import uuid


class AppFeatureRolemap(Base):
    __tablename__ = "app_feature_rolemap"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    app_feature_id = Column(UUID(as_uuid=True))
    user_role_id = Column(UUID(as_uuid=True))
    allow_write = Column(String(1), default="N")
    allow_delete = Column(String(1), default="N")
    active = Column(String(1), default="Y")
    created_date = Column(DateTime(timezone=True), server_default=func.now())
    modified_date = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
