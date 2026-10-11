from sqlalchemy import Column, Integer, String, Numeric, DateTime, Text, JSON, Index
from sqlalchemy import Uuid as UUID
from sqlalchemy.sql import func
from app.core.database import Base


class ProductItem(Base):
    """Goods and services. Inventory fields are conditional (track_inventory)."""

    __tablename__ = "product_item"
    __table_args__ = (
        Index("ix_product_item_company_status", "company_id", "status"),
    )

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(UUID(as_uuid=True), index=True, nullable=True)
    item_code = Column(String(50), unique=True, nullable=False, index=True)
    item_name = Column(String(100), unique=True, nullable=False, index=True)
    item_type = Column(String(1), default="G")  # G=goods S=service
    hsn_sac = Column(String(10))
    unit = Column(String(20), default="PCS")
    description = Column(Text)
    purchase_rate = Column(Numeric(15, 2))
    sale_rate = Column(Numeric(15, 2))
    gst_percent = Column(Numeric(5, 2), default=0)
    tax_category = Column(String(30))
    track_inventory = Column(String(1), default="N")
    opening_stock = Column(Numeric(15, 3), default=0)
    min_stock_level = Column(Numeric(15, 3), default=0)
    max_stock_level = Column(Numeric(15, 3), default=0)
    warehouse = Column(String(50))
    custom_fields = Column(JSON)
    status = Column(String(20), default="Active")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
