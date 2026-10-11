from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import uuid


class LovBase(BaseModel):
    key_grp: str = Field(..., max_length=50)
    key_txt: str = Field(..., max_length=100)
    key_value: str = Field(..., max_length=50)
    active: str = "Y"
    display_order: int = 0
    key_type: str = "G"


class LovCreate(LovBase):
    pass


class LovUpdate(BaseModel):
    key_grp: Optional[str] = Field(None, max_length=50)
    key_txt: Optional[str] = Field(None, max_length=100)
    key_value: Optional[str] = Field(None, max_length=50)
    active: Optional[str] = None
    display_order: Optional[int] = None
    key_type: Optional[str] = None


class LovItem(BaseModel):
    key_text: str
    key_value: str
    dis_order: int


class LovGroupedResponse(BaseModel):
    id: uuid.UUID
    key_grp: str
    key_type: str
    items: List[LovItem]
    created_by: str
    updated_by: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LovResponse(LovBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
