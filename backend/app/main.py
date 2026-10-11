from __future__ import annotations

import os
import time
from pathlib import Path
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.core.database import IS_SQLITE, db_query_count, db_query_duration_ms
from app.routers import (
    product_item,
    lov,
    user_role,
    user_master,
    user_company_map,
    system_setting,
    auth,
    party,
    ledger_group,
    ledger,
    voucher_sequence,
    voucher_type,
    voucher_header,
    backup,
    company,
    bank_account,
    gst,
    cost_center,
    unit,
    custom_field,
    audit,
    master_search,
    dashboard,
    data_import,
    documents,
    api_v1,
    reports,
    subscription,
)

# Attach the audit-trail flush listener (imports all audited models).
import app.core.audit_trail  # noqa: F401

app = FastAPI(
    title="CAAI FA Masters Module API",
    description="Masters module for the CAAI Financial Accounting package: "
    "Company, Ledger, Party, Item, Bank & Cash, GST, Cost Center, Units, "
    "Custom Fields, unified search, import/export, bulk actions and audit.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def _set_audit_actor(request, call_next):
    # Make the authenticated user's id available to the audit stamping listener.
    from app.core.audit import current_actor
    from app.core.security import decode_access_token

    actor = None
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        payload = decode_access_token(auth_header[7:])
        if payload:
            actor = payload.get("user_id")
    token = current_actor.set(actor)
    db_query_count.set(0)
    db_query_duration_ms.set(0.0)
    started_at = time.perf_counter()
    try:
        response = await call_next(request)
        total_ms = (time.perf_counter() - started_at) * 1000.0
        db_ms = db_query_duration_ms.get()
        sql_cnt = db_query_count.get()
        # Exposes server processing and DB execution metrics in browser DevTools
        response.headers["Server-Timing"] = (
            f"app;dur={total_ms:.1f}, db;dur={db_ms:.1f}, sql_cnt;dur={sql_cnt}"
        )
        return response
    finally:
        current_actor.reset(token)


@app.on_event("startup")
def _startup_init_db() -> None:
    import logging
    import os

    logger = logging.getLogger(__name__)

    if IS_SQLITE:
        # Local / on-premise SQLite: run directly
        try:
            from app.core.init_db import init_db

            init_db()
        except Exception as e:
            logger.warning("Startup init_db notice: %s", e)
        return

    # Serverless PostgreSQL (Vercel / Supabase):
    # Fast-path: Check if the database has already been initialized and seeded.
    # If users exist, skip the heavy 60+ migration queries so startup takes ~2ms.
    force_migrations = os.getenv("RUN_MIGRATIONS_ON_STARTUP") == "1"
    if os.getenv("VERCEL") and not force_migrations:
        return
    if not force_migrations:
        try:
            from sqlalchemy import text
            from app.core.database import engine

            with engine.connect() as conn:
                is_ready = conn.execute(
                    text("SELECT 1 FROM master.user_master LIMIT 1")
                ).scalar()
                if is_ready:
                    # Do not run schema checks, data backfills, or seeding while
                    # a serverless instance starts. Those operations add several
                    # database round-trips to cold starts and belong in an
                    # explicit migration/deployment task.
                    logger.info("Database is already initialized; skipping startup migrations.")
                    return
        except Exception:
            # Table doesn't exist yet or first-time setup; proceed to initialize.
            pass

    # Uninitialized DB or explicit migration requested: run under advisory lock
    from sqlalchemy import text
    from app.core.database import engine

    ADVISORY_LOCK_ID = 8675309  # unique int64 lock identifier

    try:
        with engine.connect() as conn:
            got_lock = conn.execute(
                text("SELECT pg_try_advisory_lock(:id)"),
                {"id": ADVISORY_LOCK_ID},
            ).scalar()

            if not got_lock:
                logger.info(
                    "Startup init_db skipped — another instance holds the migration lock."
                )
                return

            try:
                from app.core.init_db import init_db

                init_db()
                logger.info("Startup init_db completed successfully.")
            finally:
                conn.execute(
                    text("SELECT pg_advisory_unlock(:id)"),
                    {"id": ADVISORY_LOCK_ID},
                )
                conn.commit()
    except Exception as e:
        logger.warning("Startup init_db notice: %s", e)


for r in (
    product_item.router,
    lov.router,
    user_role.router,
    user_role.features_router,
    user_role.modules_router,
    user_master.router,
    user_company_map.router,
    system_setting.router,
    auth.router,
    party.router,
    ledger_group.router,
    ledger.router,
    voucher_sequence.router,
    voucher_type.router,
    voucher_header.router,
    backup.router,
    company.router,
    bank_account.router,
    gst.router,
    cost_center.router,
    unit.router,
    custom_field.router,
    audit.router,
    master_search.router,
    dashboard.router,
    data_import.router,
    documents.router,
    api_v1.router,
    reports.router,
    subscription.router,
    subscription.v1_compat_router,
):
    app.include_router(r)


@app.get("/health")
def health_check():
    return {"status": "healthy"}


def _resolve_frontend_dir() -> Optional[Path]:
    env_dir = os.getenv("FRONTEND_DIST")
    candidates = []
    if env_dir:
        candidates.append(Path(env_dir))
    candidates.append(
        Path(__file__).resolve().parents[2] / "frontend-react" / "dist"
    )
    for c in candidates:
        if c and c.is_dir() and (c / "index.html").is_file():
            return c
    return None


_FRONTEND_DIR = _resolve_frontend_dir()

if _FRONTEND_DIR is not None:
    app.mount(
        "/assets",
        StaticFiles(directory=_FRONTEND_DIR / "assets"),
        name="assets",
    )

    _INDEX = _FRONTEND_DIR / "index.html"

    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        candidate = _FRONTEND_DIR / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_INDEX)
else:
    @app.get("/")
    def root():
        return {"message": "CAAI FA Masters Module API", "status": "running"}
