from pydantic import BaseModel, Field, model_validator
from typing import Optional
from datetime import datetime, date
from uuid import UUID
from decimal import Decimal

from app.schemas.voucher_detail import VoucherDetailBase, VoucherDetailResponse


class VoucherHeaderBase(BaseModel):
    voucher_no: Optional[str] = Field(None, max_length=50)
    voucher_type: Optional[str] = Field(None, max_length=10)
    voucher_type_id: Optional[UUID] = None
    voucher_type_name: Optional[str] = Field(None, max_length=100)
    voucher_date: Optional[date] = None
    due_date: Optional[date] = None
    reference_no: Optional[str] = Field(None, max_length=50)
    reference_date: Optional[date] = None
    narration: Optional[str] = Field(None, max_length=50)
    voucher_status: Optional[str] = Field(None, max_length=15)
    total_debit: Optional[Decimal] = None
    total_credit: Optional[Decimal] = None
    source_document_type: Optional[str] = Field(None, max_length=50)
    source_document_id: Optional[UUID] = None
    active: str = "Y"
    created_by: Optional[str] = None
    modified_by: Optional[str] = None


class VoucherHeaderCreate(VoucherHeaderBase):
    voucher_date: date
    details: list[VoucherDetailBase] = Field(..., min_length=2)

    @model_validator(mode="after")
    def validate_due_date(self) -> "VoucherHeaderCreate":
        if self.due_date and self.voucher_date and self.due_date < self.voucher_date:
            raise ValueError("Due date cannot be earlier than voucher date")
        return self


class VoucherHeaderUpdate(VoucherHeaderBase):
    details: Optional[list[VoucherDetailBase]] = Field(None, min_length=2)

    @model_validator(mode="after")
    def validate_due_date(self) -> "VoucherHeaderUpdate":
        if self.due_date and self.voucher_date and self.due_date < self.voucher_date:
            raise ValueError("Due date cannot be earlier than voucher date")
        return self


class VoucherHeaderResponse(VoucherHeaderBase):
    id: UUID
    created_date: Optional[datetime] = None
    modified_date: Optional[datetime] = None
    details: list[VoucherDetailResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True
