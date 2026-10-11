from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from app.core.database import get_db
from app.core.deps import get_current_user, require_permission
from app.core.company_context import get_company_id
from app.core.feature_codes import FEATURE_ITEMS
from app.schemas.product_item import (
    ProductItemCreate,
    ProductItemUpdate,
    ProductItemResponse,
    ItemQuickCreate,
    ItemValidateRequest,
)
from app.services.product_item_service import ProductItemService

router = APIRouter(prefix="/api/items", tags=["Product/Item"])


@router.get("", response_model=List[ProductItemResponse])
def get_items(
    skip: int = 0,
    limit: int = 500,
    status: Optional[str] = None,
    search: Optional[str] = Query(None),
    item_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    company_id: Optional[UUID] = Depends(get_company_id),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_ITEMS, "view")),
):
    return ProductItemService.get_all(
        db, skip, limit, status, search, item_type, company_id=company_id
    )


@router.post("/validate")
def validate_item(
    body: ItemValidateRequest,
    db: Session = Depends(get_db),
    company_id: Optional[UUID] = Depends(get_company_id),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_ITEMS, "view")),
):
    return {
        "status": "SUCCESS",
        "result": ProductItemService.validate(
            db, body.item_code, body.item_name, body.id, company_id=company_id
        ),
    }


@router.post(
    "/quick-create",
    response_model=ProductItemResponse,
    status_code=status.HTTP_201_CREATED,
)
def quick_create_item(
    body: ItemQuickCreate,
    db: Session = Depends(get_db),
    company_id: Optional[UUID] = Depends(get_company_id),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_ITEMS, "write")),
):
    return ProductItemService.quick_create(db, body, company_id=company_id)


@router.get("/{item_id}", response_model=ProductItemResponse)
def get_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_ITEMS, "view")),
):
    return ProductItemService.get_by_id(db, item_id)


@router.post(
    "", response_model=ProductItemResponse, status_code=status.HTTP_201_CREATED
)
def create_item(
    item: ProductItemCreate,
    db: Session = Depends(get_db),
    company_id: Optional[UUID] = Depends(get_company_id),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_ITEMS, "write")),
):
    return ProductItemService.create(db, item, company_id=company_id)


@router.put("/{item_id}", response_model=ProductItemResponse)
def update_item(
    item_id: int,
    item: ProductItemUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_ITEMS, "write")),
):
    return ProductItemService.update(db, item_id, item)


@router.patch("/{item_id}/status", response_model=ProductItemResponse)
def update_item_status(
    item_id: int,
    item_status: str = Query(..., alias="status"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_ITEMS, "write")),
):
    if item_status not in ["Active", "Inactive"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status value"
        )
    return ProductItemService.update_status(db, item_id, item_status)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_ITEMS, "delete")),
):
    ProductItemService.delete(db, item_id)
    return None
