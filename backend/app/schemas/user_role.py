from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class PermissionBase(BaseModel):
    feature_id: UUID
    allow_view: str = "Y"
    allow_write: str = "N"
    allow_delete: str = "N"


class PermissionCreate(PermissionBase):
    pass


class PermissionResponse(PermissionBase):
    feature_name: Optional[str] = None

    class Config:
        from_attributes = True


class UserRoleBase(BaseModel):
    role_code: str = Field(..., max_length=50)
    role_name: str = Field(..., max_length=100)
    active: str = "Y"


class UserRoleCreate(UserRoleBase):
    id: Optional[UUID] = None
    permissions: List[PermissionCreate] = []


class UserRoleUpdate(UserRoleBase):
    id: UUID
    permissions: List[PermissionCreate] = []


class UserRoleResponse(UserRoleBase):
    id: UUID
    created_time: Optional[datetime] = None
    updated_time: Optional[datetime] = None
    permissions: List[PermissionResponse] = []

    class Config:
        from_attributes = True
