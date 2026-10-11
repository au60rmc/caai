"""Cryptography and key management service.

Implements:
- Section 7.1: AES-256-GCM envelope encryption for company data and backups
- Section 7.2 / Table 13: Key hierarchy (Vendor -> Installation -> Company)
- Section 7.3: Key lifecycle
"""

from __future__ import annotations

import os
import logging
from typing import Tuple, Dict

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.models.subscription import KeyRegistry

logger = logging.getLogger(__name__)

# Master vendor key (mocked for this implementation; should be KMS/HSM backed)
# This acts as the Root of Trust
_VENDOR_MASTER_KEY = os.environ.get("VENDOR_MASTER_KEY", b"32_byte_vendor_master_key_12345!").ljust(32, b"0")[:32]

class CryptoService:
    """Manages encryption, decryption, and key lifecycle."""

    @staticmethod
    def _get_key_from_registry(db: Session, key_id: str) -> bytes:
        """Retrieve and unwrap a key from the registry."""
        registry_entry = db.query(KeyRegistry).filter(KeyRegistry.key_id == key_id).first()
        if not registry_entry:
            raise HTTPException(status_code=500, detail="Key not found in registry")
            
        if registry_entry.status in ("RETIRED", "DESTROYED"):
            # Can decrypt with retired keys, but usually shouldn't encrypt
            pass
            
        # In a real system, `wrapped_key_material` would be decrypted using the parent key in the hierarchy.
        # For this prototype, we'll assume the wrapped key material is just the AES-256-GCM key material
        # directly encrypted with the _VENDOR_MASTER_KEY.
        aesgcm = AESGCM(_VENDOR_MASTER_KEY)
        
        try:
            # We assume the wrapped key has the nonce prepended: [nonce(12)][ciphertext]
            wrapped_data = bytes.fromhex(registry_entry.wrapped_key_material)
            nonce = wrapped_data[:12]
            ciphertext = wrapped_data[12:]
            unwrapped_key = aesgcm.decrypt(nonce, ciphertext, None)
            return unwrapped_key
        except Exception as e:
            logger.error(f"Failed to unwrap key {key_id}: {str(e)}")
            raise HTTPException(status_code=500, detail="Key decryption failed")

    @staticmethod
    def generate_key(db: Session, purpose: str, owner_id: str) -> str:
        """Section 7.3.1: Generate a new key using OS CSPRNG."""
        # Generate 32 bytes (256 bits) for AES-256
        raw_key = os.urandom(32)
        
        # Wrap key using Vendor Master Key
        aesgcm = AESGCM(_VENDOR_MASTER_KEY)
        nonce = os.urandom(12)
        ciphertext = aesgcm.encrypt(nonce, raw_key, None)
        wrapped_key_hex = (nonce + ciphertext).hex()
        
        # Determine rotation date (1 year standard)
        now = datetime.now(timezone.utc)
        
        registry_entry = KeyRegistry(
            purpose=purpose,
            algorithm="AES-256-GCM",
            owner=owner_id,
            wrapped_key_material=wrapped_key_hex,
            created_at=now,
            activated_at=now,
            status="ACTIVE"
        )
        db.add(registry_entry)
        db.commit()
        db.refresh(registry_entry)
        
        return registry_entry.key_id

    @staticmethod
    def encrypt_data(db: Session, key_id: str, plaintext: bytes, associated_data: bytes = None) -> bytes:
        """Section 7.1: AES-256-GCM encryption."""
        key = CryptoService._get_key_from_registry(db, key_id)
        aesgcm = AESGCM(key)
        
        nonce = os.urandom(12)
        ciphertext = aesgcm.encrypt(nonce, plaintext, associated_data)
        
        # Return prepended nonce
        return nonce + ciphertext

    @staticmethod
    def decrypt_data(db: Session, key_id: str, encrypted_data: bytes, associated_data: bytes = None) -> bytes:
        """Section 7.1: AES-256-GCM decryption."""
        key = CryptoService._get_key_from_registry(db, key_id)
        aesgcm = AESGCM(key)
        
        nonce = encrypted_data[:12]
        ciphertext = encrypted_data[12:]
        
        try:
            plaintext = aesgcm.decrypt(nonce, ciphertext, associated_data)
            return plaintext
        except Exception as e:
            logger.error(f"Decryption failed for key {key_id}: {str(e)}")
            raise HTTPException(status_code=500, detail="Data decryption failed. Integrity check error.")

    @staticmethod
    def rotate_key(db: Session, old_key_id: str) -> str:
        """Section 7.3.3: Key rotation."""
        old_entry = db.query(KeyRegistry).filter(KeyRegistry.key_id == old_key_id).first()
        if not old_entry:
            raise HTTPException(status_code=404, detail="Key not found")
            
        new_key_id = CryptoService.generate_key(db, old_entry.purpose, old_entry.owner)
        
        # Retire the old key (decrypt-only)
        old_entry.status = "RETIRED"
        old_entry.retired_at = datetime.now(timezone.utc)
        db.commit()
        
        return new_key_id

    @staticmethod
    def zeroize_key(db: Session, key_id: str):
        """Section 7.3.5: Cryptographic erasure (zeroization)."""
        entry = db.query(KeyRegistry).filter(KeyRegistry.key_id == key_id).first()
        if not entry:
            raise HTTPException(status_code=404, detail="Key not found")
            
        # Overwrite wrapped material with zero-bytes (as hex string)
        entry.wrapped_key_material = ("00" * 32)
        entry.status = "DESTROYED"
        entry.destroyed_at = datetime.now(timezone.utc)
        db.commit()
