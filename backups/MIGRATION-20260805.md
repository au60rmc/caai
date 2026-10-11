# ImmBiz Supabase Migration - 2026-08-05

## Scope

- Source: `~/Library/Application Support/ImmBizBooks/immbiz.db` (SQLite, 18 tables)
- Target: Supabase project `ywgnrqlvnhfrelkazpvj`, PostgreSQL schema `master`
- Strategy: non-destructive natural-key merge into active `My Company`
- Existing Supabase records were preserved.

## Backups

- Before migration, local source: `local-immbiz-before-supabase-20260805-221218.db`
  - SHA-256: `aee8a2b3463c0e239a0e08108066c67889378b9b7ff7aea6c7ce9d2d03221c82`
- Before migration, Supabase master schema: `supabase-master-before-import-20260805-221218.dump`
  - SHA-256: `f9fa07ec88a12528ca2e2af2674076943436f9e0dcc86b40aa8ee89bf57e14d5`
- After migration, Supabase master schema: `supabase-master-after-import-20260805-222442.dump`
  - SHA-256: `6eca869ccd80dcbf221554e1df93e13cda704716f39524816f14c134288cd445`

All backups passed integrity/catalog checks.

## Merge Result

- Reused existing logical records: modules, features, role permissions, common groups, common ledgers, common LOVs, four products, and Journal sequence.
- Inserted: 2 customer signups, 5 ledgers, 9 ledger groups, 5 LOV rows, 5 parties, 1 product, 1 user, 4 user attributes, 8 login-audit rows, 1 user-role mapping, 1 voucher header, and 2 voucher lines.
- Schema upgrade added Voucher Types, Accounting Voucher metadata, six base LOV values, RBAC metadata, and voucher-header references.

Final key counts:

- `ledger`: 72
- `ledger_group`: 66
- `lov`: 84
- `party`: 20
- `product_item`: 5
- `user_master`: 9
- `voucher_header`: 9
- `voucher_detail`: 30
- `voucher_type`: 18

## Verification

- Repeat migration dry run planned zero inserts.
- All local natural keys are represented in Supabase.
- Imported local `JV0001` retained date `2026-07-20`, narration `Cash sales`, status `POSTED`, total `10000`, and Cash/Sales lines.
- Ledger, party, voucher, Voucher Type, and user relationship orphan checks all returned zero.
- Supabase-backed API login, RBAC, active Voucher Types, and Accounting Voucher listing passed.

## Restore Into Another Compatible Project

Set the destination connection URL in your terminal, then restore only the application schema:

```bash
export NEW_DATABASE_URL='postgresql://...'
/opt/homebrew/opt/libpq/bin/pg_restore \
  --clean --if-exists \
  --no-owner --no-privileges \
  --dbname="$NEW_DATABASE_URL" \
  backups/supabase-master-after-import-20260805-222442.dump
```

This dump contains only the `master` application schema. It does not replace Supabase-managed `auth`, `storage`, or other platform schemas.
