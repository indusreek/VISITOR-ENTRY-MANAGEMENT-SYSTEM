# Visitor Management System (College Campus)

Refined web application for college visitor entry management, built strictly in conformance with `SRS.md` and prepared for migration to Supabase PostgreSQL.

---

## 1. Supabase Setup & Migration

### Step 1: Get your Supabase Credentials
1. Log in to [Supabase](https://supabase.com/) and navigate to your project.
2. Go to **Project Settings → API**.
3. Copy the **Project URL** and the **anon public** (or **service_role**) key.

### Step 2: Configure Environment Variables
Create or edit `.env` in the project root:

```env
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_ANON_KEY=<your-anon-or-service-role-key>
```

### Step 3: Run Database Schema
Execute the SQL script in `supabase/schema.sql` directly inside your **Supabase SQL Editor**. It creates:
- `users`: Staff account management table with bcrypt-hashed credentials.
- `visitors`: Complete visitor records with check constraints, foreign keys, and indexes.
- `uq_visitors_active_phone`: Unique partial index preventing duplicate active check-ins with the same phone.
- Row Level Security (RLS) policies for authenticated and service-role operations.

### Step 4: Run Data Migration
Run the automated migration and seed engine:
```bash
npm run migrate
```
This migrates the staff account (`admin` / `Admin@123`) and seed visitor records into your Supabase PostgreSQL instance without data loss.

---

## 2. Authentication & Default Credentials

- **Username**: `admin`
- **Password**: `Admin@123`
- Session tokens are managed securely with Bearer authentication and 8-hour TTL.

---

## 3. Running & Testing

- **Start Dev Server**: `npm run dev` (running on port 3000)
- **Run Lint Checks**: `npm run lint`
- **Run Test Suite**: `npm test`
