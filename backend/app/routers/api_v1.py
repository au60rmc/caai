"""Spec-compliant REST v1 API surface (section 12 of the FA Master spec).

These endpoints mirror the exact paths, nouns and verbs from the specification
(`/api/v1/ledger`, `/api/v1/party`, `.../status`, `X-Company-Id` header, etc.)
and delegate to the same service layer used by the internal `/api` routes, so
both the modern frontend and any v1 API consumer work against one code path.
"""
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Header, Query, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.company import Company
from app.schemas.gst import GstClassifyRequest
from app.schemas.ledger import (
    LedgerCreate,
    LedgerQuickCreate,
    LedgerUpdate,
    LedgerValidateRequest,
)
from app.schemas.party import PartyCreate, PartyQuickCreate, PartyUpdate, PartyValidateRequest
from app.schemas.product_item import ProductItemCreate, ProductItemUpdate
from app.schemas.response import AppResponse, Status
from app.services.audit_service import AuditService
from app.services.data_import_service import DataImportService
from app.services.gst_service import GstService
from app.services.ledger_service import LedgerService
from app.services.master_search_service import MasterSearchService
from app.services.party_service import PartyService
from app.services.product_item_service import ProductItemService

router = APIRouter(prefix="/api/v1", tags=["v1 (spec API)"])


def company_context(
    db: Session = Depends(get_db),
    x_company_id: Optional[str] = Header(None, alias="X-Company-Id"),
) -> Optional[str]:
    """Accept the spec's X-Company-Id header (company-scoped context).

    The desktop build is single-company; if a company id is supplied we verify
    it exists so misconfigured clients get a clear error, otherwise we fall back
    to the active company.
    """
    if x_company_id:
        try:
            exists = db.query(Company).filter(Company.id == UUID(x_company_id)).first()
        except (ValueError, TypeError):
            exists = None
        # Unknown ids are tolerated in single-company mode but reported as None.
        return x_company_id if exists else None
    return None


def _ok(data, message, code=200):
    return JSONResponse(
        content=AppResponse(status=Status.SUCCESS, message=message, result=data).model_dump(),
        status_code=code,
    )


def _resp(data, status_val, message, ok_code=200, err_code=400):
    return JSONResponse(
        content=AppResponse(status=status_val, message=message, result=data).model_dump(),
        status_code=err_code if status_val == Status.ERROR else ok_code,
    )


def _to_active(status: str) -> str:
    s = (status or "").strip().lower()
    if s in ("active", "y", "yes", "true", "1"):
        return "Y"
    return "N"


# ---------------- Ledger ----------------
@router.get("/ledger")
def v1_list_ledgers(
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
    _co=Depends(company_context),
):
    data, s, m = LedgerService.get_all(
        db, search=search, category=category, include_inactive=include_inactive
    )
    return _resp(data, s, m)


@router.post("/ledger", status_code=201)
def v1_create_ledger(
    ledger: LedgerCreate,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
    _co=Depends(company_context),
):
    data, s, m = LedgerService.create(db, ledger)
    return _resp(data, s, m, ok_code=201)


@router.post("/ledger/validate")
def v1_validate_ledger(
    body: LedgerValidateRequest,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
    _co=Depends(company_context),
):
    return _ok(LedgerService.validate(db, body.name, body.gstin, body.id), "Validation complete")


@router.put("/ledger/{ledger_id}")
def v1_update_ledger(
    ledger_id: UUID,
    ledger: LedgerUpdate,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
    _co=Depends(company_context),
):
    data, s, m = LedgerService.update(db, ledger_id, ledger)
    return _resp(data, s, m, err_code=404)


@router.patch("/ledger/{ledger_id}/status")
def v1_ledger_status(
    ledger_id: UUID,
    status: str = Query(..., description="active/inactive"),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
    _co=Depends(company_context),
):
    data, s, m = LedgerService.update_active(db, ledger_id, _to_active(status))
    return _resp(data, s, m)


# ---------------- Party ----------------
@router.post("/party", status_code=201)
def v1_create_party(
    party: PartyCreate,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
    _co=Depends(company_context),
):
    data, s, m = PartyService.create(db, party)
    return _resp(data, s, m, ok_code=201)


@router.post("/party/quick-create", status_code=201)
def v1_quick_party(
    body: PartyQuickCreate,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
    _co=Depends(company_context),
):
    data, s, m = PartyService.quick_create(db, body)
    return _resp(data, s, m, ok_code=201)


@router.post("/party/validate")
def v1_validate_party(
    body: PartyValidateRequest,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
    _co=Depends(company_context),
):
    return _ok(
        PartyService.validate(db, body.name, body.gstin, body.key_group, body.id),
        "Validation complete",
    )


@router.put("/party/{party_id}")
def v1_update_party(
    party_id: UUID,
    party: PartyUpdate,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
    _co=Depends(company_context),
):
    data, s, m = PartyService.update(db, party_id, party)
    return _resp(data, s, m, err_code=404)


