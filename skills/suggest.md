Recommendations to scale and improve the performance, availability and
maintainability of **ImmBiz Books** (CAAI FA Masters Module), tuned to its actual
stack (**React 18 + Vite, FastAPI, SQLAlchemy, SQLite / PostgreSQL / Supabase,
Vercel serverless**). Items already implemented are called out so effort can go to
the gaps.

---

### 1. Availability & Deployment Architecture

The app already runs FastAPI as a **Vercel serverless** function (`api/index.py`)
and serves the built SPA single-origin.

* **Serverless (current):** stateless functions auto-scale horizontally. Keep the
  `NullPool` setting (already enabled when `VERCEL` is set) so each short-lived
  invocation opens and closes its own connection through the Supabase pooler — a
  persistent pool would exhaust Postgres connections.
* **Supabase connections:** always connect via the **pooler (PgBouncer, transaction
  mode)**, not the direct `5432` port, from serverless functions.
* **Self-hosted option:** if you outgrow serverless, run **Gunicorn + Uvicorn
  workers** (`uvicorn.workers.UvicornWorker`) behind **Nginx/Traefik** for SSL
  termination, gzip/brotli and load balancing.

---

### 2. Database Scaling

Masters are **read-heavy** (dropdowns, search, validation) versus transactional writes.

* **Primary-Replica reads:** on Postgres, route writes to the primary and reads to
  replicas; keep vouchers and the audit log strictly on the primary for consistency.
* **Indexing:** ensure indexes on `company_id`, `active`, `name`, `gstin`,
  `hsn_sac`, `ledger_group_id` and voucher `(company_id, voucher_date)` — the
  columns used by multi-tenant scoping and search/filter.
* **SQLite → Postgres path:** SQLite (WAL) suits desktop/on-prem; move to
  Postgres/Supabase for multi-user. UUID keys already make migration and cloud
  sync straightforward.

---

### 3. Performance

* **Caching layer (Redis):** cache rarely-changing reference data (GST rates,
  HSN/SAC, LOVs, chart-of-account templates) with a Cache-Aside pattern + TTL. On
  serverless, use a managed HTTP Redis (e.g. Upstash).
* **Query shape:** services already serialize via `_to_dict` and support
  `skip`/`limit`; eager-load ledger/group/party relations on list endpoints to
  avoid N+1 queries.
* **Frontend:** code-split heavy pages (reports, voucher screens) with
  `React.lazy`, and debounce live-validation and global-search calls.

---

### 4. Maintainability & Code Structure

The layered **router → service → model** structure is already in place. To keep it
clean as modules grow:

* **Keep routers thin:** all logic in services returning `(data, status, message)`;
  never inline SQL or business rules in routers, never bypass the response envelope.
* **Type safety across the wire:** generate TypeScript types from the Pydantic v2
  schemas (e.g. `pydantic-to-typescript` or OpenAPI codegen) instead of
  hand-writing page-local interfaces, to keep front and back in sync.
* **Centralised constants:** keep using `core/feature_codes.py` for RBAC codes; add
  the same pattern for voucher types and LOV groups.
* **Tests & CI:** expand the existing backend integration tests and run
  `tsc --strict` + `vite build` on every PR.

---

### 5. Enterprise Accounting Considerations (mostly built)

* **Audit trail:** already implemented — an immutable `audit_log` written by an
  `after_flush` listener with field-level old→new diffs and the acting user.
  Consider periodic archival/partitioning as the log grows.
* **Period lock / freeze:** `system_setting` (`BOOKS_LOCKED_UPTO`) and the ledger
  `is_frozen` flag exist; enforce them consistently in every write path.
* **Migrations:** `init_db.py` seeds a fresh DB, but for an evolving Postgres schema
  introduce **Alembic** and gate migrations in CI to avoid sequential conflicts.
* **Backups:** SQLite backup/restore is desktop-oriented; on Supabase enable
  point-in-time recovery and scheduled backups.
