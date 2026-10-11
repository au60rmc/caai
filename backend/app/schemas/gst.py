from pydantic import BaseModel, Field
from typing import Optional
from decimal import Decimal
from uuid import UUID


class GstRateBase(BaseModel):
    rate: Decimal
    tax_type: str = "BOTH"
    description: Optional[str] = None
    active: str = "Y"


class GstRateSave(GstRateBase):
    id: Optional[UUID] = None


class HsnCodeBase(BaseModel):
    code: str = Field(..., max_length=10)
    description: Optional[str] = None
    gst_rate: Optional[Decimal] = None
    kind: str = "G"
    active: str = "Y"


class HsnCodeSave(HsnCodeBase):
    id: Optional[UUID] = None


class GstClassifyRequest(BaseModel):
    supplier_state_code: Optional[str] = None
    place_of_supply_state_code: Optional[str] = None
    supplier_gstin: Optional[str] = None
    customer_gstin: Optional[str] = None
    rate: Decimal = Decimal("0")
    taxable_amount: Decimal = Decimal("0")
