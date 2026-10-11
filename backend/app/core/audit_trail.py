"""Immutable audit/activity trail for master-data changes.

A SQLAlchemy after_flush listener captures CREATE / UPDATE / DELETE on every
audited master table and writes a row to master.audit_log with the changed
fields (old -> new), the acting user and a timestamp.
"""
import datetime
import json
import uuid

from sqlalchemy import event, inspect as sa_inspect

from app.core.audit import current_actor
from app.core.database import SessionLocal
from app.models.audit_log import AuditLog

AUDITED_TABLES = {
    "company",
    "ledger",
    "ledger_group",
    "party",
    "product_item",
    "bank_account",
    "gst_rate",
    "hsn_code",
    "cost_center",
    "unit_master",
    "custom_field_definition",
    "voucher_header",
    "voucher_type",
    "voucher_sequence",
    "user_master",
    "user_role",
    "lov",
    "system_setting",
}

_SKIP_FIELDS = {"modified_date", "updated_at", "updated_time", "created_date",
                "created_at", "created_time", "modified_by", "created_by"}


def _ser(v):
    if v is None:
        return None
    if isinstance(v, (str, int, float, bool)):
        return v
    return str(v)


def _entity_name(obj):
    return getattr(obj, "__tablename__", obj.__class__.__name__)


def _display_name(obj):
    for attr in ("name", "item_name", "voucher_no", "user_name", "role_name",
                 "company_name", "bank_name", "unit_name", "field_name",
                 "key_grp", "key_name", "voucher_type", "code"):
        v = getattr(obj, attr, None)
        if v:
            return str(v)
    nci = getattr(obj, "name_contact_info", None)
    if isinstance(nci, dict):
        return nci.get("display_name") or nci.get("first_name") or ""
    return ""


def _changes_for(obj):
    changes = {}
    state = sa_inspect(obj)
    for attr in state.attrs:
        if attr.key in _SKIP_FIELDS:
            continue
        hist = attr.history
        if not hist.has_changes():
            continue
        old = hist.deleted[0] if hist.deleted else None
        new = hist.added[0] if hist.added else None
        if _ser(old) == _ser(new):
            continue
        changes[attr.key] = {"old": _ser(old), "new": _ser(new)}
    return changes


@event.listens_for(SessionLocal, "after_flush")
def _write_audit_rows(session, _ctx):
    rows = []
    actor = current_actor.get()
    now = datetime.datetime.utcnow()

    def add(obj, action, changes=None):
        table = _entity_name(obj)
        if table not in AUDITED_TABLES:
            return
        rows.append(
            dict(
                id=uuid.uuid4(),
                entity=table,
                entity_id=str(getattr(obj, "id", "")),
                entity_name=_display_name(obj)[:100],
                action=action,
                changes=json.dumps(changes) if changes else None,
                actor=str(actor) if actor else None,
                created_date=now,
            )
        )

    for obj in session.new:
        if isinstance(obj, AuditLog):
            continue
        add(obj, "CREATE")
    for obj in session.dirty:
        if isinstance(obj, AuditLog) or not session.is_modified(obj):
            continue
        changes = _changes_for(obj)
        if changes:
            action = "UPDATE"
            if changes.get("active", {}).get("new") == "N":
                action = "DEACTIVATE"
            elif changes.get("active", {}).get("new") == "Y" and changes.get("active", {}).get("old") == "N":
                action = "ACTIVATE"
            add(obj, action, changes)
    for obj in session.deleted:
        if isinstance(obj, AuditLog):
            continue
        add(obj, "DELETE")

    if rows:
        session.connection().execute(AuditLog.__table__.insert(), rows)
