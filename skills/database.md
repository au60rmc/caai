# Database — ImmBiz Books (SQLite / PostgreSQL)

## Overview
Stores all master and transactional data. The same SQLAlchemy models run on
**SQLite** (local, file-based, WAL mode — desktop/on-prem) and **PostgreSQL /
Supabase** (LAN & cloud). Tables live in the `master` schema on Postgres; on
SQLite the schema is transparently translated away.

### Conventions
- **UUID primary keys** (`uuid4`) — enables offline/cloud sync.
- **Soft delete** via an `active` `"Y"/"N"` string flag — masters are never
  hard-deleted. Other flags are single-char strings too (`is_system`, `is_frozen`,
  `is_bank`, `is_cash`, `is_default`).
- **Audit columns** on every master: `created_by`, `modified_by`, `created_date`,
  `modified_date` (auto-stamped from the request user).
- **Extensibility** via a `custom_fields` JSON column.
- Tables are created and seeded on first run by `core/init_db.py` (no separate
  migration folder; Alembic optional/future).

---
## Key Tables

### company
- id, company_name, gstin, pan, address, state, is_default, active, audit cols

### ledger_group
- id, company_id, name, parent_id (hierarchy), key_group, balance_type, active

### ledger (chart of accounts)
- id, company_id, name, ledger_group_id, category, balance_type
- opening_balance, opening_balance_date, description
- gstin, gst_type, default_gst_rate, hsn_sac        (GST & Tax)
- address, contact_person, email, mobile            (Contact)
- credit_limit, payment_terms, default_narration    (Credit & billing)
- tags, cost_center_id, custom_fields (JSON)         (Advanced)
- is_bank, is_cash, is_frozen, is_system, active, audit cols

### party (Customer / Vendor)
- id, company_id, party_type (C/V/Both), name, gstin, pan
- addresses, mobile, email, credit_limit
- linked_ledger_id (auto-created under Sundry Debtors/Creditors)
- custom_fields, active, audit cols

### product_item
- id, company_id, item_code, item_name, item_type (goods/service)
- hsn_sac, gst_rate, purchase_rate, sale_rate
- unit_id, opening_stock, reorder_level, warehouse (conditional inventory)
- custom_fields, active, audit cols

### bank_account
- id, company_id, bank_name, account_no, ifsc, branch
- linked_ledger_id (auto-created), active, audit cols

### gst_rate / hsn_code
- rate tables + HSN/SAC reference data for classification & suggestion

### cost_center · unit_master · custom_field_definition
- supporting masters (hierarchical cost centers, UOMs, per-entity custom fields)

### voucher_header / voucher_detail
- transactional vouchers (Journal, Payment, Receipt, Sales, Purchase, Contra)
- draft → post lifecycle; details are the debit/credit lines

### voucher_sequence
- per-type numbering sequences

### user_master · user_role · app_features · app_module · app_feature_rolemap
- RBAC: users, roles, features (feature codes), modules and role→feature mapping

### lov (List of Values)
- id, key_grp, key_txt, key_value, key_type, display_order, active, audit cols

### system_setting
- key/value app configuration (e.g. period lock BOOKS_LOCKED_UPTO)

### audit_log
- immutable activity trail: entity, entity_id, action, field-level old→new diff,
  actor, timestamp (written by an after_flush listener)

## Rules

- No duplicate master names (per company).
- Use Active/Inactive (`active` = Y/N) instead of delete.
- Every master carries audit columns; writes are audited to `audit_log`.
- Foreign-key integrity enforced (PRAGMA foreign_keys=ON on SQLite).
- `company_id` scopes multi-tenant data.

## Init & Seed

`core/init_db.py` runs on startup for SQLite (or `AUTO_INIT_DB=1` on Postgres):
creates the schema + all tables and seeds an admin user (`admin`/`Admin@123`,
forced change), a default company, a standard chart of accounts, GST rates,
HSN/SAC data, units, cost centers and starter LOVs. `seed_sample_data.py` adds
optional demo business data.
