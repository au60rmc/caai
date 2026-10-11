from fastapi import APIRouter, Depends, File, UploadFile, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from app.core.company_context import get_company_id
from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.schemas.response import AppResponse, Status
from app.services import docling_service
from app.services import document_extract_service
from app.services import document_match_service

router = APIRouter(prefix="/api/documents", tags=["AI Documents"])


def _ok(data, message):
    return JSONResponse(
        content=AppResponse(status=Status.SUCCESS, message=message, result=data).model_dump()
    )


@router.get("/status")
def doc_status(current_user=Depends(get_current_user)):
    ok, ver = docling_service.docling_available()
    return _ok(
        {
            "docling": ver,
            "available": ok,
            "full_pipeline": docling_service._use_docling(),
            "allowed": sorted(docling_service.ALLOWED_EXTS),
            "max_mb": docling_service.MAX_FILE_MB,
        },
        "Docling status",
    )


@router.post("/parse")
async def parse_document(
    file: UploadFile = File(...),
    target: str = Query("SALES", description="SALES|PURCHASE|PAYMENT|RECEIPT|JOURNAL|CONTRA|ACCOUNTING"),
    tier: str = Query("auto", description="auto|low|high"),
    db: Session = Depends(get_db),
    company_id=Depends(get_company_id),
    current_user=Depends(get_current_user),
):
    content = await file.read()
    try:
        docling_service.validate_upload(file.filename or "", len(content))
    except ValueError as e:
        return JSONResponse(
            content=AppResponse(status=Status.ERROR, message=str(e), result=None).model_dump(),
            status_code=400,
        )
    target = (target or "SALES").upper()
    if target not in ("SALES", "PURCHASE", "PAYMENT", "RECEIPT", "JOURNAL", "CONTRA", "ACCOUNTING"):
        target = "SALES"
    from app.services.entitlement_service import EntitlementService
    try:
        EntitlementService.assert_ai_document_processing_allowed(db, user=current_user, pages=1)
    except HTTPException as e:
        return JSONResponse(
            content=AppResponse(status=Status.ERROR, message=e.detail, result=None).model_dump(),
            status_code=403,
        )
    try:
        parsed = docling_service.convert_to_text(file.filename or "upload", content, tier=tier)
        EntitlementService.record_ai_document_pages(db, pages=1, user=current_user)
    except RuntimeError as e:
        return JSONResponse(
            content=AppResponse(status=Status.ERROR, message=str(e), result=None).model_dump(),
            status_code=503,
        )
    except Exception as e:  # Docling conversion failed
        return JSONResponse(
            content=AppResponse(
                status=Status.ERROR, message=f"Could not parse file: {e}", result=None
            ).model_dump(),
            status_code=422,
        )
    extracted = document_extract_service.extract(parsed, target=target)
    # Read-only counterparty suggestions (stateless: no writes).
    data = {
        "filename": file.filename,
        "target": target,
        "tier_used": parsed.get("tier_used"),
        "degraded": bool(parsed.get("degraded", False)),
        **extracted,
        "candidates": _candidates(db, company_id, target, extracted),
    }
    return _ok(data, f"Parsed {file.filename} (confidence {extracted['confidence']}%)")


def _candidates(db, company_id, target, extracted):
    is_sales_side = target in ("SALES", "RECEIPT")
    cp_gstin = extracted["fields"]["buyer_gstin"] if is_sales_side else extracted["fields"]["seller_gstin"]
    cp_hint = extracted["fields"]["buyer_name_hint"] if is_sales_side else extracted["fields"]["seller_name_hint"]
    try:
        return document_match_service.find_party_candidates(
            db, company_id, target, cp_gstin, cp_hint
        )
    except Exception:
        return []


@router.post("/parse-batch")
async def parse_batch(
    file: UploadFile = File(...),
    target: str = Query("SALES", description="SALES|PURCHASE|PAYMENT|RECEIPT|JOURNAL|CONTRA|ACCOUNTING"),
    tier: str = Query("auto", description="auto|low|high"),
    db: Session = Depends(get_db),
    company_id=Depends(get_company_id),
    current_user=Depends(get_current_user),
):
    """Parse a ZIP of documents (same or mixed types), one draft per file.

    Caps: 20 files / 50MB total (stateless, sequential, per-file degrade).
    The caller reviews each draft and applies them one by one.
    """
    content = await file.read()
    try:
        docling_service.validate_zip_upload(file.filename or "", len(content))
        members, skipped = docling_service.extract_zip_members(content)
    except ValueError as e:
        return JSONResponse(
            content=AppResponse(status=Status.ERROR, message=str(e), result=None).model_dump(),
            status_code=400,
        )
    if target not in ("SALES", "PURCHASE", "PAYMENT", "RECEIPT", "JOURNAL", "CONTRA", "ACCOUNTING"):
        target = "SALES"
    from app.services.entitlement_service import EntitlementService
    try:
        EntitlementService.assert_ai_document_processing_allowed(db, user=current_user, pages=len(members))
    except HTTPException as e:
        return JSONResponse(
            content=AppResponse(status=Status.ERROR, message=e.detail, result=None).model_dump(),
            status_code=403,
        )
    files = []
    for m in members:
        try:
            parsed = docling_service.convert_to_text(m["filename"], m["content"], tier=tier)
            extracted = document_extract_service.extract(parsed, target=target)
            files.append({
                "filename": m["filename"],
                "ok": True,
                "tier_used": parsed.get("tier_used"),
                "degraded": bool(parsed.get("degraded", False)),
                **extracted,
                "candidates": _candidates(db, company_id, target, extracted),
            })
        except Exception as e:  # per-file failure must not sink the batch
            files.append({"filename": m["filename"], "ok": False, "error": str(e)[:300]})
    for s in skipped:
        files.append({"filename": s["filename"], "ok": False, "error": f"Skipped: {s['reason']}"})
    ok_n = sum(1 for f in files if f.get("ok"))
    data = {
        "filename": file.filename,
        "target": target,
        "files": files,
        "succeeded": ok_n,
        "failed": len(files) - ok_n,
    }
    return _ok(data, f"Batch parsed: {ok_n} ok, {len(files) - ok_n} failed")
