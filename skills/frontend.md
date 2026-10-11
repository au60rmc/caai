# Frontend — ImmBiz Books (React 18 + Vite + Tailwind)

## Overview
Single-page app for all masters, vouchers and reports, built with React 18, Vite 5,
Tailwind CSS 3 and TypeScript (strict). No component library — a small set of
custom shadcn-style primitives lives in `src/components/ui.tsx`. Icons come from
`lucide-react`.

## Features
- List/grid views with search + status/type/GST filters
- Create/Edit via slide-in **Drawer** forms (Tally-fast, Zoho-clear)
- Live validation (duplicate / GSTIN) against `/api/<x>/validate`
- Status toggle (Active/Inactive) — soft delete, never hard delete
- Activity drawer (audit history), CSV import wizard + export
- Quick-create popups and global search (Ctrl+K)
- Keyboard shortcuts: Ctrl+N (new), Ctrl+S (save), Ctrl+K / F (search)

## Building Blocks

- `react-router-dom` v6 for routing
- Custom UI in `components/ui.tsx`: Button, Input, Select, Textarea, Checkbox,
  Field, PageHeader, Panel, SearchBox, TableWrap/Th/Td, Badge, Money, Modal,
  Drawer, ConfirmDialog, RowActions, Spinner, ValidationHint
- Toasts via `useToast()` (`components/toast`); classnames via `cn()` (`lib/format`)

## API Client (`lib/api.ts`)

- Thin `fetch` wrapper over same-origin `/api` (Vite proxies to `:8000` in dev).
- Auto-injects `Authorization: Bearer <token>` and `X-Company-Id` headers.
- On `401`: clears the token and dispatches a global `auth:unauthorized` event.
- Unwrap responses with `envelopeOk`, `envelopeMessage`, `envelopeResult` — do NOT
  read `data.result` directly.

## Auth & Company Context

- `auth/AuthContext.tsx`: `user`, `permissions`, `isAuthenticated`,
  `mustChangePassword`, and `can(featureCode, action)` for gating UI actions
  (mirrors the backend `require_permission`). Persisted in `localStorage`.
- `auth/CompanyContext.tsx`: active-company selection → `X-Company-Id`.

## Code Structure Rules

- Function components + hooks only (no class components).
- Styling is **Tailwind utility classes** (compose via `cn()`); no CSS-in-JS and
  no per-component `.css` files.
- Reuse `components/ui.tsx` primitives — do not hand-roll raw inputs/buttons.
- All server calls go through `lib/api.ts` (never call `fetch` directly).
- Page-local `interface`s mirror the backend `_to_dict` shapes (nullable fields,
  `"Y"/"N"` string flags).
- Gate every mutating action behind `can(FEATURE_X, "write"|"delete")`.

## Folder Structure

frontend-react/
 └── src/
     ├── main.tsx               # entry
     ├── App.tsx                # routes (public + /app/* protected)
     ├── index.css              # Tailwind layers
     ├── auth/
     │   ├── AuthContext.tsx
     │   └── CompanyContext.tsx
     ├── components/
     │   ├── AppLayout.tsx      # shell (Sidebar + Topbar + <Outlet/>)
     │   ├── Sidebar.tsx, Topbar.tsx
     │   ├── ui.tsx             # shared primitives
     │   ├── toast.tsx
     │   ├── GlobalSearch.tsx, QuickCreate.tsx
     │   └── ImportDialog.tsx, ActivityDrawer.tsx
     ├── lib/
     │   └── api.ts, csv.ts, format.ts, gst.ts, hotkeys.ts, vouchers.ts
     └── pages/                 # Dashboard, Ledgers, Parties, Products, ...

## Routing (`App.tsx`)

- Public: `/` (Landing), `/login`, `/change-password`.
- Protected `/app/*` wrapped in `RequireAuth → CompanyProvider → AppLayout` with
  nested routes; forces `/change-password` when `mustChangePassword` is set.
- Customers/vendors share one page: `<Parties kind="C" | "V" />`.
- `ACCOUNT_ONLY` companies use `/app/accounting-vouchers` plus Voucher Types.
  `ACCOUNT_WITH_INVENTORY` companies use the specialized Sales, Purchase,
  Receipt, Payment, Journal and Contra routes.

## Page Pattern (masters)

List grid + right Drawer form, search + filters, live validation, ActivityDrawer,
ImportDialog (upload→map→validate→preview→confirm), CSV export, and `useHotkeys`.

## UX Rules
- Desktop-first, responsive layout.
- Clear inline validation (red/yellow/green) and toast feedback.
- Smart defaults and keyboard-first flows.
