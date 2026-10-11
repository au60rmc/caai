from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class VoucherTypeCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    base_voucher_type: str = Field(..., min_length=1, max_length=10)
    abbreviation: Optional[str] = Field(None, max_length=20)
    active: Literal["Y", "N"] = "Y"

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Name cannot be empty or blank")
        return cleaned

    @field_validator("base_voucher_type")
    @classmethod
    def clean_base_voucher_type(cls, value: str) -> str:
        cleaned = value.strip().upper()
        if not cleaned:
            raise ValueError("Base Voucher Type is required")
        return cleaned

    @field_validator("abbreviation")
    @classmethod
    def clean_abbreviation(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip().upper()
        return cleaned if cleaned else None


class VoucherTypeUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = Field(None, min_length=1, max_length=100)
    base_voucher_type: Optional[str] = Field(None, min_length=1, max_length=10)
    abbreviation: Optional[str] = Field(None, max_length=20)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Name cannot be empty or blank")
        return cleaned

    @field_validator("base_voucher_type")
    @classmethod
    def clean_base_voucher_type(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip().upper()
        if not cleaned:
            raise ValueError("Base Voucher Type cannot be empty")
        return cleaned

    @field_validator("abbreviation")
    @classmethod
    def clean_abbreviation(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip().upper()
        return cleaned if cleaned else None


class VoucherTypeResponse(BaseModel):
    id: UUID
    company_id: UUID
    name: str
    base_voucher_type: str
    abbreviation: Optional[str] = None
    active: Literal["Y", "N"]
    is_system: Literal["Y", "N"]
    created_by: Optional[str] = None
    modified_by: Optional[str] = None
    created_date: Optional[datetime] = None
    modified_date: Optional[datetime] = None

    class Config:
        from_attributes = True