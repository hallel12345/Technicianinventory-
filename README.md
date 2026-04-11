# Pure Pest Inventory App

Production-ready, mobile-first monthly inventory workflow for Pure Pest Solutions technicians and admins.

## Stack
- Next.js 14+ App Router (project uses Next.js 15, compatible with 14+ requirement)
- TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL (Supabase Postgres)
- NextAuth/Auth.js credentials authentication
- React Hook Form + Zod validation
- Nodemailer (Gmail SMTP)
- Supabase Storage (optional photo uploads)
- Vitest unit tests

## What This App Does
Technician flow (mobile-first):
1. Log in with `4-digit PIN`
2. Select office
3. Select truck by license plate
4. Enter office inventory counts
5. Enter truck inventory counts
6. Review
7. Submit
8. Success confirmation

Admin flow:
- Dashboard completion monitoring by month
- Missing submission tracking
- Open/edit/unlock submissions
- Month lock/unlock
- One-click manual resend of monthly summary email
- CSV exports
- Settings for offices, trucks, inventory items, users, branding, and monthly required overrides

## Core Business Rules Implemented
- Distinct office and truck submission records, created in one technician flow
- Duplicate monthly submissions blocked by unique constraints:
  - one office submission per office/month/year
  - one truck submission per truck/month/year
- Month lock prevents edits/resubmits until unlocked by admin
- Required-this-month overrides for offices and trucks
- Automatic final-month email sends once when all required submissions complete
- Auto-email de-duplication protected by unique `EmailLog.autoKey` per month
- Manual resend available for admins and tracked in `EmailLog` + `AuditLog`

## Project Structure
- `app/` routes, layouts, API routes
- `components/` UI + domain components
- `lib/actions/` server actions
- `lib/services/` business logic (monthly completion, submission, email, audit, storage)
- `lib/schemas/` Zod schemas
- `prisma/` schema, migration, seed
- `public/branding/` logo/favicon assets
- `tests/` unit tests
- `emails/` reserved template folder

## Prerequisites
- Node.js 20+
- npm 10+
- Supabase project with Postgres + Storage bucket

## Environment Variables
Copy `.env.example` to `.env` and fill values.

Required:
- `DATABASE_URL`
- `DIRECT_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`
- `ADMIN_NOTIFICATION_EMAIL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`

Optional:
- `SUPABASE_ANON_KEY`
- `SUPABASE_STORAGE_PUBLIC_BASE_URL`
- `PHOTOS_REQUIRED_DEFAULT`

## Local Development Setup
1. Install dependencies:
```bash
npm install
```

2. Generate Prisma client:
```bash
npm run prisma:generate
```

3. Run migration:
```bash
npm run prisma:migrate
```

4. Seed database:
```bash
npm run prisma:seed
```

5. Start dev server:
```bash
npm run dev
```

6. Open:
- `http://localhost:3000/login`

## Seeded Defaults
### Offices
- Ogden
- Logan
- Cedar City
- Pocatello
- Twin Falls

### Trucks
- Colorado 1 - H594GM
- Colorado 2 - H595GM
- Colorado 3 - H596GM
- Colorado 4 - H597GM
- Colorado 5 - H79 3HH
- Truck 1 (Pocatello) - T134US
- Truck 2 Ogden (Twin Falls) - T016FM
- Ranger 1 (Big Racks) (Twin Falls) - 5CWG2
- Ranger 2 (99er) (Twin Falls) - T538VN

### Inventory Items
All requested inventory items are seeded and editable in Admin Settings.

### Seeded Accounts
- Admin:
  - email: `admin@purepest.local`
  - password: `Admin123!`
- Demo technicians:
  - `Ogden Tech` PIN: `1001`
  - `Logan Tech` PIN: `1002`
  - `Cedar Tech` PIN: `1003`
  - `Idaho Tech` PIN: `1004`
  - `Former Tech (Inactive)` PIN: `1999` (inactive example account)

Change these immediately in production.

## Gmail SMTP Setup (Required for Email Notifications)
1. Log into `purest.ut@gmail.com`.
2. Enable 2-Step Verification.
3. Generate an App Password (Google Account > Security > App passwords).
4. Set:
- `GMAIL_USER=purest.ut@gmail.com`
- `GMAIL_APP_PASSWORD=<app-password>`
- `ADMIN_NOTIFICATION_EMAIL=elibhall05@gmail.com`

## Supabase Storage Setup (Photo Uploads)
1. Create bucket named `inventory-photos` (or set `SUPABASE_STORAGE_BUCKET`).
2. If you want direct public file URLs, make bucket public and set `SUPABASE_STORAGE_PUBLIC_BASE_URL`.
3. If private, keep URL empty and extend app for signed retrieval.

## Vercel Deployment
1. Push repo to GitHub.
2. Import project in Vercel.
3. Configure all environment variables in Vercel project settings.
4. Set Production `NEXTAUTH_URL` to your deployed domain.
5. Deploy.
6. Run Prisma migration against production DB:
```bash
npm run prisma:migrate
npm run prisma:seed
```

## How Monthly Completion + Email Works
- Every submission recomputes monthly completion using required office/truck sets plus overrides.
- When final missing required submission is recorded, app queues one `AUTO_FINAL` email log for that month.
- Unique monthly auto-key prevents duplicate auto emails during concurrent submissions.
- Email is sent once and month is marked `autoEmailSent=true`.
- Manual resend creates `MANUAL_RESEND` log entries.

## Month Lock Behavior
- Admin can lock a month from dashboard.
- Locked month blocks submission edits and unlock/delete operations.
- Unlock month to allow corrections/resubmits.

## Required Override Behavior
- In Admin Settings, select month/year and toggle required status per office/truck.
- Required overrides affect completion percentage and final-email trigger.

## Managing Offices, Trucks, Items, and Users
Use `/admin/settings`:
- Add/edit/archive offices
- Add/edit/archive trucks
- Reassign truck-to-office
- Add/edit/archive inventory items
- Set inventory item scope (`OFFICE`, `TRUCK`, `BOTH`)
- Create/edit/deactivate technician and admin users
- Update branding config (logo path, app title, colors)

## CSV Exports
From Admin Dashboard:
- Export all submissions
- Export office-only
- Export truck-only

Exports include counts, notes, problems, and missing/damaged details.

## Tests
Run:
```bash
npm test
```

Current coverage includes:
- Submission validation
- Duplicate detection helper
- Monthly completion calculation
- Required override application
- Auto-email trigger guard
- Month lock guard logic

## Notes for VS Code + GitHub Workflow
- Open folder in VS Code.
- Use source control panel for commits.
- Push to GitHub and connect repo to Vercel for CI/CD.

## Important Operational Reminder
This repository was generated in an environment without Node installed, so build/test commands were not executed during generation. After installing Node locally, run:
```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm test
npm run build
```
