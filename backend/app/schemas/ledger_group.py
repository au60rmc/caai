from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


class LedgerGroupBase(BaseModel):
    name: Optional[str] = Field(None, max_length=50)
    code: Optional[str] = Field(None, max_length=50)
    parent_id: Optional[UUID] = Field(None)
    key_group: Optional[str] = Field(None, max_length=1)
    balance_type: Optional[str] = Field(None, max_length=2)
    active: Optional[str] = Field("Y", max_length=1)
    created_by: Optional[str] = None
    modified_by: Optional[str] = None
    is_system: Optional[str] = Field("N", max_length=1)


class LedgerGroupCreate(LedgerGroupBase):
    pass


class LedgerGroupUpdate(LedgerGroupBase):
    pass


class LedgerGroupResponse(LedgerGroupBase):
    id: UUID
    created_date: Optional[datetime] = None
    modified_date: Optional[datetime] = None

    class Config:
        from_attributes = True
