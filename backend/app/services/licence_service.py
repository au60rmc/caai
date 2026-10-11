"""Licence and activation service.

Implements:
- Section 5.1: Signed entitlement token with ECDSA P-256
- Section 5.2: Online activation (exchange nonce and identity for lease)
- Section 5.3: Offline activation (file-based challenge/response)
- Section 5.4: Device binding and rehost
- Table 9    : Lease state and refresh intervals
"""

from __future__ import annotations

import json
import logging
import uuid as _uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization

from app.models.subscription import (
    Subscription, SubscriptionPlan, Licence, Activation, Lease,
    EntitlementToken, LicenceCustomer
)
from app.services.subscription_service import _audit

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Mock HSM / KMS (Section 5.1 Warning)
# ---------------------------------------------------------------------------
# In a real deployment, the private key never enters the application memory.
# It lives in AWS KMS, Azure Key Vault, or GCP Cloud HSM.
# For this implementation, we generate a persistent ECDSA key in memory
# to demonstrate the signature validation.

_SIGNING_KEY = ec.generate_private_key(ec.SECP256R1())
_PUBLIC_KEY = _SIGNING_KEY.public_key()
_KEY_ID = "KMS-KEY-2026-A1"

def _sign_payload(payload_bytes: bytes) -> bytes:
    """Mock KMS sign operation."""
    return _SIGNING_KEY.sign(payload_bytes, ec.ECDSA(hashes.SHA256()))

def get_public_key_pem() -> bytes:
    """Export public key to distribute to the desktop client."""
    return _PUBLIC_KEY.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )


