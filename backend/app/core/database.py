import os

from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

DATABASE_URL = settings.DATABASE_URL
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
IS_SQLITE = DATABASE_URL.startswith("sqlite")

import contextvars
import time

# Performance Monitoring & Profiling context variables
db_query_count: contextvars.ContextVar[int] = contextvars.ContextVar("db_query_count", default=0)
db_query_duration_ms: contextvars.ContextVar[float] = contextvars.ContextVar("db_query_duration_ms", default=0.0)

if IS_SQLITE:
    # Embedded, file-based DB for fully-local (on-premise) installs.
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False, "timeout": 30},
        execution_options={"schema_translate_map": {"master": None}},
        pool_pre_ping=True,
    )

    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_conn, _record):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA busy_timeout=30000")
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()
else:
    engine_kwargs = {
        "pool_pre_ping": True,
        "pool_recycle": 300,  # recycle idle connections every 5 min for Supabase transaction pooler
    }
    # Optimized for Supabase Transaction Pooler (port 6543) on Vercel Functions
    if os.getenv("VERCEL"):
        engine_kwargs["pool_size"] = 2
        engine_kwargs["max_overflow"] = 2
        engine_kwargs["pool_timeout"] = 10
    else:
        engine_kwargs["pool_size"] = 5
        engine_kwargs["max_overflow"] = 5
        engine_kwargs["pool_timeout"] = 10

    connect_args = {
        "connect_timeout": 10,                        # seconds to establish TCP
        "options": "-c statement_timeout=25000",      # milliseconds per SQL stmt
    }
    if os.getenv("VERCEL"):
        connect_args["sslmode"] = "require"
    engine_kwargs["connect_args"] = connect_args
    engine = create_engine(DATABASE_URL, **engine_kwargs)

@event.listens_for(engine, "before_cursor_execute")
def _before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    conn.info.setdefault("_query_starts", []).append(time.perf_counter())

@event.listens_for(engine, "after_cursor_execute")
def _after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    starts = conn.info.get("_query_starts")
    if starts:
        elapsed = (time.perf_counter() - starts.pop()) * 1000.0
        db_query_count.set(db_query_count.get() + 1)
        db_query_duration_ms.set(db_query_duration_ms.get() + elapsed)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

if IS_SQLITE:
    demo_engine = engine.execution_options(schema_translate_map={"master": None})
else:
    demo_engine = engine.execution_options(schema_translate_map={"master": "demo"})

DemoSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=demo_engine)

Base = declarative_base()
Base.metadata.schema = "master"


@event.listens_for(SessionLocal, "before_flush")
@event.listens_for(DemoSessionLocal, "before_flush")
def _stamp_audit_columns(session, _flush_context, _instances):
    """Auto-fill created_by / modified_by from the current request's user."""
    from app.core.audit import current_actor

    actor = current_actor.get()
    if not actor:
        return
    for obj in session.new:
        if hasattr(obj, "created_by") and getattr(obj, "created_by", None) is None:
            obj.created_by = actor
        if hasattr(obj, "modified_by") and getattr(obj, "modified_by", None) is None:
            obj.modified_by = actor
    for obj in session.dirty:
        if hasattr(obj, "modified_by"):
            obj.modified_by = actor


def is_demo_request(request=None) -> bool:
    """Detects if an incoming HTTP request belongs to a demo session."""
    if not request:
        return False
    try:
        # 1. Header flag
        if getattr(request, "headers", None) and request.headers.get("x-demo-mode") == "true":
            return True

        # 2. Path flag
        url_path = getattr(getattr(request, "url", None), "path", "")
        if url_path.endswith("/demo-login"):
            return True

        # 3. JWT Bearer token check
        auth = request.headers.get("authorization") if getattr(request, "headers", None) else None
        if auth and auth.startswith("Bearer "):
            token = auth.split(" ")[1]
            from app.core.security import decode_access_token
            payload = decode_access_token(token)
            if payload and (payload.get("is_demo") or payload.get("user_type") == "D"):
                return True
    except Exception:
        pass
    return False


def get_db(request=None):
    """Yields a database session, dynamically routing demo sessions to the demo schema."""
    if is_demo_request(request):
        db = DemoSessionLocal()
    else:
        db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
