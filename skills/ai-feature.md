# AI Document Processing Feature — ImmBiz Books

Skill file for the AI-powered invoice/bill/receipt scanning feature.
Upload a PDF, image, Excel or ZIP of documents → auto-extract GST fields →
fill voucher entry forms with one click.

> Rebuild reference: if the AI feature files are ever lost, follow the
> "Rebuild from Scratch" section at the end to recreate everything.

---

## Architecture Overview

```
User uploads file (PDF/image/Excel)
        │
        ▼
┌─────────────────────────┐
│  AiFill.tsx (frontend)  │  POST /api/documents/parse
│  - File picker          │  (multipart form data)
│  - Tier selector        │
│  - Apply-to-form button │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  documents.py router               │  validates upload → calls service
│  POST /api/documents/parse         │  → runs extraction → returns envelope
│  POST /api/documents/parse-batch   │  (ZIP of up to 20 files)
│  GET  /api/documents/status        │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  docling_service.py                │  Auto-detects what's installed:
│  - _use_docling() auto-detect      │  Docling installed → full pipeline
│  - Auto-degrade chain              │  PyPDF2 only → lightweight path
│  - ZIP extraction + guards         │  Returns: {markdown, tables,
│                                    │  full_text, tier_used, degraded}
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  document_extract_service.py       │  Pure regex/ deterministic extraction
│  - GSTIN checksum validation       │  No LLM. Parses text → structured
│  - Invoice no/date (multi-format)  │  fields + line items + confidence
│  - HSN line items + GST%           │
│  - CGST/SGST/IGST totals          │
│  - Totals cross-check              │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  document_match_service.py         │  Reads Party masters (company-scoped)
│  - GSTIN-exact match               │  Returns top-3 candidates with
│  - Name-exact match                │  scores + match type for frontend
│  - Fuzzy name overlap              │
└─────────────────────────────────────┘
```

---

## Hybrid Architecture: Vercel vs Desktop (Auto-Detect)

The app auto-detects at startup — **no env var needed**:

| Environment       | Detection         | PDF engine        | Scanned images | Package size |
|-------------------|-------------------|-------------------|----------------|-------------|
| **Vercel**        | Docling not installed | PyPDF2 (~230KB)   | Not supported  | <250MB limit |
| **Desktop / VPS** | Docling installed  | Docling (~1GB+)   | Full OCR       | Unlimited   |

Priority: `ENABLE_DOCLING` env var (if set) → auto-detect (try import docling).

PyPDF2 handles digital/machine-generated PDFs (GST invoices, Tally exports,
bank statements). Docling adds OCR + TableFormer for scanned photos/bills.

---

## Files Reference

### Backend — New Files (6)

| # | Path | Lines | Purpose |
|---|------|-------|---------|
| 1 | `backend/app/services/docling_service.py` | ~306 | Docling converter, auto-degrade, ZIP extraction, PyPDF2 routing |
| 2 | `backend/app/services/document_extract_service.py` | ~533 | GST invoice field extraction (regex-based, no LLM) |
| 3 | `backend/app/services/document_match_service.py` | ~69 | Server-side party candidate matching |
| 4 | `backend/app/services/pypdf2_service.py` | ~146 | Lightweight PDF/Excel/CSV extractor for Vercel |
| 5 | `backend/app/routers/documents.py` | ~146 | API endpoints: parse, parse-batch, status |
| 6 | `backend/test_document_extract.py` | ~200 | 43 extraction tests (stdlib only, no pytest) |

### Backend — Modified Files (3)

| # | Path | Change |
|---|------|--------|
| 7 | `backend/app/core/config.py` | Add `ENABLE_DOCLING: bool = False` setting |
| 8 | `backend/app/main.py` | Import + wire `documents.router` (2 lines) |
| 9 | `backend/requirements.txt` | Add `PyPDF2`, comment out `docling` |

### Backend — New Config File (1)

| # | Path | Purpose |
|---|------|---------|
| 10 | `backend/requirements-full.txt` | Self-hosted deps with Docling included |

### Frontend — New Files (1)

| # | Path | Lines | Purpose |
|---|------|-------|---------|
| 11 | `frontend-react/src/components/AiFill.tsx` | ~491 | AiModeButton, AiFillPanel, AiExtractView, batch list |

### Frontend — Modified Files (5)

