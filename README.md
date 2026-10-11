tr-8

# ImmBiz Books — CAAI FA Masters Module (v2)

Complete implementation of the **FA Master Module** specification (CAAI Financial
Accounting, Version 1.0): functional behaviour, UI/UX, data model, service APIs and
desktop-first deployment.

**Stack:** FastAPI + SQLAlchemy (SQLite locally, PostgreSQL-ready) · React 18 + Vite + Tailwind.

## Quick start

```bash
# 1. Backend (serves the API on :8000 and the built frontend)
cd backend
python -m venv .venv && source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt
DATABASE_URL="sqlite:///./immbiz.db" uvicorn app.main:app --reload
# First run auto-creates tables and seeds everything.

# Optional: realistic sample business data
DATABASE_URL="sqlite:///./immbiz.db" python seed_sample_data.py

# 2. Frontend (dev mode with hot reload, proxies /api to :8000)
cd frontend-react
npm install
npm run dev            # http://localhost:4300

# Production build (then FastAPI serves it directly at :8000)
npm run build
```

**Default login:** `admin` / `Admin@123` (a password change is forced on first login).
For PostgreSQL set `DATABASE_URL=postgresql://user:pass@host/db` and `AUTO_INIT_DB=1`.

## Spec coverage map

| Spec section | Where |
|---|---|
| 1–2 Masters coverage | Company, Ledger Groups, Ledger, Customer/Vendor, Item, Bank & Cash, GST, Cost Center, Units, Voucher Types, Custom Fields |
| Company maintenance mode | Company creation requires **Account only** or **Account with inventory**. Account-only companies show Accounting Voucher and Voucher Types; inventory companies show Sales, Purchase, Receipt, Payment, Journal and Contra. |
| 3 UX (Tally speed + Zoho clarity) | Drawer forms, contextual sections, smart defaults, Ctrl+N / Ctrl+S / Ctrl+K(F) shortcuts |
| 4 Masters dashboard | `/app/dashboard` — tile + list hybrid with health counts (`GET /api/dashboard/summary`) and quick actions |
| 4.2 Standard screen layout | Header actions (New/Import/Export), search + status/GST/type filters, grid, right quick panel (Parties), Activity everywhere |
| 5 Ledger master | Basic / GST & Tax (contextual) / Contact / Credit & Billing / Advanced sections; auto-suggest group, live duplicate + GSTIN validation, Save & New, soft delete, freeze flag, merge |
| 6 Customer/Vendor | Auto-created linked ledger mapped to Sundry Debtors/Creditors, Customer/Vendor/Both, GSTIN+PAN, multiple addresses, outstanding preview, duplicate checks, inactive-not-deleted |
| 7 Item master | Goods/service type, pricing, HSN/SAC + GST, conditional inventory (unit/opening stock/reorder/warehouse), HSN suggestion, duplicate detection, bulk import |
| 8 Inline create / import / bulk / validation | Quick-create popups (ledger from voucher screen; party/item endpoints), CSV import wizard (upload→map→validate→preview→confirm→error report), bulk activate/deactivate + bulk GST + bulk category + export, red/yellow/green validation UX |
| 9–10 Database design | UUID PKs, soft delete via `active`, audit columns, JSON custom fields, FK integrity, hierarchy path, indexes, merge with audit trail, freeze/lock, period lock (`BOOKS_LOCKED_UPTO`) |
| Voucher Type v2 | `/app/voucher-types` list + drawer; LOV-backed base types; company-scoped CRUD/RBAC/audit; soft deactivation; active configured types on all voucher entry screens; stable historical references |
| Accounting Voucher | `/app/accounting-vouchers` unified list + account-only drawer; active configured Voucher Types; debit/credit ledger filtering by group/nature; dynamic lines; balance, active-ledger and duplicate checks; draft/post/edit; soft delete |
| 11 Services | `app/services/*`: ledger, party, item, gst, bank, master search, audit, import — service-aligned modules |
| 12 API contracts | REST v1-style JSON APIs: validate/quick-create/status endpoints, `GET /api/gst/validate/{gstin}`, `/api/gst/rates`, `POST /api/gst/classify`, `GET /api/master/search`, `/api/import/*`, `GET /api/audit?entity=&id=` |
| 13 UI→API mapping | Search dropdown → master search; inline validation → validate endpoints; activity tab → audit API |
| 14 Deployment | Desktop-first SQLite (WAL) with backup/restore, Postgres for LAN, UUIDs for cloud sync |
| 15 Priorities | Common grid + drawer components, custom-field framework, validation engine, global search, audit logging, Excel/CSV import-export, quick-create APIs — all built |

## Verified

Backend integration tests cover: login + forced password change, RBAC (16 features),
dashboard summary, GSTIN format/state/checksum validation, CGST/SGST vs IGST
classification, ledger validate/quick-create/merge, party quick-create with
auto-ledger, outstanding preview, item quick-create + HSN suggestion, bank account
auto-ledger + IFSC validation, custom field definitions, unified search, CSV import
with per-row error report, bulk status, voucher draft→post lifecycle and the
immutable audit trail. The React app builds clean under `tsc --strict`.
