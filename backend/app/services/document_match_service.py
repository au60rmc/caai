"""Read-only party/ledger candidate matching for AI extraction (stateless).

No writes: queries active company parties and ranks them against the
scanned GSTIN + name hints so the frontend can pre-select the counterparty.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.party import Party

# Counterparty groups per voucher target.
TARGET_GROUPS = {
    "SALES": ("C", "B"),      # buyer is a customer (or both)
    "PURCHASE": ("V", "B"),   # seller is a vendor (or both)
    "PAYMENT": ("V", "B"),
    "RECEIPT": ("C", "B"),
}


def party_display_name(p: Party) -> str:
    n = p.name_contact_info or {}
    return n.get("display_name") or n.get("company_name") or n.get("first_name") or ""


def find_party_candidates(
    db: Session,
    company_id: Optional[UUID],
    target: str,
    gstin: str,
    name_hint: str,
    limit: int = 3,
) -> List[Dict[str, Any]]:
    groups = TARGET_GROUPS.get((target or "").upper(), ("C", "V", "B"))
    q = db.query(Party).filter(Party.active == "Y")
    if company_id is not None:
        q = q.filter(Party.company_id == company_id)
    q = q.filter(Party.key_group.in_(list(groups)))
    parties = q.limit(500).all()

    gstin = (gstin or "").strip().upper()
    hint = (name_hint or "").strip().lower()
    scored: List[tuple] = []
    for p in parties:
        name = party_display_name(p)
        nl = name.lower()
        pg = (p.gstin or "").upper()
        score, match = 0, ""
        if gstin and pg == gstin:
            score, match = 100, "gstin_exact"
        elif hint and nl == hint and len(hint) >= 2:
            score, match = 80, "name_exact"
        elif hint and len(hint) >= 4 and (hint in nl or nl in hint):
            overlap = len(set(hint.split()) & set(nl.split()))
            score, match = 50 + min(overlap * 5, 20), "name_fuzzy"
        if score:
            scored.append((score, {
                "party_id": str(p.id),
                "ledger_id": str(p.ledger_id) if p.ledger_id else None,
                "name": name,
                "gstin": p.gstin,
                "match": match,
                "score": score,
            }))
    scored.sort(key=lambda x: -x[0])
    return [s for _, s in scored[:limit]]
