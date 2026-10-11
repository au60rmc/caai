# ImmBiz Books — CAAI FA Masters Module (v2)

Project skill file. Full-stack Financial Accounting app implementing the CAAI FA
Master Module specification (v1.0): masters, vouchers, reports, RBAC, audit trail,
multi-company, import/export.

> This is the consolidated overview. The topic files in this folder also describe
> **this** project: [`architecture.md`](architecture.md), [`backend.md`](backend.md),
> [`database.md`](database.md), [`frontend.md`](frontend.md),
> [`suggest.md`](suggest.md) (scaling recommendations), and
> [`ai-feature.md`](ai-feature.md) (AI document processing — Docling/PyPDF2
> invoice scanning with hybrid Vercel/desktop deployment).

---

## Tech stack

- **Backend:** FastAPI 0.116 · SQLAlchemy 2.0 · Pydantic v2 / pydantic-settings.
  Auth via JWT (`python-jose`) + `bcrypt`. Excel/CSV via `openpyxl`.
- **Database:** SQLite locally (WAL mode, file-based, on-prem) · PostgreSQL /
  Supabase-ready for LAN & cloud. Same ORM code path for both.
- **Frontend:** React 18 · Vite 5 · Tailwind CSS 3 · TypeScript (strict) ·
  `react-router-dom` v6 · `lucide-react` icons. **No UI library** — custom
  shadcn-style components in `src/components/ui.tsx`.
- **Deployment:** Vercel serverless (`api/index.py` exposes the ASGI `app`).
  FastAPI also serves the built React SPA (single-origin). Desktop-first SQLite;
  Postgres for multi-user.

---

## Repository layout

```text
api/index.py            # Vercel serverless entry: adds backend/ to sys.path, imports app
vercel.json             # Builds frontend, routes /api/* -> api/index, SPA fallback
README.md               # Spec coverage map + quick start
backend/
  requirements.txt
  seed_sample_data.py   # Optional realistic demo data
  app/
    main.py             # FastAPI app: CORS, audit-actor middleware, startup init_db, SPA mount
    core/
      config.py         # Settings (pydantic-settings); DATABASE_URL + JWT config
      database.py       # Engine/session; SQLite WAL vs Postgres NullPool; audit-stamp hook
      security.py       # bcrypt hashing + JWT encode/decode
      deps.py           # get_current_user, require_permission(feature, action)
      company_context.py# get_company_id from X-Company-Id header / default company
      audit.py          # current_actor ContextVar
      audit_trail.py    # after_flush listener -> master.audit_log
      feature_codes.py  # RBAC feature-code constants (source of truth)
      init_db.py        # First-run: create tables + seed admin/company/COA/GST/units/LOV
    models/             # SQLAlchemy models (schema="master")
    schemas/            # Pydantic v2 schemas + response.py envelope
    routers/            # One APIRouter per module, prefix /api/...
    services/           # Business logic (static methods)
frontend-react/
  vite.config.ts        # Dev server :4300, proxy /api -> 127.0.0.1:8000
  src/
    App.tsx             # Routes (public + /app/* protected)
    main.tsx
    auth/               # AuthContext (user/permissions/can), CompanyContext
    components/         # AppLayout, Sidebar, Topbar, ui.tsx, toast, GlobalSearch,
                        #   ImportDialog, QuickCreate, ActivityDrawer
    lib/                # api.ts, csv.ts, format.ts, gst.ts, hotkeys.ts, vouchers.ts
    pages/              # One page per master / voucher / report
skills/                 # This documentation
```

---

## Architecture & data flow

```mermaid
flowchart LR
  UI[React 18 + Vite + Tailwind SPA] -- fetch /api (Bearer + X-Company-Id) --> API[FastAPI routers]
  API --> SVC[Services layer]
  SVC --> ORM[SQLAlchemy models]
  ORM --> DB[(SQLite / PostgreSQL - schema master)]
  ORM -. after_flush .-> AUDIT[(master.audit_log)]
```

Request path: **router → service → model**. Routers stay thin (auth, company
resolution, validation, response wrapping); services hold all business logic.

---

## Backend conventions

### Layering
- **Routers** (`routers/*.py`): `APIRouter(prefix="/api/<thing>")`. Each endpoint
  wires dependencies (`get_db`, `get_current_user`, `get_company_id`,
  `require_permission(...)`) and calls a service, then wraps the result with a
  local `_resp(...)` helper.
- **Services** (`services/*.py`): logic as `@staticmethod` on a `XService` class.
  Read/write helpers return a **3-tuple** `(data, status_val, message)`; a private
  `_to_dict(obj)` serializes models to plain dicts (UUID→str, Decimal→float, dates→ISO).

### Response envelope
All API responses use `AppResponse` (`schemas/response.py`):

```json
{ "status": "SUCCESS", "message": "…", "result": { } }
```

- `Status` = `SUCCESS | SAVED | DELETED | ERROR`.
- `_resp(data, status_val, message, ok_code=200, err_code=404)` returns a
  `JSONResponse`; when `status_val == ERROR` it uses the error status code.
