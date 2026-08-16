# Teleconi Tracker — PRD

## Original Problem Statement
Build a mobile app (Android & iOS) exactly matching the HTML mockup
`Telecony_Ops_Tracker_Draft29.html`. User language: Indonesian.

## Architecture
- Frontend: Expo Router (React Native), mockup screen at `/app/frontend/app/index.tsx`.
- Root layout: `SafeAreaProvider` + `KeyboardProvider` (react-native-keyboard-controller).
- Backend: FastAPI + MongoDB + JWT built in `/app/backend/server.py` — NOT wired yet
  (schema predates Draft29 changes: invoices, posts/categories).

## Draft29 structure (current)
- 4 bottom tabs: Dashboard, PO & Invoice, Submit Ops, Employee.
- Settings icon (top-right) → Change Password screen.
- Dashboard: project filter, profitability hero, 4 KPI, budget utilization,
  financial summary table, monthly cost trend, cost by project/user/category.
- PO & Invoice: Add PO / Search, 2 PO cards, Invoice Status list (4 invoices, toggle
  Terbayar/Belum).
- Submit Ops: Date, Project, Site, Post (2.0–7.0), Category (depends on Post),
  Amount, optional Keterangan, required Remarks (validated), Transaction History.
- Employee Management: intro notice, profile card, editable email/address form,
  Employee List (Andi/Budi/Citra/Deni), Salary Status table (toggle paid).

## Implemented (2026-08-16)
- Full mockup replicating Draft29; users seeded from user-id.xlsx (password `123`).
- FULLY WIRED TO BACKEND: auth (JWT, persisted), Employee (list/save/add, Owner-only),
  Dashboard (real KPIs + trend + cost_by_project/category/user), PO (list/create),
  Invoice (list + toggle paid), Submit Ops (create cost + transaction history).
- Role-based tab access: Owner = Dashboard/PO&Invoice/Submit Ops/Employee;
  PM & PCM = PO&Invoice + Submit Ops; Engineer = Submit Ops only. Enforced in UI
  (allowedScreens) and on server (403 for non-Owner on employee writes).
- Logout button in header (appbar-logout) clears token → login.
- Verified: 17/17 backend pytest passed; frontend role tabs + logout + create flows OK.

## Implemented (2026-08-16, latest sync)
- Submit Ops: removed "Remarks"; "Site Name *" mandatory (placeholder "Input nama kota");
  Transaction History shows date • site_name + submitter username; Owner-only delete with
  confirm modal → DELETE /api/costs/{id}.
- PO & Invoice: Add/Delete PO & Invoice (Owner/PM/PCM). Add PO form = PO Number, Site Code,
  Release Date, PO Amount, Status(Plan/Active). PO card shows those fields + status badge;
  removed Remaining PO / Actual Cost / Cost Utilization. Add Invoice modal + delete per row,
  all with confirm modal (DELETE /api/pos/{po_number}, /api/invoices/{invoice_number}).
- Reusable ConfirmModal for all delete actions.
- Report export endpoints exist in backend (/api/reports/{kind}?fmt=xlsx|pdf) — frontend
  download buttons intentionally SKIPPED per user request.
- DB direct-edit guide written at /app/PANDUAN_EDIT_DATABASE.md.
- Verified: 28/28 backend pytest + full frontend role/CRUD flows passed (iteration_3).

## Backlog / Remaining
- P0: Wire frontend to backend (auth + data), extend backend for invoices &
  posts/categories, remove local mock arrays.
- P1: Role-based UI (Owner/PM vs Engineer/PCM), approval flow (PM First Approval).
- P2: Real date picker, deeper validation, loading/empty states.

## Notes
- App is APK/IPA-ready via the Publish button (Emergent deploy → generate builds).
- Change Password reached via top-right settings icon (Draft29 had it as a hidden screen).
