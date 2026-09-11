# Requirements

This file is the implementation checklist. It matches **SRS.md**. Do not implement features that are not listed here.

## Stack

- Frontend: HTML, CSS, JavaScript
- Backend: FastAPI
- Database: SQLite
- Frontend talks to backend over JSON APIs

## Must implement

1. **Login** — username and password; error on failure; redirect if not logged in.
2. **Authentication** — hashed passwords; JWT (or equivalent) on API calls; logout.
3. **Visitor CRUD**
   - Create = register and check in
   - Read = list and view
   - Update = edit details
   - Delete = with confirmation
4. **Check-out** — for visitors who are currently inside.
5. **Search** — name, phone, host, purpose, organization; optional status filter.
6. **Dashboard** — totals, today, currently inside, checked out today, recent visits.
7. **Reports** — from-date and to-date; summary + table; print.
8. **Validation** — client and API (required fields, phone, email, ID proof, duplicate open visit).
9. **API connectivity** — no local-only visitor storage as source of truth.
10. **UI** — one modern, professional, responsive app; remove duplicate pages.

## Visitor fields

Required: full name, phone, purpose, host, ID proof type, ID proof number.  
Optional: email, organization, notes.

## Default login (created on first run)

- Username: `admin`
- Password: `Admin@123`

## Explicitly out of scope

Photo capture, QR codes, email/SMS, visitor self-service portal, role management UI, analytics beyond the dashboard and report, cloud deployment, and any other feature not in SRS.md.
