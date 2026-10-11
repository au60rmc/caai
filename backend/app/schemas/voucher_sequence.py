from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


class VoucherSequenceBase(BaseModel):
    company_id: Optional[UUID] = None
    voucher_type: str = Field(..., max_length=10)
    prefix: str = Field(..., max_length=10)
    last_number: Optional[int] = None
    number_width: Optional[int] = None
    active: str = "Y"


class VoucherSequenceCreate(VoucherSequenceBase):
    pass


class VoucherSequenceResponse(VoucherSequenceBase):
    id: UUID
    created_by: Optional[str] = None
    modified_by: Optional[str] = None
    created_date: Optional[datetime] = None
    modified_date: Optional[datetime] = None

    class Config:
        from_attributes = True
