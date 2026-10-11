from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID


class CustomFieldDefBase(BaseModel):
    module: str = Field(..., max_length=20)
    field_name: str = Field(..., max_length=50)
    field_label: Optional[str] = Field(None, max_length=100)
    field_type: str = "TEXT"
    options: Optional[str] = None
    is_required: str = "N"
    default_value: Optional[str] = None
    display_order: int = 0
    active: str = "Y"


class CustomFieldDefSave(CustomFieldDefBase):
    id: Optional[UUID] = None


class CustomFieldValueSave(BaseModel):
    field_id: UUID
    record_id: str
    value: Optional[str] = None