| # | Path | Change |
|---|------|--------|
| 12 | `TradeVoucher.tsx` | Import + aiMode state + rateOptions + fillFormFromAi + AiModeButton/AiFillPanel JSX |
| 13 | `AccountingVouchers.tsx` | Same pattern (target="ACCOUNTING") |
| 14 | `CashVoucher.tsx` | Same pattern (target=mode for PAYMENT/RECEIPT) |
| 15 | `Contra.tsx` | Same pattern (target="CONTRA") |
| 16 | `Journal.tsx` | Same pattern (target="JOURNAL") |

---

## API Endpoints

### `GET /api/documents/status`
Returns Docling availability, allowed extensions, max file size.
```json
{
  "docling": "pypdf2-light",
  "available": true,
  "full_pipeline": false,
  "allowed": [".pdf", ".png", ".jpg", ...],
  "max_mb": 15
}
```

### `POST /api/documents/parse`
Single file upload. Query params: `target` (SALES|PURCHASE|PAYMENT|RECEIPT|JOURNAL|CONTRA|ACCOUNTING), `tier` (auto|low|high).

Returns extracted fields, line items, confidence breakdown, party candidates, warnings.

### `POST /api/documents/parse-batch`
ZIP upload (max 20 files, 50MB total). Same query params. Returns array of per-file results.

---

## Extraction Logic (document_extract_service.py)

The extraction is **pure regex** — no LLM, no AI model. It processes the text
output from Docling/PyPDF2 and extracts:

### Fields Extracted
- **GSTIN** — checksum-validated, assigned to seller/buyer via label proximity
- **Invoice number** — multiple patterns (INV-xxx, Bill No, IRN)
- **Date** — DD/MM/YYYY, DD-MM-YY, "15 May 2025", labeled + unlabeled
- **Place of supply** — from labeled field or GSTIN state code inference
- **Inter-state** — inferred from seller/buyer state code comparison
- **Taxable, CGST, SGST, IGST** — from text or summary tables
- **Grand total** — multiple label variants (Grand Total, Net Amount, etc.)
- **Round-off** — computed from totals cross-check (±2 tolerance)

### Line Items
- Parsed from Docling/PyPDF2 table data or text fallback pattern
- Per-line: description, HSN, qty+unit, rate, discount, GST%, amount
- GST% derived from: explicit column → CGST+SGST split → default 18%

### Confidence Score (0–100)
| Component | Weight | Condition |
|-----------|--------|-----------|
| invoice_no | 20 | Found |
| invoice_date | 15 | Found |
| gstin | 15 | At least one valid GSTIN |
| lines | 20 | ≥1 line item parsed |
| totals_reconcile | 20/10 | Grand = taxable+tax (±2) / grand found |
| tax_breakup | 10 | CGST or SGST or IGST found |

### Totals Cross-Check
Never silently adjusts. Reports difference and warns if `|grand - (taxable + tax)| > 2`.

---

## Party Matching (document_match_service.py)

Read-only queries against `Party` model, scoped by `company_id`.

| Priority | Match Type | Score |
|----------|-----------|-------|
| 1 | GSTIN exact match | 100 |
| 2 | Name exact match | 80 |
| 3 | Name fuzzy (word overlap) | 50–70 |

Returns top 3 candidates. Frontend uses best ≥80 for auto-select, otherwise
shows "Party not matched — select manually" toast.

---

## Frontend Integration

### AiFill.tsx Components

1. **`AiModeButton`** — Toggle button placed in each voucher page header
2. **`AiFillPanel`** — Upload zone + tier selector + batch list + extract view
3. **`AiExtractView`** — Shows all extracted fields, line items, warnings, and
   scanned-vs-form total comparison after Apply

### fillFormFromAi Pattern (per voucher type)

Each voucher page implements `fillFormFromAi(draft: AiDraft)`:

- **TradeVoucher**: Maps party (GSTIN/name match), invoice no, date, lines with qty/rate/GST
- **AccountingVouchers**: Fills reference, date, narration, 2 balanced DEBIT/CREDIT lines
- **CashVoucher**: Matches party ledger from candidates, fills single-line payment/receipt
- **Contra**: Fills date, reference, amount, narration
- **Journal**: Fills date, reference, narration, 2 balanced debit/credit lines

### rateOptions (TradeVoucher)
Merges statutory GST slabs (0, 0.25, 3, 5, 12, 18, 28) + GST master data +
current form line rates. Ensures AI-filled or historical rates always have a
matching `<option>` in the GST% dropdown.

---

## Key Design Decisions

