"""Pydantic schemas for the subscription API (Phase 6)."""

from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class ActivationRequest(BaseModel):
    licence_id: str
    installation_id: str
    device_evidence_hash: str
    nonce: str

class ActivationResponse(BaseModel):
    activation_id: str
    lease: Dict[str, Any]
    token: Dict[str, Any]

class DeactivationRequest(BaseModel):
    reason: str

class UsageSummaryRequest(BaseModel):
    licence_id: str
    installation_id: str
    voucher_id_hash: str
    event_type: str = "VOUCHER_POST"

class BackupUploadRequest(BaseModel):
    company_id_hash: str
    backup_type: str
    target_class: str
    result: str
