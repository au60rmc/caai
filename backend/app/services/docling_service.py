"""Pure-Docling document conversion (offline-first, tiered).

low  = fast, ~low RAM: no OCR, no table-structure model. Best for
       digital PDFs / Excel / Word. Works offline after first download.
high = full pipeline: OCR + layout + TableFormer. Best for scanned
       images / photos of bills. Needs more RAM/CPU.

Same JSON contract for both tiers; only `confidence` differs.
Docling is imported lazily so the API still starts when docling
is not installed (e.g. minimal Vercel builds).

When docling is not installed OR ``ENABLE_DOCLING=false`` (Vercel),
the lightweight ``pypdf2_service`` handles digital PDFs via PyPDF2
instead of the full Docling pipeline.
"""
from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Tuple, Optional

from app.core.config import settings


def _use_docling() -> bool:
    """Determine whether to use Docling or PyPDF2.

    Priority:
    1. Explicit ENABLE_DOCLING env var → use that
    2. Not set → auto-detect: use Docling if installed, else PyPDF2
    """
    if settings.ENABLE_DOCLING is not None:
        return settings.ENABLE_DOCLING
    try:
        import docling  # noqa: F401
        return True
    except ImportError:
        return False

ALLOWED_EXTS = {
    ".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp",
    ".docx", ".pptx", ".xlsx", ".csv", ".html", ".htm", ".md", ".txt",
}
MAX_FILE_MB = 15
# Batch (ZIP) caps: file count + total uncompressed size (zip-bomb guard).
ZIP_MAX_FILES = 20
ZIP_MAX_TOTAL_MB = 50
ZIP_MAX_MB = 50
# Fit serverless (60s) and desktop alike; high-tier OCR rarely needs more
# for single invoices. Auto-degrade steps down instead of timing out hard.
DOCUMENT_TIMEOUT_S = 50


def validate_upload(filename: str, size_bytes: int) -> None:
    ext = Path(filename or "").suffix.lower()
    if ext not in ALLOWED_EXTS:
        raise ValueError(
            f"Unsupported file type '{ext}'. Allowed: {', '.join(sorted(ALLOWED_EXTS))}"
        )
    if size_bytes > MAX_FILE_MB * 1024 * 1024:
        raise ValueError(f"File too large (>{MAX_FILE_MB}MB).")


def validate_zip_upload(filename: str, size_bytes: int) -> None:
    if Path(filename or "").suffix.lower() != ".zip":
        raise ValueError("Batch upload expects a .zip file.")
    if size_bytes > ZIP_MAX_MB * 1024 * 1024:
        raise ValueError(f"ZIP too large (>{ZIP_MAX_MB}MB).")


def extract_zip_members(content: bytes) -> tuple[list[dict], list[dict]]:
    """Safely list a ZIP's parseable members.

    Returns (members, skipped): members hold {filename, content};
    skipped hold {filename, reason}. Guards: traversal, nested zips,
    unsupported types, per-file size, count and total-size caps.
    Stateless: everything stays in memory, nothing is written to disk.
    """
    import io
    import zipfile

    members: list[dict] = []
    skipped: list[dict] = []
    try:
        zf = zipfile.ZipFile(io.BytesIO(content))
    except zipfile.BadZipFile as e:
        raise ValueError(f"Not a valid ZIP file: {e}") from e
    total = 0
    with zf:
        for info in zf.infolist():
            name = info.filename
            if info.is_dir() or not name.strip():
                continue
            # Zip-slip: reject absolute paths and parent escapes.
            if name.startswith(("/", "\\")) or ".." in name.split("/"):
                skipped.append({"filename": name, "reason": "unsafe path"})
                continue
            base = name.rsplit("/", 1)[-1]
            ext = Path(base).suffix.lower()
            if ext == ".zip":
                skipped.append({"filename": base, "reason": "nested ZIPs not supported"})
                continue
            if ext not in ALLOWED_EXTS:
                skipped.append({"filename": base, "reason": f"unsupported type '{ext}'"})
                continue
            if info.file_size > MAX_FILE_MB * 1024 * 1024:
                skipped.append({"filename": base, "reason": f"exceeds {MAX_FILE_MB}MB"})
                continue
            if len(members) >= ZIP_MAX_FILES:
                skipped.append({"filename": base, "reason": f"exceeds {ZIP_MAX_FILES}-file cap"})
                continue
            if total + info.file_size > ZIP_MAX_TOTAL_MB * 1024 * 1024:
                skipped.append({"filename": base, "reason": f"exceeds {ZIP_MAX_TOTAL_MB}MB total"})
                continue
            try:
                data = zf.read(info.filename)
            except Exception as e:  # corrupt member / password-protected
                skipped.append({"filename": base, "reason": f"unreadable: {e}"[:120]})
                continue
            total += len(data)
            members.append({"filename": base, "content": data})
    return members, skipped


def _converter(tier: str):
    """Build a DocumentConverter for the requested tier (lazy import)."""
    try:
        from docling.document_converter import DocumentConverter
        from docling.datamodel.base_models import InputFormat
        from docling.datamodel.pipeline_options import PdfPipelineOptions
        from docling.document_converter import PdfFormatOption, ImageFormatOption
    except ImportError as e:  # pragma: no cover
        raise RuntimeError(
            "Docling is not installed. Run: pip install docling"
        ) from e

    if tier == "low":
        pdf_opts = PdfPipelineOptions(
            do_ocr=False,
            do_table_structure=False,
            document_timeout=DOCUMENT_TIMEOUT_S,
        )
        return DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(pipeline_options=pdf_opts),
                InputFormat.IMAGE: ImageFormatOption(pipeline_options=pdf_opts),
            }
        )
    # high / auto -> default full pipeline (OCR + tables + layout)
    pdf_opts = PdfPipelineOptions(document_timeout=DOCUMENT_TIMEOUT_S)
    return DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pdf_opts),
            InputFormat.IMAGE: ImageFormatOption(pipeline_options=pdf_opts),
        }
    )