1. **Stateless** — No document retention. Files parsed in-memory, never stored.
2. **No LLM** — Deterministic regex extraction. Fast, auditable, works offline.
3. **Auto-degrade** — High→low→fallback chain. Heavy tier crash steps down.
4. **Company-scoped** — Party matching uses `X-Company-Id` header.
5. **Envelope pattern** — All responses use `AppResponse{status, message, result}`.
6. **Toast tone** — Only `"success" | "error" | "info"` (no `"warning"`).
7. **Draft+review** — AI fills the form; user always reviews before Save.

---

## Rebuild from Scratch

If the AI feature files are lost, recreate in this order:

### Step 1: Backend Config
Edit `backend/app/core/config.py`:
```python
# Add after FRONTEND_URL:
ENABLE_DOCLING: bool = False
```

### Step 2: Backend Services
Create these files in `backend/app/services/`:
1. `docling_service.py` — Docling converter + auto-degrade + PyPDF2 routing
2. `pypdf2_service.py` — Lightweight PDF/Excel/CSV extractor
3. `document_extract_service.py` — GST field extraction (regex)
4. `document_match_service.py` — Party candidate matching

Dependencies: `from app.core.config import settings`, `from app.services.gst_service import STATE_CODES, GstService`, `from app.models.party import Party`

### Step 3: Backend Router
Create `backend/app/routers/documents.py` with endpoints:
- `GET /status` — Docling availability check
- `POST /parse` — Single file upload → extract → return draft
- `POST /parse-batch` — ZIP upload → per-file extraction

Wire in `backend/app/main.py`:
```python
# Add to import list:
from app.routers import documents
# Add to include_router loop:
documents.router,
```

### Step 4: Requirements
Edit `backend/requirements.txt` — add `PyPDF2`, comment out `docling`.
Create `backend/requirements-full.txt` — includes `-r requirements.txt` + `docling`.

### Step 5: Frontend Component
Create `frontend-react/src/components/AiFill.tsx` with:
- `AiModeButton` — toggle button
- `AiFillPanel` — upload + tier + batch + extract view
- `AiExtractView` — extracted fields + line items + warnings + total comparison
- Types: `AiLine`, `AiCandidate`, `AiDraft`, `AiBatchFile`

Uses: `Button`, `Badge`, `Select`, `TableWrap`, `Th`, `Td` from `./ui`
Uses: `getToken`, `getActiveCompanyId`, `envelopeResult` from `../lib/api`
Uses: `money` from `../lib/format`
Uses: `useToast` from `./toast`

### Step 6: Voucher Page Integration (5 pages)
For each page (TradeVoucher, AccountingVouchers, CashVoucher, Contra, Journal):

1. Add import:
```tsx
import { AiModeButton, AiFillPanel, type AiDraft } from "../components/AiFill";
```

2. Add state:
```tsx
const [aiMode, setAiMode] = useState(false);
```

3. Add `fillFormFromAi(draft: AiDraft)` function (see page-specific logic above).

4. Add JSX in the drawer/form view (before main form fields):
```tsx
{!readOnly && canWrite && (
  <div className="flex items-center justify-end mb-3">
    <AiModeButton active={aiMode} onToggle={() => setAiMode((v) => !v)} />
  </div>
)}
{aiMode && !readOnly && (
  <div className="mb-4">
    <AiFillPanel target={KIND} onApply={fillFormFromAi} liveGrandTotal={TOTALS} />
  </div>
)}
```

### Step 7: Verify
```bash
# Backend
pip install PyPDF2
python test_document_extract.py    # 43 tests, all pass

# Frontend
cd frontend-react && npm ci
npx tsc --noEmit                    # clean
npm run build                       # success
```

### Step 8: Deploy
- **Vercel**: Push as-is. Docling not in `requirements.txt` → auto-uses PyPDF2.
- **Desktop**: `pip install -r requirements-full.txt` → Docling installed → auto-uses full pipeline.
- Override with `ENABLE_DOCLING=true/false` in `.env` if needed.

---

## Known Issues & Fixes

### GST% Not Reflecting in Form (Fixed)
**Problem**: AI extracts 18% GST correctly but dropdown shows 0%.
**Cause**: GST% dropdown options built only from GST master data, which may
not contain all statutory slabs.
**Fix**: `rateOptions` merges statutory slabs + master data + form line rates.

### Vercel Deployment Size (Fixed)
**Problem**: Docling package (~1GB) exceeds 250MB serverless limit.
**Fix**: `ENABLE_DOCLING=false` default. PyPDF2 handles digital PDFs.
Docling commented out in `requirements.txt`, available via `requirements-full.txt`.
