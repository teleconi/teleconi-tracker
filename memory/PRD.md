# Teleconi Tracker — PRD

## Original Problem Statement
Build a mobile app exactly matching the HTML mockup `Telecony_Ops_Tracker_Draft21.html`
(Teleconi Ops Tracker). User language: Indonesian. Approach: perfect the mockup first,
then build the full app (wire backend).

## Architecture
- Frontend: Expo Router (React Native), single mockup screen at `/app/frontend/app/index.tsx`.
- Root layout wraps `SafeAreaProvider` + `KeyboardProvider` (react-native-keyboard-controller).
- Backend: FastAPI + MongoDB + JWT (built in `/app/backend/server.py`) — NOT yet wired to UI.

## User Personas
- Owner (full access), Project Manager, Engineer, Project Controller (PCM).

## Core Requirements (static)
- Login with Employee ID + password, demo accounts listed.
- 4 bottom tabs: Dashboard, PO Project, Operational, Gaji.
- Dashboard: project filter, profitability hero, 4 KPI stats, budget utilization,
  project financial summary table, monthly cost trend, cost by project/user/category.
- PO Project: PO list cards, PO summary, Add PO.
- Operational Tracker: cost submission form (conditional Keterangan), transaction history.
- User Management: profile, editable email/address, employee list, change password.
- Salary Payment: table with Belum/Terbayar status toggle.

## Implemented (2026-08-16)
- Full visual mockup replicating every screen from the HTML (Login, Dashboard, PO,
  Operational, User Management, Change Password, Salary).
- Native equivalents: tap-to-open Select pickers, bottom-sheet Add PO modal with
  keyboard-aware scrolling (fixes prior modal blocker), Toast instead of Alert.
- FastAPI backend written (auth/dashboard/pos/costs/employees/salary) + seeded data,
  awaiting wiring after mockup sign-off.

## Backlog / Remaining
- P0: Wire frontend to backend API (auth + all data), remove local mock arrays.
- P1: Role-based UI (hide Add PO / salary toggle for non-Owner/PM).
- P2: Real date picker, form validation, loading/empty states.

## Adaptation notes
- HTML nav has 4 tabs; User Management + Change Password reached via a top app-bar
  profile icon (mockup relied on hidden JS). Flagged to user.