- UUID/datetime auto-serialize to strings; floats are stringified (`parse_float=str`).

### Auth & RBAC
- JWT bearer tokens (HS256, 24h default — `JWT_EXPIRATION_MINUTES=1440`).
- `get_current_user` decodes the token and loads the active (`active == "Y"`) user.
- `require_permission(FEATURE_X, "view"|"write"|"delete")` is a dependency that
  checks the user's role→feature map; raises 403 on denial.
- Feature codes live in `core/feature_codes.py` (17 constants: `LEDGER`,
  `LEDGER_GROUP`, `CUSTOMER`, `VENDOR`, `ITEMS`, `BANK_CASH`, `GST_SETUP`,
  `COST_CENTER`, `UNITS`, `CUSTOM_FIELD`, `VOUCHER`, `COMPANY`, `USER_ROLE`,
  `USER_MASTER`, `SYSTEM_SETTING`, `LOV`, `REPORT`). **Use these constants, never
  string literals.**

### Multi-company
- `get_company_id` resolves the `X-Company-Id` request header, falling back to the
  default (`is_default == "Y"`) company. Records carry a `company_id` column and
  services filter by it.

### Models
- **UUID primary keys** (`Uuid(as_uuid=True)`, `default=uuid.uuid4`).
- `Base.metadata.schema = "master"` — a real Postgres schema; translated to `None`
  on SQLite via `schema_translate_map`.
- **Soft delete via `active` string flag `"Y"/"N"`** — never hard-delete masters.
  Other flags are also single-char strings: `is_system`, `is_frozen`, `is_bank`,
  `is_cash`, `is_default` (`"Y"/"N"`, **not** Python booleans).
- Audit columns on every master: `created_by`, `modified_by`, `created_date`,
  `modified_date` (auto-stamped — see below).
- Extensible per-record data via a `custom_fields` JSON column.

### Audit trail (automatic)
- Middleware in `main.py` reads the JWT and stores the user id in the
  `current_actor` `ContextVar`.
- `database.py` `before_flush` hook auto-fills `created_by`/`modified_by`.
- `audit_trail.py` `after_flush` listener writes a row to `master.audit_log`
  (field-level old→new diff) for every table in `AUDITED_TABLES`. The frontend
  Activity drawer reads this via `GET /api/audit?entity=&id=`.
- To make a new master audited: add its table name to `AUDITED_TABLES`.

### Database engine (`core/database.py`)
- **SQLite:** `check_same_thread=False`, `timeout=30`, `PRAGMA journal_mode=WAL`,
  `busy_timeout=30000`, `foreign_keys=ON`.
- **Postgres:** `pool_pre_ping=True`; on Vercel (`os.getenv("VERCEL")`) uses
  `NullPool` so each short-lived serverless invocation opens/closes its own
  connection through the Supabase pooler.
- `get_db()` is the standard session-per-request generator dependency.

### Config (`core/config.py`)
- `pydantic-settings.BaseSettings`, reads `../.env`, `case_sensitive=True`.
- `DATABASE_URL` env var overrides the composed Postgres URL (credentials are
  URL-encoded). JWT secret/algorithm/expiry are settings.

### First-run init & seed (`core/init_db.py`)
- Runs automatically on startup for SQLite, or when `AUTO_INIT_DB=1` (set this for
  Postgres). Creates the `master` schema + all tables and seeds: an **admin** user
  (`admin` / `Admin@123`, forced password change), a default company, a standard
  chart of accounts, GST rates, HSN/SAC data, units, cost centers and starter LOVs.

---

## Frontend conventions

### API client (`lib/api.ts`)
- Thin `fetch` wrapper against same-origin `/api` (Vite proxies in dev; FastAPI
  serves in prod). Exposes `api.get/post/put/patch/del`.
- Auto-injects `Authorization: Bearer <token>` and `X-Company-Id` headers from
  `localStorage`.
- On `401` it clears the token and dispatches a global `auth:unauthorized` event.
- Unwrap the envelope with `envelopeOk(r)`, `envelopeMessage(r)`, `envelopeResult(r)`
  — **do not read `r.data.result` directly.**

### Auth & company context
- `auth/AuthContext.tsx`: holds `user`, `permissions`, `isAuthenticated`,
  `mustChangePassword`; exposes `login`, `logout`, `changePassword`, and
  `can(featureCode, action)` for UI gating (mirror of backend `require_permission`).
  State persists in `localStorage`.
- `auth/CompanyContext.tsx`: active-company selection (writes `X-Company-Id`).

### Routing (`App.tsx`)
- Public: `/` (Landing), `/login`, `/change-password`.
- Protected `/app/*` wrapped in `RequireAuth` → `CompanyProvider` → `AppLayout`
  (nested routes). `RequireAuth` redirects unauthenticated users to `/login` and
  forces `/change-password` when `mustChangePassword` is set.
- Customers/vendors share one page: `<Parties kind="C" | "V" />`. Vouchers:
  `Journal`, `CashVoucher mode=PAYMENT|RECEIPT`, `TradeVoucher kind=SALES|PURCHASE`,
  `Contra`.

