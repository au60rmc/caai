from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


class CostCenterBase(BaseModel):
    name: str = Field(..., max_length=100)
    code: Optional[str] = Field(None, max_length=20)
    kind: str = "DEPARTMENT"
    parent_id: Optional[UUID] = None
    active: str = "Y"


class CostCenterCreate(CostCenterBase):
    pass


class CostCenterUpdate(CostCenterBase):
    pass


class CostCenterResponse(CostCenterBase):
    id: UUID
    created_date: Optional[datetime] = None
    modified_date: Optional[datetime] = None

    class Config:
        from_attributes = True
