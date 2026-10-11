from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID


class UnitBase(BaseModel):
    unit_name: str = Field(..., max_length=50)
    unit_symbol: str = Field(..., max_length=10)
    active: str = "Y"


class UnitSave(UnitBase):
    id: Optional[UUID] = None