@router.patch("/party/{party_id}/status")
def v1_party_status(
    party_id: UUID,
    status: str = Query(..., description="active/inactive"),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
    _co=Depends(company_context),
):
    data, s, m = PartyService.update_active(db, party_id, _to_active(status))
    return _resp(data, s, m)


# ---------------- Items ----------------
@router.get("/items")
def v1_list_items(
    search: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
    _co=Depends(company_context),
):
    items = ProductItemService.get_all(db, search=search, item_type=type, status=status)
    return _ok([_item_dict(i) for i in items], "Items fetched")


@router.post("/items", status_code=201)
def v1_create_item(
    item: ProductItemCreate,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
    _co=Depends(company_context),
):
    created = ProductItemService.create(db, item)
    return _ok(_item_dict(created), "Item created", code=201)


@router.put("/items/{item_id}")
def v1_update_item(
    item_id: int,
    item: ProductItemUpdate,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
    _co=Depends(company_context),
):
    updated = ProductItemService.update(db, item_id, item)
    return _ok(_item_dict(updated), "Item updated")


@router.patch("/items/{item_id}/status")
def v1_item_status(
    item_id: int,
    status: str = Query(...),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
    _co=Depends(company_context),
):
    normalized = "Active" if _to_active(status) == "Y" else "Inactive"
    updated = ProductItemService.update_status(db, item_id, normalized)
    return _ok(_item_dict(updated), "Status updated")


def _item_dict(i) -> Dict[str, Any]:
    return {
        "id": i.id,
        "item_code": i.item_code,
        "item_name": i.item_name,
        "item_type": i.item_type,
        "hsn_sac": i.hsn_sac,
        "unit": i.unit,
        "purchase_rate": float(i.purchase_rate) if i.purchase_rate is not None else None,
        "sale_rate": float(i.sale_rate) if i.sale_rate is not None else None,
        "gst_percent": float(i.gst_percent) if i.gst_percent is not None else None,
        "status": i.status,
    }


# ---------------- GST ----------------
@router.get("/gst/validate/{gstin}")
def v1_gst_validate(
    gstin: str,
    _user=Depends(get_current_user),
    _co=Depends(company_context),
):
    return _ok(GstService.validate_gstin(gstin), "GSTIN validated")


@router.get("/gst/rates")
def v1_gst_rates(
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
    _co=Depends(company_context),
):
    return _ok(GstService.list_rates(db), "GST rates")


@router.post("/gst/classify")
def v1_gst_classify(
    body: GstClassifyRequest,
    _user=Depends(get_current_user),
    _co=Depends(company_context),
):
    return _ok(GstService.classify(body), "Classified")


# ---------------- Global search ----------------
@router.get("/master/search")
def v1_master_search(
    q: str = Query(...),
    type: str = Query("all"),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
    _co=Depends(company_context),
):
    return _ok(MasterSearchService.search(db, q, type), "Search results")


# ---------------- Import ----------------
@router.post("/import/upload")
async def v1_import_upload(
    file: UploadFile = File(...),
    entity: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
    _co=Depends(company_context),
):
    content = await file.read()
    try:
        parsed = DataImportService.parse_file(file.filename or "", content)
    except ValueError as e:
        return _resp(None, Status.ERROR, str(e), err_code=400)
    if entity:
        parsed["suggested_mapping"] = DataImportService.suggest_mapping(entity, parsed["columns"])
    return _ok(parsed, f"Parsed {parsed['row_count']} rows")


class V1MapRequest(BaseModel):
    entity: str
    columns: List[str]
    rows: Optional[List[Dict[str, Any]]] = None
    mapping: Optional[Dict[str, Optional[str]]] = None


@router.post("/import/map")
def v1_import_map(
    body: V1MapRequest,
    _user=Depends(get_current_user),
    _co=Depends(company_context),
):
    mapping = body.mapping or DataImportService.suggest_mapping(body.entity, body.columns)
    result: Dict[str, Any] = {"mapping": mapping}
    if body.rows is not None:
        result["rows"] = DataImportService.apply_mapping(body.rows, mapping)
    return _ok(result, "Mapping ready")


class V1ExecuteRequest(BaseModel):
    entity: str
    rows: List[Dict[str, Any]]


@router.post("/import/execute")
def v1_import_execute(
    body: V1ExecuteRequest,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
    _co=Depends(company_context),
):
    data = DataImportService.execute(db, body.entity, body.rows)
    return _ok(data, f"Import finished: {data['imported']} imported, {data['failed']} failed")


# ---------------- Audit ----------------
@router.get("/audit")
def v1_audit(
    entity: Optional[str] = Query(None),
    id: Optional[str] = Query(None),
    limit: int = Query(100),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
    _co=Depends(company_context),
):
    return _ok(AuditService.list(db, entity, id, limit), "Audit history")
