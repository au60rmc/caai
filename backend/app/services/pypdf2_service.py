"""Lightweight PDF text extraction for Vercel / minimal builds.

Uses only PyPDF2 (pure-Python, ~2 MB) — no OCR, no table-structure
model, no heavy dependencies.  Good enough for **digital** GST invoices,
Tally exports, bank statements, and other machine-generated PDFs.

Scanned images / photos of bills are NOT supported here; use the
full Docling pipeline on desktop for those.
"""
from __future__ import annotations

import io
import re
from pathlib import Path
from typing import Any, Dict, List


def extract_pdf_text(filename: str, content: bytes) -> Dict[str, Any]:
    """Extract text + basic tables from a PDF via PyPDF2.

    Returns the same dict contract as ``docling_service.convert_to_text``::

        {markdown, tables, full_text, tier_used, degraded}
    """
    try:
        from PyPDF2 import PdfReader
    except ImportError as e:
        raise RuntimeError(
            "PyPDF2 is not installed.  Run: pip install PyPDF2"
        ) from e

    reader = PdfReader(io.BytesIO(content))
    pages_text: List[str] = []
    tables: List[Dict[str, Any]] = []

    for page_num, page in enumerate(reader.pages):
        page_text = page.extract_text() or ""
        pages_text.append(page_text)

        # --- basic pipe-delimited table detection ---------------
        for block in _pipe_tables(page_text):
            tables.append({"index": len(tables), "rows": block})

    full_text = "\n\n".join(pages_text)
    markdown = full_text  # same contract — markdown is just the text here

    return {
        "markdown": markdown[:20000],
        "tables": tables[:10],
        "full_text": full_text[:30000],
        "tier_used": "light",
        "degraded": False,
    }


IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp"}


def extract_text_from_file(filename: str, content: bytes) -> Dict[str, Any]:
    """Dispatch based on extension — PDFs go through PyPDF2, others are plain text."""
    ext = Path(filename or "").suffix.lower()

    if ext in IMAGE_EXTS:
        raise RuntimeError(
            "Image OCR requires the full Docling pipeline. "
            "Set ENABLE_DOCLING=true and install docling (pip install -r requirements-full.txt)."
        )

    if ext == ".pdf":
        return extract_pdf_text(filename, content)

    # xlsx — same fallback as docling_service._fallback_parse
    if ext in (".xlsx", ".xlsm"):
        return _fallback_xlsx(content)

    if ext == ".csv":
        return _fallback_csv(content)

    # .txt / .md / .docx (best-effort) / unknown
    return _fallback_text(content, ext)


# ------------------------------------------------------------------
# helpers
# ------------------------------------------------------------------

_PIPE_RE = re.compile(r"^\s*\|(.+)\|\s*$")


def _pipe_tables(text: str) -> List[List[List[str]]]:
    """Find contiguous pipe-delimited table blocks in *text*."""
    blocks: List[List[List[str]]] = []
    current: List[List[str]] = []
    for line in text.splitlines():
        m = _PIPE_RE.match(line)
        if m:
            cells = [c.strip() for c in m.group(1).split("|")]
            current.append(cells)
        else:
            if len(current) >= 2:
                blocks.append(current)
            current = []
    if len(current) >= 2:
        blocks.append(current)
    return blocks


def _fallback_xlsx(content: bytes) -> Dict[str, Any]:
    tables: List[Dict[str, Any]] = []
    texts: List[str] = []
    try:
        from openpyxl import load_workbook

        wb = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        for ws in wb.worksheets:
            rows = []
            for row in ws.iter_rows(values_only=True):
                vals = [(str(v) if v is not None else "") for v in row]
                if any(vals):
                    rows.append(vals)
                if len(rows) >= 60:
                    break
            if rows:
                tables.append({"index": len(tables), "rows": rows})
                texts.append("\n".join(" | ".join(r) for r in rows))
            if len(tables) >= 5:
                break
    except Exception as e:
        texts.append(f"[pypdf2 xlsx fallback error: {e}]")
    full = "\n".join(texts)
    return {"markdown": full[:20000], "tables": tables, "full_text": full[:30000], "tier_used": "light", "degraded": False}


def _fallback_csv(content: bytes) -> Dict[str, Any]:
    try:
        text = content.decode("utf-8-sig", errors="replace")
    except Exception:
        text = ""
    return {"markdown": text[:20000], "tables": [], "full_text": text[:30000], "tier_used": "light", "degraded": False}


def _fallback_text(content: bytes, ext: str) -> Dict[str, Any]:
    try:
        text = content.decode("utf-8", errors="replace")
    except Exception:
        text = ""
    if ext in (".docx",):
        # Best-effort: python-docx is optional
        try:
            import docx
            doc = docx.Document(io.BytesIO(content))
            text = "\n".join(p.text for p in doc.paragraphs)
        except Exception:
            pass
    return {"markdown": text[:20000], "tables": [], "full_text": text[:30000], "tier_used": "light", "degraded": False}
