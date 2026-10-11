from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.core.deps import get_current_user, require_permission
from app.core.feature_codes import FEATURE_GST_SETUP
from app.schemas.gst import GstRateSave, HsnCodeSave, GstClassifyRequest
from app.schemas.response import AppResponse, Status
from app.services.gst_service import GstService, STATE_CODES

router = APIRouter(prefix="/api/gst", tags=["GST"])


def _ok(data, message="OK"):
    return JSONResponse(
        content=AppResponse(status=Status.SUCCESS, message=message, result=data).model_dump()
    )


@router.get("/validate/{gstin}")
def validate_gstin(
    gstin: str,
    current_user=Depends(get_current_user),
):
    return _ok(GstService.validate_gstin(gstin), "GSTIN validated")


@router.get("/validate-pan/{pan}")
def validate_pan(
    pan: str,
    current_user=Depends(get_current_user),
):
    return _ok(GstService.validate_pan(pan), "PAN validated")


@router.get("/states")
def get_states(current_user=Depends(get_current_user)):
    return _ok(
        [{"code": k, "name": v} for k, v in sorted(STATE_CODES.items())],
        "State codes fetched",
    )


@router.post("/classify")
def classify(
    body: GstClassifyRequest,
    current_user=Depends(get_current_user),
):
    return _ok(GstService.classify(body), "Classified")


@router.get("/rates")
def get_rates(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return _ok(GstService.list_rates(db), "GST rates fetched")


@router.post("/rates/bulk-save", status_code=201)
def save_rates(
    items: List[GstRateSave],
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_GST_SETUP, "write")),
):
    GstService.save_rates(db, items)
    return _ok(None, "GST rates saved")


@router.get("/hsn")
def get_hsn(
    q: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return _ok(GstService.list_hsn(db, q), "HSN codes fetched")


@router.get("/hsn/suggest")
def suggest_hsn(
    description: str = Query(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return _ok(GstService.suggest_hsn(db, description), "Suggestions computed")


@router.post("/hsn/bulk-save", status_code=201)
def save_hsn(
    items: List[HsnCodeSave],
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_GST_SETUP, "write")),
):
    GstService.save_hsn(db, items)
    return _ok(None, "HSN codes saved")
