from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class AppFeatureBase(BaseModel):
    feature_name: str
    feature_url: Optional[str] = None
    feature_code: str
    active: str = "Y"


class AppFeatureResponse(AppFeatureBase):
    id: UUID
    app_module_id: Optional[UUID] = None
    module_name: Optional[str] = None
    created_time: Optional[datetime] = None
    updated_time: Optional[datetime] = None

    class Config:
        from_attributes = True


class AppModuleBase(BaseModel):
    module_name: str
    module_code: str
    active: str = "Y"


class AppModuleResponse(AppModuleBase):
    id: UUID
    module_dis_order: Optional[int] = 0
    created_time: Optional[datetime] = None
    updated_time: Optional[datetime] = None

    class Config:
        from_attributes = True
