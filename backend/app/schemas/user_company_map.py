from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID
from datetime import datetime


class UserCompanyMapCreate(BaseModel):
    user_id: UUID
    company_ids: List[UUID]
    default_company_id: Optional[UUID] = None


class UserCompanyMapResponse(BaseModel):
    id: UUID
    user_id: UUID
    company_id: UUID
    company_name: Optional[str] = None
    is_default: str = "N"
    active: str = "Y"
    created_date: Optional[datetime] = None

    class Config:
        from_attributes = True