### UI components (`components/ui.tsx`)
- Custom shadcn-style Tailwind primitives: `Button`, `Input`, `Select`, `Textarea`,
  `Checkbox`, `Field`, `PageHeader`, `Panel`, `SearchBox`, `TableWrap`, `Th`, `Td`,
  `EmptyRow`, `Money`, `Badge`, `Modal`, `Drawer`, `ConfirmDialog`, `RowActions`,
  `Spinner`, `ValidationHint`. Compose classes with `cn()` (`lib/format`).
- Icons from `lucide-react`. Toasts via `useToast()` (`components/toast`).

### Page pattern (masters)
Each master page (e.g. `pages/Ledgers.tsx`) follows the same shape: list grid +
right **Drawer** create/edit form, search + status/type filters, live validation
(`POST /api/<x>/validate`), **ActivityDrawer** (audit history), **ImportDialog**
(CSV upload→map→validate→preview→confirm), CSV export (`lib/csv`), and keyboard
shortcuts via `useHotkeys` (Ctrl+N new, Ctrl+S save, Ctrl+K/F search).

### TypeScript
- Strict mode; the build runs `tsc -b` before `vite build`. Page-local `interface`s
  mirror the backend `_to_dict` shapes (mostly nullable fields + string flags).

---

## Module / feature map

Masters: Company · Ledger Groups · Ledger · Customer/Vendor (Party) · Item/Product ·
Bank & Cash · GST (rates/HSN/validation) · Cost Center · Units · Voucher Types ·
Custom Fields · LOV.
Plus: unified account-only Accounting Voucher (Journal / Payment / Receipt / Sales /
Purchase / Contra), Reports, Dashboard, unified master search, data import, users,
roles, system settings, audit.

Notable domain behaviour:
- Company creation requires `maintain_mode`: `ACCOUNT_ONLY` or
  `ACCOUNT_WITH_INVENTORY`. Existing companies default to `ACCOUNT_ONLY`.
  Account-only companies show Accounting Voucher and Voucher Types. Inventory
  companies show Sales, Purchase, Receipt, Payment, Journal and Contra.
- Customer/Vendor auto-creates a linked ledger under Sundry Debtors/Creditors.
- Bank accounts auto-create a linked ledger; IFSC validated.
- Ledger supports auto group-suggestion, GSTIN checksum validation, merge, freeze.
- GST: `GET /api/gst/validate/{gstin}`, `/api/gst/rates`, `POST /api/gst/classify`
  (CGST/SGST vs IGST).
- Voucher Types use `VOUCHER_BASE_TYPE` LOV values and expose an active company-
  scoped dropdown for voucher entry while numbering remains base-sequence driven.
- Accounting Voucher filters debit/credit account choices by the selected type's
  base category and ledger-group nature. Account-only GST lines are selected
  manually; duplicate ledgers are rejected; references remain optional; numbering
  continues through System Settings → Voucher Numbering.

---

## Local development

```bash
# Backend (API on :8000; also serves built frontend if present)
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
DATABASE_URL="sqlite:///./immbiz.db" uvicorn app.main:app --reload
# First run auto-creates tables and seeds admin + defaults.

# Optional demo data
DATABASE_URL="sqlite:///./immbiz.db" python seed_sample_data.py

# Frontend (dev, hot reload, proxies /api -> :8000)
cd frontend-react
npm install
npm run dev            # http://localhost:4300

# Production build (FastAPI then serves ./dist at :8000)
npm run build
```

- **Default login:** `admin` / `Admin@123` (password change forced on first login).
- **PostgreSQL:** set `DATABASE_URL=postgresql://user:pass@host/db` and `AUTO_INIT_DB=1`.

---

## Conventions checklist (when adding a feature)

1. **Model** in `models/`: UUID PK, `company_id`, `active`/`is_system` string flags,
   audit columns, optional `custom_fields` JSON. Register it in `init_db.py` imports.
2. **Schema** in `schemas/`: Pydantic v2 `XBase/XCreate/XUpdate`; use `Optional` +
   `Field(max_length=...)`.
3. **Service** in `services/`: `XService` with `@staticmethod`s returning
   `(data, status, message)` and a `_to_dict` serializer.
4. **Router** in `routers/`: `prefix="/api/x"`, guard every route with
   `require_permission(FEATURE_X, ...)`, resolve `company_id`, wrap via `_resp`.
   Register the router in `app/main.py`.
5. **RBAC:** add a constant to `feature_codes.py` if it's a new feature; seed its
   role mapping.
6. **Audit:** add the table name to `AUDITED_TABLES` for activity history.
7. **Frontend:** new `pages/X.tsx` following the list+drawer pattern, a route in
   `App.tsx`, a sidebar entry, and gate actions with `can(FEATURE_X, action)`.
8. **Never** hard-delete masters (flip `active`), never send raw SQL from routers,
   never bypass the response envelope, never hardcode feature-code strings.
