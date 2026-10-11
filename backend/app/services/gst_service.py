"""GST validation, classification and tax-setup service.

Implements GSTIN format + state-code + checksum validation, CGST/SGST vs
IGST classification based on supplier / place-of-supply states, GST rate
configuration and the HSN/SAC reference master with suggestions.
"""
import re
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from app.models.gst import GstRate, HsnCode
from app.schemas.gst import GstClassifyRequest

GSTIN_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")
PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")

STATE_CODES = {
    "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab",
    "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana", "07": "Delhi",
    "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim",
    "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
    "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam",
    "19": "West Bengal", "20": "Jharkhand", "21": "Odisha",
    "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
    "26": "Dadra & Nagar Haveli and Daman & Diu", "27": "Maharashtra",
    "28": "Andhra Pradesh (old)", "29": "Karnataka", "30": "Goa",
    "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu",
    "34": "Puducherry", "35": "Andaman & Nicobar Islands", "36": "Telangana",
    "37": "Andhra Pradesh", "38": "Ladakh", "97": "Other Territory",
}

_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def _gstin_checksum(gstin: str) -> str:
    total = 0
    for i, ch in enumerate(gstin[:14]):
        v = _CHARS.index(ch)
        v = v * (2 if i % 2 else 1)
        total += v // 36 + v % 36
    return _CHARS[(36 - total % 36) % 36]