def convert_to_text(filename: str, content: bytes, tier: str = "auto") -> Dict[str, Any]:
    """Run Docling and return {markdown, tables, full_text, tier_used, degraded}.

    Auto-degrade chain: high -> low -> light fallback. A heavy-tier crash
    (OOM, timeout, corrupt page) steps down instead of failing the request,
    so low-config/offline systems always get an answer. `degraded=True`
    tells the caller a step-down happened.

    When Docling is not installed (e.g. Vercel), the lightweight
    ``pypdf2_service`` handles digital PDFs via PyPDF2 instead.
    """
    # Auto-detect: use Docling if installed, else PyPDF2.
    if not _use_docling():
        from app.services import pypdf2_service
        out = pypdf2_service.extract_text_from_file(filename, content)
        out["degraded"] = False  # not a degrade — it's the intended path
        return out

    requested = "low" if tier == "low" else "high" if tier == "high" else "auto"
    chain = {"auto": ["high", "low"], "high": ["high", "low"], "low": ["low"]}[requested]
    last_error: Optional[Exception] = None
    for attempt in chain:
        try:
            out = _convert_once(filename, content, attempt)
            out["degraded"] = attempt != chain[0]
            return out
        except RuntimeError:
            # Docling not installed -> skip straight to light fallback.
            break
        except Exception as e:  # OOM / timeout / corrupt file: step down
            last_error = e
            continue
    out = _fallback_parse(filename, content)
    out["degraded"] = True
    if last_error is not None:
        out["degrade_reason"] = f"{type(last_error).__name__}: {last_error}"[:300]
    return out


def _convert_once(filename: str, content: bytes, effective: str) -> Dict[str, Any]:
    """Single-tier conversion; raises on failure so the caller can step down."""
    suffix = Path(filename or "upload.bin").suffix.lower() or ".bin"
    tmp_path = None
    try:
        # RuntimeError (docling missing) propagates to the degrade chain.
        converter = _converter("low" if effective == "low" else "high")
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        result = converter.convert(tmp_path)
        doc = result.document
        markdown = ""
        try:
            markdown = doc.export_to_markdown() or ""
        except Exception:
            markdown = ""
        tables: List[Dict[str, Any]] = []
        full_parts = [markdown]
        try:
            for ti, table in enumerate(getattr(doc, "tables", []) or []):
                try:
                    df = table.export_to_dataframe()
                    cols = [str(c) for c in df.columns.tolist()]
                    rows = df.fillna("").astype(str).values.tolist()
                    # DataFrame headers hold the real header row (Docling uses
                    # the first table row as columns) — prepend them.
                    if cols and any(c.strip() for c in cols):
                        rows = [cols] + rows
                    rows = rows[:60]
                    tables.append({"index": ti, "rows": rows[:60]})
                    full_parts.append("\n".join([" | ".join(r) for r in rows[:60]]))
                except Exception:
                    continue
        except Exception:
            pass
        # Also include raw text items as safety net
        try:
            texts = []
            for item, _level in doc.iterate_items():
                t = getattr(item, "text", None)
                if t:
                    texts.append(str(t))
                if len(texts) > 2000:
                    break
            if texts:
                full_parts.append("\n".join(texts[:2000]))
        except Exception:
            pass
        full_text = "\n".join(p for p in full_parts if p)
        return {
            "markdown": markdown[:20000],
            "tables": tables[:10],
            "full_text": full_text[:30000],
            "tier_used": effective,
        }
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


def _fallback_parse(filename: str, content: bytes) -> Dict[str, Any]:
    """Light fallback when docling is not installed.

    Handles PDFs via PyPDF2 and xlsx/csv/txt via built-in parsers.
    """
    ext = Path(filename or "").suffix.lower()

    # PDFs — use PyPDF2 when available
    if ext == ".pdf":
        try:
            from app.services import pypdf2_service
            return pypdf2_service.extract_pdf_text(filename, content)
        except RuntimeError:
            pass  # PyPDF2 not installed either — fall through

    tables: List[Dict[str, Any]] = []
    texts: List[str] = []
    if ext in (".xlsx", ".xlsm"):
        try:
            from openpyxl import load_workbook
            import io

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
            texts.append(f"[fallback xlsx error: {e}]")
    elif ext == ".csv":
        try:
            text = content.decode("utf-8-sig", errors="replace")
            texts.append(text[:30000])
        except Exception:
            pass
    else:
        try:
            texts.append(content.decode("utf-8", errors="replace")[:30000])
        except Exception:
            texts.append("[binary file: docling required for PDF/image parsing]")
    full = "\n".join(texts)
    return {"markdown": full[:20000], "tables": tables, "full_text": full[:30000], "tier_used": "fallback"}


def docling_available() -> Tuple[bool, str]:
    if not _use_docling():
        try:
            import PyPDF2  # noqa: F401
            return True, "pypdf2-light"
        except ImportError:
            return False, "pypdf2-not-installed"
    try:
        import docling  # noqa: F401

        return True, getattr(__import__("docling"), "__version__", "installed")
    except ImportError:
        return False, "not-installed"
