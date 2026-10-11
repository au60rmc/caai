"""Unified master search across ledgers, parties, items, banks, groups and
cost centers — powers the global search dropdown (Ctrl+K / Ctrl+F)."""
from sqlalchemy.orm import Session
from app.models.ledger import Ledger
from app.models.ledger_group import LedgerGroup
from app.models.party import Party
from app.models.product_item import ProductItem
from app.models.bank_account import BankAccount
from app.models.cost_center import CostCenter
from typing import List, Dict, Any, Optional


class MasterSearchService:
    @staticmethod
    def search(db: Session, q: str, type_: str = "all", limit: int = 8) -> List[Dict[str, Any]]:
        q = (q or "").strip()
        if not q:
            return []
        like = f"%{q}%"
        ql = q.lower()
        results: List[Dict[str, Any]] = []

        def want(t: str) -> bool:
            return type_ in ("all", t)

        if want("ledger"):
            for l in (
                db.query(Ledger)
                .filter(Ledger.active == "Y")
                .filter((Ledger.name.ilike(like)) | (Ledger.gstin.ilike(like)))
                .limit(limit)
                .all()
            ):
                results.append({
                    "type": "ledger", "id": str(l.id), "name": l.name,
                    "sub": l.category or "Ledger", "url": "/app/ledgers",
                })

        if want("party") or want("customer") or want("vendor"):
            for p in db.query(Party).filter(Party.active == "Y").all():
                n = p.name_contact_info or {}
                hay = " ".join(str(x or "") for x in [
                    n.get("display_name"), n.get("company_name"),
                    n.get("mobile_number"), n.get("email"), p.gstin,
                ]).lower()
                if ql in hay:
                    kind = "customer" if p.key_group != "V" else "vendor"
                    results.append({
                        "type": kind, "id": str(p.id),
                        "name": n.get("display_name") or n.get("first_name") or "",
                        "sub": (p.gstin or n.get("mobile_number") or kind.title()),
                        "url": "/app/customers" if kind == "customer" else "/app/vendors",
                    })
                    if len([r for r in results if r["type"] in ("customer", "vendor")]) >= limit:
                        break

        if want("item"):
            for i in (
                db.query(ProductItem)
                .filter(ProductItem.status == "Active")
                .filter(
                    (ProductItem.item_name.ilike(like))
                    | (ProductItem.item_code.ilike(like))
                    | (ProductItem.hsn_sac.ilike(like))
                )
                .limit(limit)
                .all()
            ):
                results.append({
                    "type": "item", "id": str(i.id), "name": i.item_name,
                    "sub": f"{i.item_code} · HSN {i.hsn_sac or '—'}",
                    "url": "/app/products",
                })

        if want("bank"):
            for b in (
                db.query(BankAccount)
                .filter(BankAccount.active == "Y")
                .filter(
                    (BankAccount.bank_name.ilike(like))
                    | (BankAccount.account_number.ilike(like))
                    | (BankAccount.ifsc_code.ilike(like))
                )
                .limit(limit)
                .all()
            ):
                results.append({
                    "type": "bank", "id": str(b.id), "name": b.bank_name or "Account",
                    "sub": b.account_number or b.account_type, "url": "/app/banks",
                })

        if want("group"):
            for g in (
                db.query(LedgerGroup)
                .filter(LedgerGroup.active == "Y", LedgerGroup.name.ilike(like))
                .limit(limit)
                .all()
            ):
                results.append({
                    "type": "group", "id": str(g.id), "name": g.name,
                    "sub": g.hierarchy_path or "Ledger group",
                    "url": "/app/ledger-groups",
                })

        if want("cost_center"):
            for c in (
                db.query(CostCenter)
                .filter(CostCenter.active == "Y", CostCenter.name.ilike(like))
                .limit(limit)
                .all()
            ):
                results.append({
                    "type": "cost_center", "id": str(c.id), "name": c.name,
                    "sub": c.kind.title(), "url": "/app/cost-centers",
                })

        return results[:40]
