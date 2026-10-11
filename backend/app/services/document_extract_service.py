"""Deterministic Indian-accounting extraction from Docling text (no LLM).

Detects GST invoices / bills and pulls: GSTINs (checksum-validated,
seller/buyer roles), invoice no/date (multi-format), HSN line items with
per-line GST% and discounts, taxable + CGST/SGST/IGST, grand total with a
totals cross-check, and a weighted confidence breakdown.
"""
from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

from app.services.gst_service import STATE_CODES, GstService

GSTIN_RE = re.compile(r"\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b")
PAN_RE = re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b")
HSN_RE = re.compile(r"\b\d{4,8}\b")

INVOICE_NO_RES = [
    re.compile(r"(?:Invoice\s*(?:No\.?|Number|#)|Inv\s*No\.?|Bill\s*No\.?)\s*[:#-]?\s*([A-Za-z0-9\-/]{2,30})", re.I),
    re.compile(r"\b((?:INV|BILL)[-/][A-Za-z0-9\-/]{2,30})\b", re.I),
]
IRN_RE = re.compile(r"(?:IRN|Ack(?:nowledgement)?\s*No\.?)\s*[:#-]?\s*([A-Za-z0-9]{8,64})", re.I)
DATE_LABELED_RE = re.compile(
    r"(?:Invoice\s*Date|Bill\s*Date|Dated|Date)\s*[:#-]?\s*"
    r"(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|\d{1,2}[\s\-/.]+[A-Za-z]{3,9}[\s\-/.]+\d{2,4})",
    re.I,
)
DATE_ANY_RE = re.compile(
    r"\b(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|\d{1,2}[\s\-/.]+[A-Za-z]{3,9}[\s\-/.]+\d{4})\b"
)
GST_RATE_RE = re.compile(r"(\d{1,2}(?:\.\d+)?)\s*%?")

_MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

SELLER_LABELS = r"seller|supplier|supplied by|from|consignor|billed by"
BUYER_LABELS = r"buyer|bill to|billed to|ship to|shipped to|customer|consignee|client"

SKIP_ROW_RES = [
    re.compile(r"\b(grand\s*total|sub\s*total|total|taxable|cgst|sgst|igst|cess|round\s*off|discount|amount\s*payable|net\s*amount|balance\s*due)\b", re.I),
]

HEADER_KEYS = {
    "desc": ["description", "particular", "item", "product", "service", "goods", "narration"],
    "qty": ["qty", "quantity", "qnty", "nos", "units"],
    "rate": ["unit price", "rate", "price"],
    "amount": ["line total", "taxable value", "taxable amount", "amount"],
    "discount": ["discount", "disc", "less"],
    "hsn": ["hsn/sac", "hsn", "sac"],
    "gst": ["gst rate", "gst %", "tax %", "tax rate"],
    "cgst": ["cgst %", "cgst rate", "cgst"],
    "sgst": ["sgst %", "sgst rate", "sgst"],
    "cess": ["cess"],
    "unit": ["uom", "per", "unit"],
}


def _to_iso(d: str) -> Optional[str]:
    d = d.strip().replace(".", "/").replace("-", " ")
    d = re.sub(r"\s+", " ", d).replace("/", " ").strip()
    parts = d.split(" ")
    try:
        if len(parts) == 3 and parts[1][:3].lower() in _MONTHS:
            day, mon, yr = int(parts[0]), _MONTHS[parts[1][:3].lower()], int(parts[2])
            if yr < 100:
                yr += 2000
            return date(yr, mon, day).isoformat()
        if len(parts) == 3:
            day, mon, yr = int(parts[0]), int(parts[1]), int(parts[2])
            if yr < 100:
                yr += 2000
            return date(yr, mon, day).isoformat()
    except (ValueError, KeyError):
        return None
    return None


def _num(s: Any) -> float:
    """Parse Indian + international number formats (1,00,000 / 100,000)."""
    if s is None:
        return 0.0
    try:
        return float(str(s).replace(",", "").strip() or 0)
    except (ValueError, AttributeError):
        return 0.0


_LEADING_NUM_RE = re.compile(r"[-+]?\s*[\d,]+(?:\.\d+)?")


def _leading_num(s: Any) -> float:
    """Leading number of a cell that may carry a unit ("100 Nos", "20 Sheets")."""
    m = _LEADING_NUM_RE.search(str(s or ""))
    return _num(m.group(0)) if m else 0.0


