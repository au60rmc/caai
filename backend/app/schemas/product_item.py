from pydantic import BaseModel, Field
from typing import Optional, Any, Dict
from datetime import datetime
from decimal import Decimal


class ProductItemBase(BaseModel):
    item_code: str = Field(..., max_length=50)
    item_name: str = Field(..., max_length=100)
    item_type: Optional[str] = "G"
    hsn_sac: Optional[str] = Field(None, max_length=10)
    unit: Optional[str] = "PCS"
    description: Optional[str] = None
    purchase_rate: Optional[Decimal] = None
    sale_rate: Optional[Decimal] = None
    gst_percent: Optional[Decimal] = 0
    tax_category: Optional[str] = None
    track_inventory: Optional[str] = "N"
    opening_stock: Optional[Decimal] = 0
    min_stock_level: Optional[Decimal] = 0
    max_stock_level: Optional[Decimal] = 0
    warehouse: Optional[str] = None
    custom_fields: Optional[Dict[str, Any]] = None
    status: str = "Active"


class ProductItemCreate(ProductItemBase):
    pass


class ProductItemUpdate(ProductItemBase):
    pass


class ItemQuickCreate(BaseModel):
    item_name: str
    hsn_sac: Optional[str] = None
    gst_percent: Optional[Decimal] = None
    item_type: Optional[str] = "G"


class ItemValidateRequest(BaseModel):
    id: Optional[int] = None
    item_code: Optional[str] = None
    item_name: Optional[str] = None


class ProductItemResponse(ProductItemBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
