from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class UserMasterBase(BaseModel):
    id: Optional[UUID] = None
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    oauthid: Optional[str] = None
    gender: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    profession: Optional[str] = None
    nationality: Optional[str] = None
    aca_qualification: Optional[str] = None
    marital_status: Optional[str] = None
    org_id: Optional[UUID] = None
    dob: Optional[str] = None
    alt_email_id: Optional[str] = None
    user_state: Optional[str] = None
    user_type: Optional[str] = "S"


class UserRoleMapCreate(BaseModel):
    user_role_id: UUID


class UserRoleMapResponse(BaseModel):
    user_role_id: UUID
    role_name: Optional[str] = None

    class Config:
        from_attributes = True


class UserMasterCreate(BaseModel):
    user: UserMasterBase
    roles: List[UserRoleMapCreate] = []
    password: Optional[str] = None


class UserMasterUpdate(BaseModel):
    id: UUID
    user: UserMasterBase
    roles: List[UserRoleMapCreate] = []
    password: Optional[str] = None


class SetPasswordRequest(BaseModel):
    password: str


class UserMasterResponse(BaseModel):
    id: UUID
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    oauthid: Optional[str] = None
    gender: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    profession: Optional[str] = None
    nationality: Optional[str] = None
    aca_qualification: Optional[str] = None
    marital_status: Optional[str] = None
    org_id: Optional[UUID] = None
    created_by: Optional[str] = None
    created_date: Optional[datetime] = None
    modified_by: Optional[str] = None
    modified_date: Optional[datetime] = None
    active: Optional[str] = "Y"
    dob: Optional[str] = None
    alt_email_id: Optional[str] = None
    user_state: Optional[str] = None
    user_type: Optional[str] = "S"
    roles: List[UserRoleMapResponse] = []

    class Config:
        from_attributes = True