def _trailing_unit(s: Any) -> str:
    m = re.search(r"([A-Za-z]{2,10})\.?\s*$", str(s or "").strip())
    return m.group(1) if m else ""


def _find(patterns, text: str) -> Optional[str]:
    for rx in patterns:
        m = rx.search(text)
        if m:
            return (m.group(1) if m.groups() else m.group(0)).strip(" :#-")
    return None


def _amount_near(text: str, keywords: List[str]) -> Optional[float]:
    # Separators include "|" because Docling renders tables as pipes
    # ("Sub Total | 1,01,600.00"). The trailing guard stops "CGST @ 9%"
    # from matching the bare 9 as an amount.
    for kw in keywords:
        rx = re.compile(
            rf"{kw}[\s|:#\-]*?(?:Rs\.?|INR|₹)?\s*([\d,]+\.\d{{2}}|[\d,]+)(?!\s*%)",
            re.I,
        )
        m = rx.search(text)
        if m:
            v = _num(m.group(1))
            if v > 0:
                return v
    return None


def _assign_gstin_roles(full: str) -> Tuple[str, str, List[Dict[str, Any]]]:
    """Return (seller_gstin, buyer_gstin, all_info with checksum validity)."""
    infos: List[Dict[str, Any]] = []
    for m in GSTIN_RE.finditer(full):
        g = m.group(0)
        v = GstService.validate_gstin(g)
        infos.append({"gstin": g, "pos": m.start(), "valid": v["valid"],
                      "state_code": v["state_code"], "state_name": v["state_name"]})
    # Prefer checksum-valid numbers; fall back to any format match.
    usable = [i for i in infos if i["valid"]] or infos
    if not usable:
        return "", "", infos

    def near_label(pos: int, labels: str, window: int = 400) -> bool:
        start = max(0, pos - window)
        return bool(re.search(labels, full[start:pos], re.I))

    seller = buyer = ""
    for info in usable:
        if not seller and near_label(info["pos"], SELLER_LABELS):
            seller = info["gstin"]
        elif not buyer and near_label(info["pos"], BUYER_LABELS):
            buyer = info["gstin"]
    # Fallback: document order (seller first, buyer second).
    remaining = [i["gstin"] for i in usable if i["gstin"] not in (seller, buyer)]
    if not seller and remaining:
        seller = remaining.pop(0)
    if not buyer and remaining:
        buyer = remaining.pop(0)
    return seller, buyer, infos


def _state_of(gstin: str) -> Tuple[str, str]:
    code = (gstin or "")[:2]
    return (code, STATE_CODES.get(code, "")) if code in STATE_CODES else ("", "")