class GstService:
    @staticmethod
    def validate_gstin(gstin: str) -> dict:
        gstin = (gstin or "").strip().upper()
        result = {
            "gstin": gstin,
            "valid": False,
            "level": "error",
            "message": "",
            "state_code": None,
            "state_name": None,
            "pan": None,
        }
        if not gstin:
            result["message"] = "GSTIN is empty"
            return result
        if len(gstin) != 15:
            result["message"] = "GSTIN must be exactly 15 characters"
            return result
        if not GSTIN_RE.match(gstin):
            result["message"] = "GSTIN format is invalid (expected 22AAAAA0000A1Z5 pattern)"
            return result
        state = gstin[:2]
        result["state_code"] = state
        result["pan"] = gstin[2:12]
        if state not in STATE_CODES:
            result["message"] = f"Unknown state code {state}"
            return result
        result["state_name"] = STATE_CODES[state]
        if _gstin_checksum(gstin) != gstin[14]:
            result["valid"] = False
            result["level"] = "warning"
            result["message"] = "GSTIN checksum does not match; verify the number"
            return result
        result["valid"] = True
        result["level"] = "ok"
        result["message"] = f"Valid GSTIN registered in {STATE_CODES[state]}"
        return result

    @staticmethod
    def validate_pan(pan: str) -> dict:
        pan = (pan or "").strip().upper()
        ok = bool(PAN_RE.match(pan))
        return {"pan": pan, "valid": ok,
                "message": "Valid PAN" if ok else "PAN format is invalid (AAAAA0000A)"}

    @staticmethod
    def classify(req: GstClassifyRequest) -> dict:
        """Determine CGST/SGST (intra-state) or IGST (inter-state)."""
        supplier = req.supplier_state_code or (
            (req.supplier_gstin or "")[:2] if req.supplier_gstin else None
        )
        pos = req.place_of_supply_state_code or (
            (req.customer_gstin or "")[:2] if req.customer_gstin else None
        )
        rate = Decimal(str(req.rate or 0))
        amount = Decimal(str(req.taxable_amount or 0))
        if not supplier or not pos:
            return {
                "classification": "UNKNOWN",
                "message": "Supplier and place-of-supply states are required",
            }
        intra = supplier == pos
        if intra:
            half = (amount * rate / Decimal(200)).quantize(Decimal("0.01"))
            return {
                "classification": "CGST_SGST",
                "supplier_state": STATE_CODES.get(supplier, supplier),
                "place_of_supply": STATE_CODES.get(pos, pos),
                "cgst_rate": float(rate / 2),
                "sgst_rate": float(rate / 2),
                "igst_rate": 0,
                "cgst_amount": float(half),
                "sgst_amount": float(half),
                "igst_amount": 0,
                "total_tax": float(half * 2),
                "message": "Intra-state supply: CGST + SGST applies",
            }
        igst = (amount * rate / Decimal(100)).quantize(Decimal("0.01"))
        return {
            "classification": "IGST",
            "supplier_state": STATE_CODES.get(supplier, supplier),
            "place_of_supply": STATE_CODES.get(pos, pos),
            "cgst_rate": 0,
            "sgst_rate": 0,
            "igst_rate": float(rate),
            "cgst_amount": 0,
            "sgst_amount": 0,
            "igst_amount": float(igst),
            "total_tax": float(igst),
            "message": "Inter-state supply: IGST applies",
        }

    # ---------- GST rates ----------
    @staticmethod
    def list_rates(db: Session) -> list[dict]:
        rates = (
            db.query(GstRate).filter(GstRate.active == "Y").order_by(GstRate.rate).all()
        )
        return [
            {
                "id": str(r.id),
                "rate": float(r.rate),
                "tax_type": r.tax_type,
                "description": r.description,
                "active": r.active,
            }
            for r in rates
        ]

    @staticmethod
    def save_rates(db: Session, items: list) -> None:
        import uuid as _uuid
        for item in items:
            rid = item.id
            if rid:
                existing = db.query(GstRate).filter(GstRate.id == rid).first()
                if existing:
                    existing.rate = item.rate
                    existing.tax_type = item.tax_type
                    existing.description = item.description
                    existing.active = item.active
            else:
                db.add(GstRate(rate=item.rate, tax_type=item.tax_type,
                               description=item.description, active=item.active))
        db.commit()

    # ---------- HSN / SAC ----------
    @staticmethod
    def list_hsn(db: Session, q: Optional[str] = None, limit: int = 200) -> list[dict]:
        query = db.query(HsnCode).filter(HsnCode.active == "Y")
        if q:
            like = f"%{q}%"
            query = query.filter(
                (HsnCode.code.ilike(like)) | (HsnCode.description.ilike(like))
            )
        rows = query.order_by(HsnCode.code).limit(limit).all()
        return [
            {
                "id": str(h.id),
                "code": h.code,
                "description": h.description,
                "gst_rate": float(h.gst_rate) if h.gst_rate is not None else None,
                "kind": h.kind,
                "active": h.active,
            }
            for h in rows
        ]

    @staticmethod
    def save_hsn(db: Session, items: list) -> None:
        for item in items:
            hid = item.id
            if hid:
                existing = db.query(HsnCode).filter(HsnCode.id == hid).first()
                if existing:
                    existing.code = item.code
                    existing.description = item.description
                    existing.gst_rate = item.gst_rate
                    existing.kind = item.kind
                    existing.active = item.active
            else:
                db.add(HsnCode(code=item.code, description=item.description,
                               gst_rate=item.gst_rate, kind=item.kind,
                               active=item.active))
        db.commit()

    @staticmethod
    def suggest_hsn(db: Session, description: str, limit: int = 5) -> list[dict]:
        """Suggest HSN/SAC codes based on item description words."""
        words = [w for w in re.split(r"\W+", (description or "").lower()) if len(w) > 2]
        if not words:
            return []
        rows = db.query(HsnCode).filter(HsnCode.active == "Y").all()
        scored = []
        for h in rows:
            desc = (h.description or "").lower()
            score = sum(1 for w in words if w in desc)
            if score:
                scored.append((score, h))
        scored.sort(key=lambda x: -x[0])
        return [
            {
                "code": h.code,
                "description": h.description,
                "gst_rate": float(h.gst_rate) if h.gst_rate is not None else None,
                "kind": h.kind,
            }
            for _s, h in scored[:limit]
        ]
