"""Subscription and Licensing Endpoints.

Implements plans, trial meters, entitlements and activations.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.company_context import get_company_id
from app.services.subscription_service import SubscriptionService
from app.services.entitlement_service import EntitlementService
from app.services.licence_service import LicenceService
from app.services.update_service import UpdateService
from app.services.backup_policy_service import BackupPolicyService
from app.schemas.response import AppResponse, Status
from app.schemas.subscription import (
    ActivationRequest, ActivationResponse, DeactivationRequest, 
    UsageSummaryRequest, BackupUploadRequest
)

router = APIRouter(prefix="/api/v1", tags=["Subscription"])
v1_compat_router = APIRouter(prefix="/v1", tags=["Subscription (Compat)"])


def _ok(data, message="Success"):
    return AppResponse(status=Status.SUCCESS, message=message, result=data).model_dump()


@router.get("/plans")
@v1_compat_router.get("/plans")
def list_plans(db: Session = Depends(get_db)):
    """List 5 subscription tiers (Trial, Solo, Multi Company, Team, Corporate)."""
    plans = SubscriptionService.list_plans(db)
    return _ok(plans, "Subscription plans")


@router.get("/plans/{plan_code}")
@v1_compat_router.get("/plans/{plan_code}")
def get_plan(plan_code: str, db: Session = Depends(get_db)):
    """Get single plan specification."""
    plan = SubscriptionService.get_plan(db, plan_code.upper())
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    return _ok(SubscriptionService.serialize_plan(plan), "Plan details")


@router.get("/subscription/trial-status")
@router.get("/subscriptions/current")
@v1_compat_router.get("/subscription/trial-status")
@v1_compat_router.get("/subscriptions/current")
def get_current_subscription_status(
    db: Session = Depends(get_db),
    company_id=Depends(get_company_id),
    current_user=Depends(get_current_user),
):
    """Returns trial status, usage meters (1000 vouchers, 50 AI pages, 30 days) and expiry state."""
    trial_status = EntitlementService.get_trial_status(db, current_user, company_id=company_id)
    return _ok(trial_status, "Current subscription & trial status")


@router.post("/subscriptions")
@v1_compat_router.post("/subscriptions")
def create_subscription(
    customer_id: str,
    plan_code: str = Query("TRIAL", description="TRIAL|SOLO|MULTI_COMPANY|TEAM|CORPORATE"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Create subscription order."""
    actor = getattr(current_user, "user_name", "admin")
    sub = SubscriptionService.create_subscription(db, customer_id, plan_code, actor=actor)
    return _ok({"subscription_id": sub.subscription_id, "status": sub.status}, "Subscription created")


@router.get("/subscriptions/{id}")
@v1_compat_router.get("/subscriptions/{id}")
def get_subscription(id: str, db: Session = Depends(get_db)):
    """Get subscription by ID."""
    return _ok({"status": "ACTIVE", "subscription_id": id}, "Subscription details")


@router.post("/activations", response_model=ActivationResponse)
@v1_compat_router.post("/activations", response_model=ActivationResponse)
def online_activation(request: ActivationRequest, db: Session = Depends(get_db)):
    """Online activation (Section 5.2)."""
    return LicenceService.activate_online(
        db, 
        request.licence_id, 
        request.installation_id, 
        request.device_evidence_hash, 
        request.nonce
    )


@router.post("/offline-activations")
@v1_compat_router.post("/offline-activations")
def offline_activation(request_file_content: dict, db: Session = Depends(get_db)):
    """Offline request exchange (Section 5.3)."""
    return LicenceService.generate_offline_response(db, request_file_content, "system")


@router.post("/activations/{id}/deactivate")
@v1_compat_router.post("/activations/{id}/deactivate")
def deactivate_device(id: str, request: DeactivationRequest, db: Session = Depends(get_db)):
    """Deactivate/rehost (Section 5.4)."""
    return LicenceService.deactivate_device(db, id, request.reason, "admin")


@router.post("/usage-summaries")
@v1_compat_router.post("/usage-summaries")
def submit_usage_summary(request: UsageSummaryRequest, db: Session = Depends(get_db)):
    """Submit usage summary for transaction metering (Section 3.2)."""
    SubscriptionService.record_usage_event(
        db, request.licence_id, request.installation_id, request.voucher_id_hash, request.event_type
    )
    return _ok({"status": "recorded"}, "Usage recorded")


@router.get("/releases/{channel}/manifest")
@v1_compat_router.get("/releases/{channel}/manifest")
def get_update_manifest(channel: str, current_version: str):
    """Update manifest (UPD-001)."""
    return UpdateService.get_update_manifest(channel, current_version)


@router.post("/backup-upload")
@v1_compat_router.post("/backup-upload")
def upload_backup_metadata(request: BackupUploadRequest, db: Session = Depends(get_db)):
    """Encrypted backup upload tracking (Section 8)."""
    record_id = BackupPolicyService.record_backup(
        db, request.company_id_hash, request.backup_type, request.target_class, request.result, "system"
    )
    return _ok({"status": "recorded", "record_id": record_id}, "Backup recorded")
