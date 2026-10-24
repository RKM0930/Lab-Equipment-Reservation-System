# ReserveLab

**ReserveLab** is a functional full-stack prototype for **Task 3: Software Implementation**
of **Laboratory 6** (BCS45 / S-CSSE421LA Software Engineering 2).

The application lets students and faculty reserve laboratory equipment, lets custodians
register inventory and process returns, and keeps available stock synchronized through every
reservation, cancellation, and return. It is built with **React + TypeScript + Vite**,
**Tailwind CSS**, **Clerk** (`@clerk/clerk-react`), and **Supabase**.

> **Runs immediately with no credentials.** If Clerk or Supabase environment variables are
> missing or still contain placeholders, the app automatically switches to demo authentication
> and a localStorage-backed seeded database. Add real keys at any time to use the hosted
> services.

---

## Feature coverage

| Requirement | Implementation |
| --- | --- |
| **FR-01 Authentication & roles** | Clerk modal sign-in when configured; built-in borrower-only demo sign-in otherwise. Role is read from Clerk `publicMetadata.role` (`custodian`, `faculty`, or `student`). Booking requires authentication. |
| **FR-02 Catalog & live search** | Supabase equipment query with item code, name, category, availability count/progress bar, and an **Out of stock** label. Instant keyword search plus category filter. |
| **FR-03 Validated reservation creation** | Reservation modal validates quantity, date, and time slot, re-checks stock, deducts inventory, and creates an `ACTIVE` reservation with a receipt code. |
| **FR-04 Reservation cancellation** | Borrowers can cancel their own `ACTIVE` reservations; custodians can cancel any. Status becomes `CANCELLED` and stock is restored. |
| **FR-05 Custodian return processing** | Custodians mark an `ACTIVE` reservation `RETURNED`, store a required condition note, and restore available stock exactly once. |
| **FR-06 Inventory management** | Custodian-only equipment registration form for item code, name, category, and total quantity. New stock starts fully available. |
| **FR-07 Reservation log** | Responsive table/card log with `ALL`, `ACTIVE`, `RETURNED`, and `CANCELLED` filters, borrower/schedule/status details, condition notes, and role-aware actions. |

Additional implementation details:

- KPI cards for **Registered equipment**, **Available units**, and **Active reservations**.
- Header role badge reflects the authenticated Clerk role. There is no client-side role switcher.
- Responsive Slate/Emerald/Zinc academic dashboard with accessible dialogs, focus trapping,
  status announcements, and reduced-motion support.
- Demo database reset control in the footer (local mode only).

---

## Quick start

Requirements: **Node.js 20.19+** (or 22.12+) and npm.

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. No `.env` file is required for the demo:

1. Click **Demo sign in** and continue with the prefilled borrower identity.
2. Reserve an item from the catalog.
3. Use the status tabs in the Reservation log to audit activity.

Custodian registration and return tools require a real Clerk account with the custodian role.
The demo fallback is intentionally borrower-only and cannot elevate itself.

Production build:

```bash
npm run build
npm run preview
```

Other scripts: `npm run typecheck`.

---

## Configuration

Copy the template and fill in the values you want to use:

```bash
cp .env.example .env
```

| Variable | Purpose |
| --- | --- |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk Publishable Key. Enables real Clerk authentication when valid. |
| `VITE_CLERK_AFTER_SIGN_OUT_URL` | Optional post-sign-out route. Defaults to `/`. |
| `VITE_SUPABASE_URL` | Supabase project URL. |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public API key. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Alternative to `VITE_SUPABASE_ANON_KEY` for newer Supabase publishable keys. |

Restart the Vite server after changing environment variables.

### Clerk setup

1. Create an application at <https://dashboard.clerk.com>.
2. Copy **Publishable key** into `VITE_CLERK_PUBLISHABLE_KEY`.
3. Enable the sign-in methods you want (email, Google, etc.) in Clerk.
4. Set a user's **public metadata** to assign their role:

   ```json
   { "role": "custodian" }
   ```

   Accepted values are `custodian`, `faculty`, or `student` (default). The UI reads this value
   from Clerk and shows a **Custodian** badge only for `custodian`; every other role gets the
   **Student / Faculty Borrower** badge. There is no manual role switcher.