class LicenceService:
    """Manages immutable licences, activations, leases and tokens."""

    @staticmethod
    def issue_licence(db: Session, subscription_id: str, actor: str = "system") -> Licence:
        """Create an immutable licence identity attached to a subscription."""
        sub = db.query(Subscription).filter(Subscription.subscription_id == subscription_id).first()
        if not sub:
            raise HTTPException(status_code=404, detail="Subscription not found")

        plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == sub.plan_id).first()
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")

        # Idempotency: one licence per subscription
        existing = db.query(Licence).filter(Licence.subscription_id == sub.id).first()
        if existing:
            return existing

        licence = Licence(
            licence_id=f"LIC-{_uuid.uuid4().hex[:12].upper()}",
            product_id="CAAI_FA",
            customer_id=sub.customer_id,
            subscription_id=sub.id,
            edition=plan.edition,
            status="ACTIVE",
        )
        db.add(licence)
        db.commit()
        db.refresh(licence)

        _audit(db, actor, "LICENCE_CREATE", licence.licence_id, "LICENCE")
        return licence


    @staticmethod
    def create_entitlement_token(db: Session, licence_id: str, nonce: str) -> dict:
        """Create a signed vendor entitlement token (Section 5.1).

        This token is the authoritative source of truth for offline clients.
        """
        licence = db.query(Licence).filter(Licence.licence_id == licence_id).first()
        if not licence:
            raise HTTPException(status_code=404, detail="Licence not found")

        sub = db.query(Subscription).filter(Subscription.id == licence.subscription_id).first()
        plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == sub.plan_id).first()
        customer = db.query(LicenceCustomer).filter(LicenceCustomer.id == licence.customer_id).first()

        # Build claims (Table 8)
        claims = {
            "schema_version": 1,
            "licence_id": licence.licence_id,
            "customer_id": customer.customer_id,
            "product_id": licence.product_id,
            "edition": licence.edition,
            "order_id": sub.order_id,
            "entitlements": {
                "max_companies": plan.max_companies,
                "max_named_users": plan.max_named_users,
                "max_concurrent_sessions": plan.max_concurrent_sessions,
                "transaction_limit": plan.transaction_limit,
                "metering_period": plan.metering_period,
                "feature_flags": json.loads(plan.feature_flags or "{}"),
            },
            "validity": {
                "subscription_start": str(sub.start_date),
                "subscription_end": str(sub.end_date),
                "grace_end": str(sub.grace_end_date),
                "server_time": datetime.now(timezone.utc).isoformat(),
            },
            "policy": {
                "backup_enforcement_profile": "STANDARD",
                "support_tier": plan.support_tier,
            },
            "nonce": nonce,
            "token_id": f"TOK-{_uuid.uuid4().hex[:12].upper()}",
            "key_id": _KEY_ID,
            "algorithm": "ECDSA-P256-SHA256"
        }

        # Canonicalize and sign
        payload_json = json.dumps(claims, separators=(',', ':'), sort_keys=True)
        signature = _sign_payload(payload_json.encode('utf-8'))

        claims["signature"] = signature.hex()
        return claims


    # ------------------------------------------------------------------
    # Activations (Section 5.2 / 5.3)
    # ------------------------------------------------------------------

    @staticmethod
    def activate_online(
        db: Session,
        licence_id: str,
        installation_id: str,
        device_evidence_hash: str,
        nonce: str,
        actor: str = "system"
    ) -> dict:
        """Step 2-4: Service validates risk rules and returns signed lease."""
        licence = db.query(Licence).filter(Licence.licence_id == licence_id).first()
        if not licence or licence.status != "ACTIVE":
            raise HTTPException(status_code=400, detail="Invalid or inactive licence")

        sub = db.query(Subscription).filter(Subscription.id == licence.subscription_id).first()
        if sub.status not in ("ACTIVE", "GRACE", "PAST_DUE"):
            raise HTTPException(status_code=400, detail=f"Subscription is {sub.status}")

        plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == sub.plan_id).first()
        max_devices = 1 if plan.deployment_model == "ONE_DEVICE" else 3  # Simplified rule

        # Check existing active activations
        active_count = db.query(Activation).filter(
            Activation.licence_id == licence.id,
            Activation.status == "ACTIVE"
        ).count()

        activation = db.query(Activation).filter(
            Activation.licence_id == licence.id,
            Activation.installation_id == installation_id
        ).first()

        if not activation:
            if active_count >= max_devices:
                raise HTTPException(status_code=400, detail="Device limit reached. Rehost required.")
            activation = Activation(
                activation_id=f"ACT-{_uuid.uuid4().hex[:12].upper()}",
                licence_id=licence.id,
                installation_id=installation_id,
                device_evidence_hash=device_evidence_hash,
                status="ACTIVE"
            )
            db.add(activation)
            db.commit()
            db.refresh(activation)
            _audit(db, actor, "ACTIVATE", activation.activation_id, "ACTIVATION")
        elif activation.status != "ACTIVE":
            activation.status = "ACTIVE"
            db.commit()
            _audit(db, actor, "REACTIVATE", activation.activation_id, "ACTIVATION")

        # Create lease (Table 9)
        now = datetime.now(timezone.utc)
        lease_days = 30  # Table 25 default
        lease_end = now + timedelta(days=lease_days)
        grace_end = lease_end + timedelta(days=14)

        token_claims = LicenceService.create_entitlement_token(db, licence.licence_id, nonce)

        lease = Lease(
            lease_id=f"LSE-{_uuid.uuid4().hex[:12].upper()}",
            activation_id=activation.id,
            token_id=token_claims["token_id"],
            key_id=_KEY_ID,
            issued_at=now,
            lease_end=lease_end,
            grace_end=grace_end,
            offline_lease_days=lease_days,
            status="ACTIVE",
            created_by=actor
        )
        db.add(lease)
        db.commit()

        return {
            "activation_id": activation.activation_id,
            "lease": {
                "lease_id": lease.lease_id,
                "issued_at": lease.issued_at.isoformat(),
                "lease_end": lease.lease_end.isoformat(),
                "grace_end": lease.grace_end.isoformat(),
            },
            "token": token_claims
        }


    @staticmethod
    def generate_offline_response(
        db: Session,
        request_file_content: dict,
        actor: str
    ) -> dict:
        """Section 5.3: Offline activation response generation.

        Customer transfers a JSON request file from air-gapped PC to Portal.
        Portal validates and returns a signed response.
        """
        licence_id = request_file_content.get("licence_id")
        installation_id = request_file_content.get("installation_id")
        evidence = request_file_content.get("device_evidence_hash")
        nonce = request_file_content.get("nonce")

        if not all([licence_id, installation_id, evidence, nonce]):
            raise HTTPException(status_code=400, detail="Invalid offline request file")

        # Uses the exact same validation logic as online activation
        response = LicenceService.activate_online(
            db,
            licence_id=licence_id,
            installation_id=installation_id,
            device_evidence_hash=evidence,
            nonce=nonce,
            actor=actor
        )
        response["is_offline_response"] = True
        return response


    # ------------------------------------------------------------------
    # Rehost (Section 5.4)
    # ------------------------------------------------------------------

    @staticmethod
    def deactivate_device(
        db: Session,
        activation_id: str,
        reason: str,
        actor: str
    ) -> dict:
        """Deactivate a reachable or lost device to free the slot (Table 20)."""
        activation = db.query(Activation).filter(Activation.activation_id == activation_id).first()
        if not activation:
            raise HTTPException(status_code=404, detail="Activation not found")

        if activation.status != "ACTIVE":
            raise HTTPException(status_code=400, detail=f"Activation is already {activation.status}")

        activation.status = "DEACTIVATED"
        activation.deactivated_at = datetime.now(timezone.utc)
        activation.deactivation_reason = reason
        db.commit()

        # Revoke active leases
        db.query(Lease).filter(
            Lease.activation_id == activation.id,
            Lease.status == "ACTIVE"
        ).update({"status": "REVOKED"})
        db.commit()

        _audit(db, actor, "DEACTIVATE", activation.activation_id, "ACTIVATION",
               after_state=json.dumps({"reason": reason}))

        return {"status": "success", "activation_id": activation_id}
