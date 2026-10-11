from pydantic import BaseModel, Field, field_serializer, field_validator
from typing import Optional, Any, Dict, List
from decimal import Decimal
import datetime as dt
import re
from uuid import UUID

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class ContactPerson(BaseModel):
    name: Optional[str] = None
    designation: Optional[str] = None
    email: Optional[str] = None
    mobile: Optional[str] = None


class NameContactInfo(BaseModel):
    title: Optional[str] = None
    first_name: str
    company_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    display_name: Optional[str] = None
    email: Optional[str] = None
    mobile_number: Optional[str] = None
    fax: Optional[str] = None
    website: Optional[str] = None
    sub_customer: Optional[bool] = False
    parent_customer: Optional[str] = None
    billing_address_customer: Optional[bool] = False
    contact_persons: Optional[List[ContactPerson]] = None

    @field_validator("email")
    @classmethod
    def _validate_email(cls, v):
        if v is None or v == "":
            return v
        if not _EMAIL_RE.match(v):
            raise ValueError("Invalid email address")
        return v


class SingleAddress(BaseModel):
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    pincode: Optional[str] = None


class LabeledAddress(SingleAddress):
    label: Optional[str] = None


class AddressInfo(BaseModel):
    billing_address: Optional[SingleAddress] = None
    shipping_address: Optional[SingleAddress] = None
    same_as_billing: Optional[bool] = False
    # Arbitrary extra addresses (branch, warehouse, etc.) beyond billing/shipping.
    additional_addresses: Optional[List[LabeledAddress]] = None


class PaymentInfo(BaseModel):
    payment_method: Optional[str] = None
    terms: Optional[str] = None
    delivery_options: Optional[str] = None
    language: Optional[str] = None
    credit_limit: Optional[Decimal] = Decimal("0")
    bank_account_number: Optional[str] = None
    IFSC_code: Optional[str] = None

    @field_serializer("credit_limit")
    def _ser_credit_limit(self, v):
        return float(v) if v is not None else None


class AdditionalInfo(BaseModel):
    customer_type: Optional[str] = None
    taxes: Optional[str] = None
    opening_bal: Optional[Decimal] = Decimal("0")
    date: Optional[dt.date] = None
    business_id: Optional[str] = None
    billing_rate: Optional[Decimal] = Decimal("0")
    terms: Optional[str] = None
    account_number: Optional[str] = None
    expense_category: Optional[str] = None

    @field_serializer("opening_bal", "billing_rate")
    def _ser_money(self, v):
        return float(v) if v is not None else None


class PartyBase(BaseModel):
    name_contact_info: NameContactInfo
    address_info: Optional[AddressInfo] = None
    payment_info: Optional[PaymentInfo] = None
    additional_info: Optional[AdditionalInfo] = None
    gstin: Optional[str] = Field(None, max_length=15)
    pan: Optional[str] = Field(None, max_length=10)
    gst_type: Optional[str] = Field(None, max_length=20)
    custom_fields: Optional[Dict[str, Any]] = None
    active: str = "Y"
    created_by: Optional[str] = None
    modified_by: Optional[str] = None
    key_group: str  # C=customer V=vendor B=both


class PartyCreate(PartyBase):
    pass


class PartyUpdate(PartyBase):
    pass


class PartyQuickCreate(BaseModel):
    name: str
    key_group: str = "C"
    gstin: Optional[str] = None
    mobile: Optional[str] = None


class PartyValidateRequest(BaseModel):
    id: Optional[UUID] = None
    name: Optional[str] = None
    gstin: Optional[str] = None
    key_group: Optional[str] = None


class PartyResponse(PartyBase):
    id: UUID
    ledger_id: Optional[UUID] = None
    created_date: Optional[dt.datetime] = None
    modified_date: Optional[dt.datetime] = None

    class Config:
        from_attributes = True
