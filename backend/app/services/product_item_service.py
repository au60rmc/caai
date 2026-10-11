from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func
from app.models.product_item import ProductItem
from app.schemas.product_item import (
    ProductItemCreate,
    ProductItemUpdate,
    ItemQuickCreate,
)
from fastapi import HTTPException, status
from typing import List, Optional, Dict, Any
from uuid import UUID


class ProductItemService:
    @staticmethod
    def get_all(
        db: Session,
        skip: int = 0,
        limit: int = 500,
        status: Optional[str] = None,
        search: Optional[str] = None,
        item_type: Optional[str] = None,
        company_id: Optional[UUID] = None,
    ) -> List[ProductItem]:
        if company_id is None:
            return []
        query = db.query(ProductItem).filter(ProductItem.company_id == company_id)
        if status:
            query = query.filter(ProductItem.status == status)
        if item_type:
            query = query.filter(ProductItem.item_type == item_type)
        if search:
            like = f"%{search}%"
            query = query.filter(
                (ProductItem.item_name.ilike(like))
                | (ProductItem.item_code.ilike(like))
                | (ProductItem.hsn_sac.ilike(like))
            )
        return query.order_by(ProductItem.item_name).offset(skip).limit(limit).all()

    @staticmethod
    def get_by_id(db: Session, item_id: int) -> ProductItem:
        item = db.query(ProductItem).filter(ProductItem.id == item_id).first()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Item not found"
            )
        return item

    @staticmethod
    def get_by_code(
        db: Session, item_code: str, company_id: Optional[UUID] = None
    ) -> Optional[ProductItem]:
        q = db.query(ProductItem).filter(ProductItem.item_code == item_code)
        if company_id is not None:
            q = q.filter(ProductItem.company_id == company_id)
        return q.first()

    @staticmethod
    def get_by_name(
        db: Session, item_name: str, company_id: Optional[UUID] = None
    ) -> Optional[ProductItem]:
        q = db.query(ProductItem).filter(
            sa_func.lower(ProductItem.item_name) == item_name.strip().lower()
        )
        if company_id is not None:
            q = q.filter(ProductItem.company_id == company_id)
        return q.first()

    @staticmethod
    def validate(
        db: Session,
        item_code: Optional[str],
        item_name: Optional[str],
        exclude_id: Optional[int] = None,
        company_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        out: Dict[str, Any] = {"item_code": None, "item_name": None}
        if item_code is not None:
            dup = ProductItemService.get_by_code(db, item_code, company_id=company_id)
            if dup and (not exclude_id or dup.id != exclude_id):
                out["item_code"] = {"level": "error", "message": "Item code already exists"}
            else:
                out["item_code"] = {"level": "ok", "message": "Code is available"}
        if item_name is not None:
            dup = ProductItemService.get_by_name(db, item_name, company_id=company_id)
            if dup and (not exclude_id or dup.id != exclude_id):
                out["item_name"] = {"level": "error", "message": "Item name already exists"}
            else:
                out["item_name"] = {"level": "ok", "message": "Name is available"}
        return out

    @staticmethod
    def next_code(db: Session, company_id: Optional[UUID] = None) -> str:
        q = db.query(ProductItem)
        if company_id is not None:
            q = q.filter(ProductItem.company_id == company_id)
        n = q.count() + 1
        while True:
            code = f"ITEM{str(n).zfill(3)}"
            if not ProductItemService.get_by_code(db, code, company_id=company_id):
                return code
            n += 1

    @staticmethod
    def create(
        db: Session, item: ProductItemCreate, company_id: Optional[UUID] = None
    ) -> ProductItem:
        existing_code = ProductItemService.get_by_code(
            db, item.item_code, company_id=company_id
        )
        if existing_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Item code already exists",
            )

        existing_name = ProductItemService.get_by_name(
            db, item.item_name, company_id=company_id
        )
        if existing_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Item name already exists",
            )

        data = item.model_dump()
        if company_id is not None:
            data["company_id"] = company_id
        db_item = ProductItem(**data)
        db.add(db_item)
        db.commit()
        db.refresh(db_item)
        return db_item

    @staticmethod
    def quick_create(
        db: Session, data: ItemQuickCreate, company_id: Optional[UUID] = None
    ) -> ProductItem:
        payload = ProductItemCreate(
            item_code=ProductItemService.next_code(db, company_id=company_id),
            item_name=data.item_name,
            item_type=data.item_type or "G",
            hsn_sac=data.hsn_sac,
            gst_percent=data.gst_percent or 0,
        )
        return ProductItemService.create(db, payload, company_id=company_id)

    @staticmethod
    def update(db: Session, item_id: int, item: ProductItemUpdate) -> ProductItem:
        db_item = ProductItemService.get_by_id(db, item_id)

        if item.item_code != db_item.item_code:
            existing = ProductItemService.get_by_code(db, item.item_code)
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Item code already exists",
                )

        if item.item_name != db_item.item_name:
            existing = ProductItemService.get_by_name(db, item.item_name)
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Item name already exists",
                )

        for key, value in item.model_dump().items():
            setattr(db_item, key, value)

        db.commit()
        db.refresh(db_item)
        return db_item

    @staticmethod
    def update_status(db: Session, item_id: int, status: str) -> ProductItem:
        db_item = ProductItemService.get_by_id(db, item_id)
        db_item.status = status
        db.commit()
        db.refresh(db_item)
        return db_item

    @staticmethod
    def delete(db: Session, item_id: int) -> None:
        db_item = ProductItemService.get_by_id(db, item_id)
        # Soft delete per spec: items used in vouchers must never be hard-deleted.
        db_item.status = "Inactive"
        db.commit()
