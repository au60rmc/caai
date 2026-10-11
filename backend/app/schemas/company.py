from pydantic import BaseModel, Field
from typing import Literal, Optional
from datetime import datetime, date
from uuid import UUID


class CompanyBase(BaseModel):
    company_name: str = Field(..., max_length=100)
    gstin: Optional[str] = Field(None, max_length=15)
    pan: Optional[str] = Field(None, max_length=10)
    state_code: Optional[str] = Field(None, max_length=2)
    address: Optional[str] = None
    city: Optional[str] = Field(None, max_length=50)
    state: Optional[str] = Field(None, max_length=50)
    pincode: Optional[str] = Field(None, max_length=10)
    email: Optional[str] = Field(None, max_length=100)
    mobile: Optional[str] = Field(None, max_length=20)
    financial_year_start: Optional[date] = None
    financial_year_end: Optional[date] = None
    currency: Optional[str] = "INR"
    maintain_mode: Optional[
        Literal["ACCOUNT_ONLY", "ACCOUNT_WITH_INVENTORY"]
    ] = None
    is_default: Optional[str] = "N"
    active: str = "Y"


class CompanyCreate(CompanyBase):
    maintain_mode: Literal["ACCOUNT_ONLY", "ACCOUNT_WITH_INVENTORY"]


class CompanyUpdate(CompanyBase):
    pass


class CompanyResponse(CompanyBase):
    id: UUID
    maintain_mode: Literal["ACCOUNT_ONLY", "ACCOUNT_WITH_INVENTORY"]
    created_date: Optional[datetime] = None
    modified_date: Optional[datetime] = None

    class Config:
        from_attributes = True
