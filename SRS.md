# Software Requirements Specification

## Visitor Entry Management System

**Version:** 1.0  
**Document status:** Source of truth for implementation

---

## 1. Introduction

### 1.1 Purpose

This document specifies the software requirements for a Visitor Entry Management System used by reception or front-desk staff to record, search, update, and report on visitor visits.

### 1.2 Scope

The system is a web application with:

- a browser-based frontend
- a FastAPI backend
- an SQLite database

In-scope capabilities are authentication, visitor record management (create, read, update, delete), search, check-in and check-out, a dashboard of visit statistics, and date-range reports.

Out of scope: visitor self-registration, photo capture, QR/badges, email or SMS notifications, multi-organization tenancy, biometric devices, and payment features.

### 1.3 Intended users

| Role | Description |
|------|-------------|
| Staff | Authorized reception or admin user who logs in and performs all visitor operations |

There is a single staff role. Only authenticated staff may use the application.

---

## 2. Overall description

### 2.1 Product perspective

The product is a standalone system. The frontend communicates with the backend only through HTTP JSON APIs. Visitor and user data are stored in SQLite.

### 2.2 User characteristics

Staff users are expected to use a desktop or laptop browser. The interface must also remain usable on tablet and mobile screen sizes.

### 2.3 Operating environment

- Backend: Python 3.12+, FastAPI, SQLite
- Frontend: HTML, CSS, and JavaScript (no framework required)
- Browser: current Chrome, Edge, or Firefox

---

## 3. Functional requirements

### FR-1 Authentication and session

1. The system shall provide a login screen requiring username and password.
2. The system shall authenticate credentials against stored staff accounts.
3. Passwords shall be stored as one-way hashes, never in plaintext.
4. On success, the system shall issue a time-limited access token.
5. Subsequent API requests shall require a valid token.
6. The staff user shall be able to log out, which clears the local session.
7. Unauthenticated users shall be redirected to the login screen.
8. Invalid credentials shall produce a clear error without revealing whether the username exists.

### FR-2 Visitor create (check-in)

Staff shall register a visitor with the following fields:

| Field | Required | Rules |
|-------|----------|--------|
| Full name | Yes | 2–100 characters |
| Phone | Yes | Exactly 10 digits |
| Email | No | Valid email format when provided |
| Organization | No | Max 100 characters |
| Purpose of visit | Yes | 2–200 characters |
| Person to meet (host) | Yes | 2–100 characters |
| ID proof type | Yes | One of: Aadhaar, Driving License, PAN, Passport, Other |
| ID proof number | Yes | 3–50 characters |
| Notes | No | Max 500 characters |

On successful create, the visitor is checked in. Check-in date and time are set by the server. Status is `checked_in`.

The system shall reject a new check-in if the same phone number already has an open (`checked_in`) visit.

### FR-3 Visitor read / list

Staff shall view a list of visitor records including name, phone, host, purpose, check-in time, check-out time, and status.

Staff shall open a single visitor record to view all stored fields.

### FR-4 Visitor update

Staff shall update visitor details for an existing record (identity and visit details). Check-in time is not editable. Status is changed only through check-out (FR-6), not by free-form edit.

### FR-5 Visitor delete

Staff shall delete a visitor record. The system shall ask for confirmation before deleting.

### FR-6 Check-out

Staff shall check out a visitor who is currently `checked_in`. The server sets check-out time and status `checked_out`.

The system shall reject check-out if the visitor is already checked out.

### FR-7 Search

Staff shall search the visitor list by name, phone, host, purpose, organization, or status. Search is case-insensitive. Results update from the API based on the search text and optional status filter.

### FR-8 Dashboard

After login, staff shall see a dashboard with:

- total visitor records
- visitors checked in today
- visitors currently inside (`checked_in`)
- visitors checked out today
- a list of the most recent visits (up to 10)

### FR-9 Reports

Staff shall generate a visit report for a date range (inclusive) based on check-in date.

The report shall show matching visitor rows and a summary: total visits, still inside, and checked out in that range.

Staff shall be able to print the on-screen report.

### FR-10 Validation

The frontend and backend shall validate required fields and formats. API validation errors shall be shown to the user. The database shall enforce required columns and valid status values.

### FR-11 API connectivity

All login, visitor, dashboard, and report operations shall be performed through the backend API. The frontend shall not store visitor data only in the browser as the system of record.

---

## 4. External interface requirements

### 4.1 User interface

- Login page and an authenticated application shell.
- Navigation: Dashboard, Visitors, Reports.
- Modern, professional, responsive layout: readable typography, clear actions, consistent spacing.
- Simple workflow: register visitor, search, edit, check out, delete, view report.
- Feedback for success, validation errors, and server errors.

### 4.2 Software interfaces

REST JSON API, including:

| Method | Path | Purpose |
|--------|--------|---------|
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Current user |
| GET | `/api/visitors` | List / search |
| POST | `/api/visitors` | Create / check-in |
| GET | `/api/visitors/{id}` | Get one |
| PUT | `/api/visitors/{id}` | Update |
| DELETE | `/api/visitors/{id}` | Delete |
| POST | `/api/visitors/{id}/checkout` | Check-out |
| GET | `/api/dashboard` | Dashboard stats |
| GET | `/api/reports` | Date-range report |

The API shall use Bearer token authentication except for login.

### 4.3 Default staff account (first run)

On first startup, if no users exist, the system shall create:

- Username: `admin`
- Password: `Admin@123`

---

## 5. Non-functional requirements

### NFR-1 Usability

The interface shall be usable without training for typical reception tasks. Primary actions (add visitor, search, check out) shall be visible without hunting through menus.

### NFR-2 Performance

List, dashboard, and report queries for typical reception volumes (thousands of rows or fewer) shall return in a few seconds on local hardware.

### NFR-3 Security

- HTTPS is not required for local academic use; token auth is required for APIs.
- SQL access shall use parameterized ORM queries.
- CORS may allow the local application origin.

### NFR-4 Reliability

The SQLite file shall persist data across restarts. Invalid requests shall not crash the server.

### NFR-5 Maintainability

Backend modules shall separate models, schemas, auth, and route handlers. Frontend script shall call a single API base URL.

---

## 6. Data requirements

### 6.1 User

`id`, `username` (unique), `password_hash`, `full_name`, `created_at`

### 6.2 Visitor

`id`, `full_name`, `phone`, `email`, `organization`, `purpose`, `host_name`, `id_proof_type`, `id_proof_number`, `notes`, `status` (`checked_in` | `checked_out`), `check_in_time`, `check_out_time`, `created_at`, `updated_at`

---

## 7. Assumptions and constraints

- A single facility / single database.
- Staff share one or more local accounts; user administration UI is not required.
- Date/time is stored in UTC and displayed in the browser’s local timezone.
- Duplicate files that implement the same page shall be removed; one frontend entry point is used.