The app uses `<SignedIn>`, `<SignedOut>`, `<SignInButton>`, and `<UserButton>` from
`@clerk/clerk-react`. If the key is absent, invalid, or a placeholder, the app falls back to a
local demo identity dialog instead of crashing.

### Supabase setup

1. Create a project at <https://supabase.com>.
2. Open **SQL Editor** and run the entire contents of [`supabase/schema.sql`](supabase/schema.sql).
3. Copy the project URL and anon key into `.env`.
4. Restart the app. The source line near the dashboard heading changes to **Supabase connected**.

The schema creates `public.equipment` and `public.reservations`, applies CHECK constraints,
date and lifecycle triggers, indexes, and the five required seed items:

| Item code | Name | Category | Total | Available |
| --- | --- | --- | ---: | ---: |
| `EQ-101` | Digital Oscilloscope | Electronics | 5 | 4 |
| `EQ-102` | Arduino Uno R4 Kit | Embedded | 10 | 10 |
| `EQ-103` | Optical Microscope | Optics | 3 | 3 |
| `EQ-104` | Logic Analyzer 16-Ch | Electronics | 3 | 3 |
| `EQ-105` | Raspberry Pi 5 Kit | Computing | 5 | 5 |

> **Prototype security note:** RLS is intentionally not enabled in `schema.sql` because Clerk
> identities are not Supabase `auth.uid()` users and the prototype uses the anon key directly.
> Before production, enable RLS, move stock mutations into transactional `SECURITY DEFINER`
> RPCs or an edge function, and enforce custodian roles from trusted server-side metadata.

---

## Validation rules

Validation lives in [`src/services/reservationService.ts`](src/services/reservationService.ts)
and is backed by database constraints/triggers in [`supabase/schema.sql`](supabase/schema.sql).

| Rule | Behavior / message |
| --- | --- |
| Item code | Must match `^[A-Z]{2,4}-\d{3,4}$` (e.g., `EQ-101`, `LAB-201`). |
| Quantity | Whole integer greater than zero. |
| Stock | `requested_quantity <= available_qty`, otherwise: `Insufficient stock for [item]. Requested: X, Available: Y.` |
| Date | `YYYY-MM-DD` and not in the past. |
| Time slot | Must match `^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$`; start must precede end: `Start time must be strictly earlier than end time.` |
| Lifecycle | Returns/cancellations only from `ACTIVE`; duplicate terminal transitions and double stock additions are blocked. |
| Inventory invariant | Database enforces `0 <= available_qty <= total_qty`; stock adjustments are clamped and use optimistic concurrency guards. |
| Authorization | Only custodians can register equipment or process returns; borrowers can cancel only their own reservations. |

Errors surface in a red alert banner and inside the relevant dialog without clearing the form.
Successful operations show a green receipt banner, for example:

> Reservation RES-1001 confirmed for Digital Oscilloscope (x2). Stock updated.

---

## Demo fallback behavior