def extract(doc: Dict[str, Any], target: str = "SALES") -> Dict[str, Any]:
    full = doc.get("full_text", "") or ""
    tables = doc.get("tables", []) or []
    warnings: List[str] = []

    invoice_no = _find(INVOICE_NO_RES, full)
    irn = ""
    m_irn = IRN_RE.search(full)
    if m_irn:
        irn = m_irn.group(1).strip()
    if not invoice_no and irn:
        invoice_no = irn

    date_raw = _find([DATE_LABELED_RE, DATE_ANY_RE], full)
    invoice_date = _to_iso(date_raw) if date_raw else None

    seller_gstin, buyer_gstin, gstin_infos = _assign_gstin_roles(full)
    invalid_gstins = [i["gstin"] for i in gstin_infos if not i["valid"]]
    seller_code, seller_state = _state_of(seller_gstin)
    buyer_code, buyer_state = _state_of(buyer_gstin)

    taxable = _amount_near(full, ["Taxable Value", "Taxable Amount", "Total Taxable", "Sub Total", "Subtotal"])
    cgst = _amount_near(full, ["CGST"])
    sgst = _amount_near(full, ["SGST"])
    igst = _amount_near(full, ["IGST"])
    discount_total = _amount_near(full, ["Discount Total", "Total Discount"]) or 0.0
    grand = _amount_near(full, [
        "Grand Total", "Total Invoice Amount", "Invoice Amount", "Invoice Total",
        "Net Amount", "Total Amount", "Amount Payable", "Total Payable", "Net Payable",
    ])

    # HSN-wise / summary tax tables (generic across formats): adopt values
    # the text scan missed, but never override what the text already stated.
    summary = _extract_tax_summary(tables)
    if taxable is None and summary.get("taxable"):
        taxable = summary["taxable"]
    if cgst is None and summary.get("cgst"):
        cgst = summary["cgst"]
    if sgst is None and summary.get("sgst"):
        sgst = summary["sgst"]
    if igst is None and summary.get("igst"):
        igst = summary["igst"]
    # Remember what the document itself stated (vs line-derived later).
    doc_tax = {"cgst": bool(cgst), "sgst": bool(sgst), "igst": bool(igst)}

    # Place of supply / inter-state
    inter_state = False
    place_of_supply = ""
    if seller_code and buyer_code:
        inter_state = seller_code != buyer_code
    m_pos = re.search(r"Place of Supply\s*[:#-]?\s*([A-Za-z ()&\-]{2,50})", full, re.I)
    if m_pos:
        place_of_supply = m_pos.group(1).strip()
        if not (seller_code and buyer_code):
            for code, name in STATE_CODES.items():
                if name.lower() in place_of_supply.lower() or place_of_supply.lower() in name.lower():
                    if seller_code and code != seller_code:
                        inter_state = True
                    break

    lines = _extract_lines(tables, full)

    line_taxable = round(sum((l["qty"] * l["rate"] - l.get("discount", 0)) for l in lines), 2)
    line_tax = round(sum((l["qty"] * l["rate"] - l.get("discount", 0)) * l["gst_rate"] / 100 for l in lines), 2)
    if not taxable and lines:
        taxable = line_taxable
    scanned_tax = round((cgst or 0) + (sgst or 0) + (igst or 0), 2)
    if not scanned_tax and lines:
        scanned_tax = line_tax
        if inter_state:
            igst, cgst, sgst = scanned_tax, 0.0, 0.0
        else:
            half = round(scanned_tax / 2, 2)
            cgst, sgst, igst = half, round(scanned_tax - half, 2), 0.0
    if grand is None and taxable:
        grand = round(taxable + scanned_tax, 2)

    # The document's stated split wins over GSTIN inference; a disagreement
    # is a review flag, never a silent override.
    if seller_code and buyer_code:
        if (doc_tax["cgst"] or doc_tax["sgst"]) and inter_state:
            warnings.append(
                "Document charges CGST+SGST but seller/buyer states differ "
                "(IGST usually applies inter-state) — verify."
            )
        elif doc_tax["igst"] and not inter_state:
            warnings.append(
                "Document charges IGST but both parties are in the same state "
                "(CGST+SGST usually applies) — verify."
            )

    # Totals cross-check (never silently adjust: report + warn).
    round_off = 0.0
    reconciled = False
    totals_diff: Optional[float] = None
    if grand is not None and taxable:
        totals_diff = round(grand - (taxable + scanned_tax), 2)
        if abs(totals_diff) <= 2.0:
            reconciled = True
            if abs(totals_diff) >= 0.005:
                round_off = totals_diff
        else:
            warnings.append(
                f"Scanned total {grand:,.2f} differs from taxable+tax "
                f"({taxable + scanned_tax:,.2f}) — verify lines before posting."
            )

    # Weighted confidence.
    breakdown = {
        "invoice_no": 20 if invoice_no else 0,
        "invoice_date": 15 if invoice_date else 0,
        "gstin": 15 if (seller_gstin or buyer_gstin) else 0,
        "lines": 20 if lines else 0,
        "totals_reconcile": 20 if reconciled else (10 if grand is not None else 0),
        "tax_breakup": 10 if (cgst or sgst or igst) else 0,
    }
    confidence = sum(breakdown.values())

    if not invoice_no:
        warnings.append("Invoice number not found — check manually.")
    if not invoice_date:
        warnings.append("Invoice date not found — using today; verify.")
    if not (seller_gstin or buyer_gstin):
        warnings.append("No GSTIN found — party matching may need manual selection.")
    for g in invalid_gstins[:3]:
        warnings.append(f"GSTIN {g} failed checksum — verify the number.")
    if not lines:
        warnings.append("No line items parsed — add lines manually.")

    today = date.today().isoformat()
    fields = {
        "invoice_no": invoice_no or "",
        "irn": irn,
        "invoice_date": invoice_date or today,
        "due_date": invoice_date or today,
        "seller_gstin": seller_gstin,
        "buyer_gstin": buyer_gstin,
        "seller_state_code": seller_code,
        "seller_state": seller_state,
        "buyer_state_code": buyer_code,
        "buyer_state": buyer_state,
        "place_of_supply": place_of_supply,
        "inter_state": inter_state,
        "taxable": taxable or 0,
        "cgst": cgst or 0,
        "sgst": sgst or 0,
        "igst": igst or 0,
        "discount_total": discount_total,
        "round_off": round_off,
        "grand_total": grand if grand is not None else (taxable or 0),
        "narration": (f"AI: {invoice_no} " if invoice_no else "AI scan ")[:50],
        "seller_name_hint": _name_hint(full, "seller|supplier|supplied by|from|consignor"),
        "buyer_name_hint": _name_hint(full, "buyer|bill to|billed to|ship to|customer|consignee"),
    }

    doc_type = "UNKNOWN"
    low = full.lower()
    if "tax invoice" in low or ("gstin" in low and ("cgst" in low or "sgst" in low or "igst" in low)):
        doc_type = "PURCHASE_BILL" if target == "PURCHASE" else "SALES_INVOICE"

    return {
        "doc_type": doc_type,
        "confidence": confidence,
        "confidence_breakdown": breakdown,
        "fields": fields,
        "lines": lines,
        "totals_check": {
            "scanned_taxable": taxable or 0,
            "scanned_tax": scanned_tax,
            "scanned_grand": grand if grand is not None else 0,
            "computed_taxable": line_taxable,
            "computed_tax": line_tax,
            "reconciled": reconciled,
            "diff": totals_diff,
        },
        "warnings": warnings,
    }


