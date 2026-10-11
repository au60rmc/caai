from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID
from decimal import Decimal


class VoucherDetailBase(BaseModel):
    line_no: int
    ledger_id: UUID
    cost_center_id: Optional[UUID] = None
    debit_amount: Optional[Decimal] = None
    credit_amount: Optional[Decimal] = None
    remarks: Optional[str] = Field(None, max_length=30)
    active: str = "Y"
    created_by: Optional[str] = None
    modified_by: Optional[str] = None


class VoucherDetailCreate(VoucherDetailBase):
    pass


class VoucherDetailUpdate(VoucherDetailBase):
    pass


class VoucherDetailResponse(VoucherDetailBase):
    id: UUID
    voucher_id: Optional[UUID] = None
    created_date: Optional[datetime] = None
    modified_date: Optional[datetime] = None

    class Config:
        from_attributes = True