- **Supabase fallback:** if `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are missing, malformed,
  or placeholders, the app logs a configuration warning and uses a defensive localStorage database
  (`lers.demo-database.v1`) with an in-memory safety net. It is seeded with the same five items as
  `schema.sql`.
- **Auth fallback:** if the Clerk key is missing or a placeholder, a demo identity dialog captures
  full name, email, and student/faculty role. Demo mode is borrower-only; custodian tools require
  a Clerk account with `publicMetadata.role = "custodian"`.
- **Reset:** in local mode, use **Reset demo data** in the footer to restore seed inventory and
  remove demo reservations. Clearing site storage also works.
- **Source indicator:** the dashboard shows **Demo data** or **Supabase connected** so presenters
  can tell which data source is active.

---

## Project structure

```text
├── supabase/
│   └── schema.sql                  # PostgreSQL schema, constraints, triggers, seed data
├── src/
│   ├── types/
│   │   └── lab.ts                  # Equipment, Reservation, DTO, auth, and role types
│   ├── lib/
│   │   ├── supabaseClient.ts       # Supabase initialization + localStorage fallback store
│   │   ├── auth.tsx                # Clerk provider bridge and demo auth fallback
│   │   └── format.ts               # Date, initials, and label formatting helpers
│   ├── services/
│   │   └── reservationService.ts   # ValidationError, validation rules, Supabase/demo CRUD
│   ├── components/
│   │   ├── Navbar.tsx              # Brand, Clerk controls, verified role badge
│   │   ├── KpiMetrics.tsx          # Live KPI summary cards
│   │   ├── EquipmentCatalog.tsx    # Search, category filter, stock cards
│   │   ├── ReservationModal.tsx    # Validated reservation form
│   │   ├── CustodianModals.tsx     # Registration and return/condition-note dialogs
│   │   ├── ReservationLog.tsx      # Status filters, audit table, cancel confirmation
│   │   └── ui/Modal.tsx            # Accessible portal modal with focus management
│   ├── App.tsx                     # Dashboard state, alerts, role guards, modal flows
│   ├── main.tsx                    # Root + ClerkProvider or DemoAuthProvider
│   └── index.css                   # Tailwind theme, components, animations
├── .env.example
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Data model

`public.equipment`

- `id` UUID primary key
- `item_code` unique, pattern-checked
- `name`, `category`, `total_qty`, `available_qty`
- `created_at`
- CHECK: `total_qty > 0`, `0 <= available_qty <= total_qty`

`public.reservations`

- `id` UUID primary key, `reservation_code` unique
- `clerk_user_id`, `borrower_name`, `borrower_email`
- `equipment_id` FK with `ON DELETE RESTRICT`, plus snapshotted `item_code` / `item_name`
- `quantity`, `reservation_date`, `time_slot`
- `status` (`ACTIVE`, `RETURNED`, `CANCELLED`), `return_note`, `created_at`
- CHECK constraints for quantity, time-slot pattern/order, email, and status
- Trigger blocks past dates and invalid lifecycle transitions

---

## Manual acceptance checklist

- [x] Signed-out reserve action prompts authentication and blocks booking.
- [x] Demo sign-in captures name/email and shows the borrower role badge in the header.
- [x] Borrower accounts cannot see registration or return controls.
- [x] No manual role switcher exists in the header.
- [x] Catalog loads five seed items with exact availability.
- [x] Search (`raspberry`) and category (`Optics`) filters narrow the catalog instantly.
- [x] Valid reservation deducts stock, creates `ACTIVE`, and shows the receipt banner.
- [x] Over-quantity request shows the exact insufficient-stock message and preserves the form.
- [x] Past date and inverted time slot are rejected with contextual messages.
- [x] Borrower can cancel an own `ACTIVE` reservation; stock is restored.
- [x] Custodian can register equipment; item appears in the catalog and KPI counts.
- [x] Duplicate item code is rejected.
- [x] Custodian can process a return with a condition note; stock is restored once.
- [x] Returned/cancelled actions disappear; status filters show the correct rows.
- [x] Mobile layout has no page-level horizontal overflow; dialogs remain usable.
- [x] Production build completes and browser console shows no runtime errors.

---

## Notes and limitations

This is a course prototype, not a production deployment. The main hardening items are:

1. Enable Supabase RLS and move multi-step stock operations into transactional database functions.
2. Enforce the custodian role from trusted Clerk metadata in server-side policies as well as the
   UI. The current role checks are client-side because this prototype talks directly to Supabase.
3. Add an audit trail for who processed each return in addition to the borrower identity.
4. Add automated integration tests against a disposable Supabase project.

**Course:** BCS45 / S-CSSE421LA Software Engineering 2 · **Laboratory 6** · Task 3 Software
Implementation  
**Instructor:** Mr. Gerald Salacsacan