def _name_hint(full: str, label_pat: str) -> str:
    m = re.search(rf"(?:{label_pat})\s*[:#-]?\s*([A-Z][A-Za-z0-9 .&()\-]{{2,60}})", full, re.I)
    return m.group(1).strip()[:80] if m else ""


def _is_skip_row(cells: List[str]) -> bool:
    joined = " ".join(cells).strip()
    if not joined:
        return True
    return any(rx.search(joined) for rx in SKIP_ROW_RES)


def _norm_header(h: str) -> str:
    h = h.replace("%", " %").replace("/", " ")
    return re.sub(r"\s+", " ", h).strip()


def _col(header: List[str], keys: List[str]) -> Optional[int]:
    normed = [_norm_header(h) for h in header]
    # Longest-key-first so "unit price" beats "price", "cgst %" beats "cgst".
    for key in sorted(keys, key=len, reverse=True):
        for i, h in enumerate(normed):
            if key in h:
                return i
    return None


def _gst_from_cells(cells: List[str], idx: Optional[int]) -> Optional[float]:
    if idx is None or idx >= len(cells):
        return None
    m = GST_RATE_RE.search(cells[idx])
    return float(m.group(1)) if m else None


_SUMMARY_COLS = {
    # need-token -> also-must-appear (keeps "CGST %" rate cols out,
    # keeps bare "Rate"/"Amount" unattributed cols out).
    "taxable": (["taxable"], ["value", "amount"]),
    "cgst": (["cgst"], ["amount", "value", "tax"]),
    "sgst": (["sgst"], ["amount", "value", "tax"]),
    "igst": (["igst"], ["amount", "value", "tax"]),
}

_TOTAL_ROW_RE = re.compile(r"^\s*(total|grand\s*total|total\s*tax)\b", re.I)


def _summary_col(header: List[str], need: List[str], also: List[str]) -> Optional[int]:
    for i, h in enumerate(header):
        hn = _norm_header(h)
        if any(n in hn for n in need) and any(a in hn for a in also):
            return i
    return None


def _extract_tax_summary(tables: List[Dict]) -> Dict[str, float]:
    """Read HSN-wise / summary tax tables generically.

    Finds columns like "Taxable Value", "CGST Amount", "SGST Amount",
    "IGST Amount" in any table; prefers the Total row when present,
    otherwise sums the column. Returns only positive findings.
    """
    out: Dict[str, float] = {}
    for t in tables:
        rows = [r for r in (t.get("rows") or []) if any((c or "").strip() for c in r)]
        if len(rows) < 2:
            continue
        header = [(c or "").lower().strip() for c in rows[0]]
        for key, (need, also) in _SUMMARY_COLS.items():
            if key in out:
                continue
            ci = _summary_col(header, need, also)
            if ci is None:
                continue
            total_val: Optional[float] = None
            col_sum = 0.0
            for r in rows[1:]:
                cells = [(c or "").strip() for c in r]
                v = _leading_num(cells[ci]) if ci < len(cells) else 0.0
                first = cells[0].lower() if cells else ""
                if _TOTAL_ROW_RE.match(first):
                    if v > 0:
                        total_val = v
                elif v:
                    col_sum += v
            picked = total_val if total_val else (round(col_sum, 2) or None)
            if picked:
                out[key] = picked
    return out


