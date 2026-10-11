from fastapi import APIRouter, Depends, File, UploadFile, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Any, Dict, List, Optional
from decimal import Decimal
from pydantic import BaseModel
from app.core.database import get_db
from app.core.deps import get_current_user
from app.schemas.response import AppResponse, Status
from app.services.data_import_service import DataImportService, BulkActionService

router = APIRouter(prefix="/api/import", tags=["Import & Bulk"])


class ImportExecuteRequest(BaseModel):
    entity: str
    rows: List[Dict[str, Any]]


class MapRequest(BaseModel):
    entity: str
    columns: List[str]
    rows: Optional[List[Dict[str, Any]]] = None
    mapping: Optional[Dict[str, Optional[str]]] = None


class BulkStatusRequest(BaseModel):
    entity: str
    ids: List[str]
    active: str


class BulkDeleteRequest(BaseModel):
    entity: str
    ids: List[str]


class BulkGstRequest(BaseModel):
    ids: List[str]
    gst_percent: Decimal


class BulkCategoryRequest(BaseModel):
    ids: List[str]
    ledger_group_id: str


def _ok(data, message):
    return JSONResponse(
        content=AppResponse(status=Status.SUCCESS, message=message, result=data).model_dump()
    )


@router.post("/upload")
async def upload_import(
    file: UploadFile = File(...),
    entity: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    content = await file.read()
    try:
        parsed = DataImportService.parse_file(file.filename or "", content)
    except ValueError as e:
        return JSONResponse(
            content=AppResponse(status=Status.ERROR, message=str(e), result=None).model_dump(),
            status_code=400,
        )
    if entity:
        parsed["suggested_mapping"] = DataImportService.suggest_mapping(
            entity, parsed["columns"]
        )
    return _ok(parsed, f"Parsed {parsed['row_count']} rows from {file.filename}")


@router.post("/map")
def map_columns(
    body: MapRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    mapping = body.mapping or DataImportService.suggest_mapping(body.entity, body.columns)
    result: Dict[str, Any] = {"mapping": mapping}
    if body.rows is not None:
        result["rows"] = DataImportService.apply_mapping(body.rows, mapping)
    return _ok(result, "Column mapping ready")


@router.post("/execute")
def execute_import(
    body: ImportExecuteRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    data = DataImportService.execute(db, body.entity, body.rows)
    return _ok(data, f"Import finished: {data['imported']} imported, {data['failed']} failed")


@router.post("/bulk-status")
def bulk_status(
    body: BulkStatusRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    data = BulkActionService.bulk_status(db, body.entity, body.ids, body.active)
    return _ok(data, f"{data['updated']} records updated")


@router.post("/bulk-delete")
def bulk_delete(
    body: BulkDeleteRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    data = BulkActionService.bulk_delete(db, body.entity, body.ids)
    msg = f"{data['deleted']} records removed"
    if data.get("skipped"):
        msg += f", {len(data['skipped'])} skipped"
    return _ok(data, msg)


@router.post("/bulk-gst")
def bulk_gst(
    body: BulkGstRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    data = BulkActionService.bulk_gst_rate(db, body.ids, body.gst_percent)
    return _ok(data, f"GST rate updated on {data['updated']} items")


@router.post("/bulk-category")
def bulk_category(
    body: BulkCategoryRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    data = BulkActionService.bulk_category(db, body.ids, body.ledger_group_id)
    return _ok(data, f"Category updated on {data['updated']} ledgers")
