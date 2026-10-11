from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


class SystemSettingBase(BaseModel):
    key_name: str = Field(..., max_length=100)
    key_value: str = Field(..., max_length=100)
    key_type: str = "U"
    active: str = "Y"
    sys_module: Optional[str] = None


class SystemSettingCreate(SystemSettingBase):
    pass


class SystemSettingUpdate(BaseModel):
    key_name: Optional[str] = Field(None, max_length=100)
    key_value: Optional[str] = Field(None, max_length=100)
    key_type: Optional[str] = None
    active: Optional[str] = None
    sys_module: Optional[str] = None


class SystemSettingResponse(SystemSettingBase):
    id: UUID
    created_by: Optional[str] = None
    created_date: Optional[datetime] = None
    modified_by: Optional[str] = None
    modified_date: Optional[datetime] = None

    class Config:
        from_attributes = True
