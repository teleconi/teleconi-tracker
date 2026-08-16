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
- Full visual mockup replicating Draft29 exactly (all screens).
- Users seeded from user-id.xlsx; default password `123`.
- WIRED TO BACKEND (real): login (JWT, persisted token), GET /auth/me,
  GET /employees, PATCH /employees/{id} (Save Profile), POST /employees (Add Employee).
- Owner-only enforcement on server (require_owner → 403 for non-Owner) and in UI
  (read-only fields, hidden Save/Add for non-Owner). Verified via curl + Playwright.
- Salary status toggle wired to POST /salaries/toggle (Owner only).

## Backlog / Remaining
- P0: Wire frontend to backend (auth + data), extend backend for invoices &
  posts/categories, remove local mock arrays.
- P1: Role-based UI (Owner/PM vs Engineer/PCM), approval flow (PM First Approval).
- P2: Real date picker, deeper validation, loading/empty states.

## Notes
- App is APK/IPA-ready via the Publish button (Emergent deploy → generate builds).
- Change Password reached via top-right settings icon (Draft29 had it as a hidden screen).
