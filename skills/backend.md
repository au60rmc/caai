# Backend — ImmBiz Books (FastAPI)

## Setup

### Create & activate a virtual environment
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

### Install
pip install -r requirements.txt
# fastapi, uvicorn, sqlalchemy, psycopg2-binary, pydantic, pydantic-settings,
# python-jose[cryptography], bcrypt, python-multipart, openpyxl, python-dotenv

### Run (SQLite; auto-creates tables + seeds admin on first run)
DATABASE_URL="sqlite:///./immbiz.db" uvicorn app.main:app --reload

### Run against PostgreSQL / Supabase
DATABASE_URL="postgresql://user:pass@host/db" AUTO_INIT_DB=1 uvicorn app.main:app --reload

Default login: admin / Admin@123 (password change forced on first login).

## Structure

backend/
 └── app/
     ├── main.py                 # app, CORS, audit-actor middleware, startup init, SPA mount
     │
     ├── core/
     │   ├── config.py           # pydantic-settings; DATABASE_URL + JWT
     │   ├── database.py         # engine/session; SQLite WAL vs Postgres NullPool
     │   ├── security.py         # bcrypt hashing + JWT encode/decode
     │   ├── deps.py             # get_current_user, require_permission
     │   ├── company_context.py  # get_company_id (X-Company-Id header)
     │   ├── audit.py / audit_trail.py   # current_actor + after_flush audit log
     │   ├── feature_codes.py    # RBAC feature-code constants
     │   └── init_db.py          # first-run create tables + seed
     │
     ├── models/                 # SQLAlchemy models (schema="master")
     ├── schemas/                # Pydantic v2 schemas + response.py envelope
     ├── routers/                # One APIRouter per module (prefix /api/...)
     └── services/               # Business logic (XService static methods)


---


## Layering

Router → Service → Model.
- **Routers** wire dependencies (`get_db`, `get_current_user`, `get_company_id`,
  `require_permission`) and wrap results with a local `_resp()` helper.
- **Services** expose `@staticmethod`s returning a 3-tuple `(data, status, message)`
  plus a private `_to_dict()` serializer (UUID→str, Decimal→float, dates→ISO).
- **Models** are the SQLAlchemy ORM tables.

## Response Envelope

All endpoints return `AppResponse` (`schemas/response.py`):
```json
{ "status": "SUCCESS", "message": "…", "result": { } }
```
`Status` ∈ `SUCCESS | SAVED | DELETED | ERROR`. `_resp(...)` sets the HTTP status
(error code when `status == ERROR`).

## Auth & RBAC

- JWT bearer tokens (HS256, 24h). `get_current_user` loads the active user.
- `require_permission(FEATURE_X, "view"|"write"|"delete")` guards each route.
- Feature codes are constants in `core/feature_codes.py` — never string literals.

## Multi-company

`get_company_id` resolves the `X-Company-Id` header (default company fallback).
Records carry `company_id`; services filter by it.

## Representative API Endpoints

### Ledger
GET   /api/ledgers
POST  /api/ledgers
GET   /api/ledgers/{id}
POST  /api/ledgers/validate
GET   /api/ledgers/suggest-group
POST  /api/ledgers/quick-create
POST  /api/ledgers/merge

### Party (Customer/Vendor)
GET   /api/parties
POST  /api/parties
POST  /api/parties/quick-create

### Item
GET   /api/items
POST  /api/items

### GST / search / import / audit
GET   /api/gst/validate/{gstin}
GET   /api/gst/rates
POST  /api/gst/classify
GET   /api/master/search
POST  /api/import/...
GET   /api/audit?entity=&id=

## Responsibilities

- Authentication + RBAC enforcement
- Validation and duplicate checks
- Business logic (auto-ledger creation, GST classification, merge, freeze)
- DB interaction + automatic audit logging