def _extract_lines(tables: List[Dict], full: str) -> List[Dict[str, Any]]:
    lines: List[Dict[str, Any]] = []
    for t in tables:
        rows = [r for r in (t.get("rows") or []) if any((c or "").strip() for c in r)]
        if len(rows) < 2:
            continue
        header = [(c or "").lower().strip() for c in rows[0]]
        idx = {k: _col(header, v) for k, v in HEADER_KEYS.items()}
        if idx["desc"] is None:
            continue
        # A split CGST%/SGST% column contains "gst %" as a substring — don't
        # mistake it for the combined GST% column; the split logic below
        # handles it.
        if idx["gst"] is not None:
            hg = _norm_header(header[idx["gst"]])
            if hg not in ("gst", "gst %", "gst rate", "tax %", "tax rate") and any(
                k in hg for k in ("cgst", "sgst", "igst", "cess")
            ):
                idx["gst"] = None
        for r in rows[1:]:
            cells = [(c or "").strip() for c in r]
            if _is_skip_row(cells):
                continue
            desc = cells[idx["desc"]] if idx["desc"] < len(cells) else ""
            if len(desc) < 2:
                continue
            qty_raw = cells[idx["qty"]] if idx["qty"] is not None and idx["qty"] < len(cells) else ""
            qty = _leading_num(qty_raw) or 1
            if qty <= 0:
                qty = 1
            unit = ""
            if idx["unit"] is not None and idx["unit"] < len(cells):
                unit = cells[idx["unit"]].strip()[:10]
            if not unit:
                unit = _trailing_unit(qty_raw)[:10]
            rate = _leading_num(cells[idx["rate"]]) if idx["rate"] is not None and idx["rate"] < len(cells) else 0
            amount = _leading_num(cells[idx["amount"]]) if idx["amount"] is not None and idx["amount"] < len(cells) else 0
            if rate <= 0 and amount > 0:
                rate = round(amount / qty, 2)
            if rate <= 0:
                continue
            discount = _leading_num(cells[idx["discount"]]) if idx["discount"] is not None and idx["discount"] < len(cells) else 0
            hsn = ""
            if idx["hsn"] is not None and idx["hsn"] < len(cells):
                m = HSN_RE.search(cells[idx["hsn"]])
                hsn = m.group(0) if m else ""
            gst_rate: Optional[float] = _gst_from_cells(cells, idx["gst"])
            if gst_rate is None and idx["cgst"] is not None and idx["sgst"] is not None:
                c = _gst_from_cells(cells, idx["cgst"]) or 0
                s = _gst_from_cells(cells, idx["sgst"]) or 0
                gst_rate = round(c + s, 2) if (c or s) else None
            if gst_rate is None:
                gst_rate = 18.0
            line_amount = round(qty * rate - discount, 2)
            lines.append({
                "description": desc[:120],
                "hsn": hsn[:8],
                "qty": qty if qty < 100000 else 1,
                "unit": unit,
                "rate": round(rate, 2),
                "discount": round(discount, 2),
                "gst_rate": gst_rate,
                "amount": line_amount,
            })
            if len(lines) >= 25:
                return lines
        # fall through: merge lines from additional tables
    if lines:
        return lines
    # Text fallback: "Widget A  HSN 1234  2 x 500  18%"
    pat = re.compile(
        r"(?P<desc>[A-Z][A-Za-z0-9 .&()\-]{3,60}?)\s+(?:(?P<hsn>\d{4,8})\s+)?"
        r"(?P<qty>\d+(?:\.\d+)?)\s*[xX×]?\s*(?P<rate>[\d,]+(?:\.\d{2})?)\s*(?P<gst>\d{1,2}(?:\.\d+)?\s*%)?",
        re.M,
    )
    for m in pat.finditer(full):
        desc = m.group("desc").strip()
        if any(k in desc.lower() for k in ["total", "sub total", "cgst", "sgst", "igst", "invoice", "gstin"]):
            continue
        qty = _num(m.group("qty")) or 1
        rate = _num(m.group("rate"))
        if rate <= 0:
            continue
        g = m.group("gst")
        gst_rate = float(g.replace("%", "").strip()) if g else 18.0
        lines.append({
            "description": desc[:120],
            "hsn": (m.group("hsn") or "")[:8],
            "qty": qty,
            "rate": round(rate, 2),
            "discount": 0.0,
            "gst_rate": gst_rate,
            "amount": round(qty * rate, 2),
        })
        if len(lines) >= 10:
            break
    return lines
