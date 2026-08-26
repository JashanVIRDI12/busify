# Busify AI

AI-ready charter transportation SaaS for bus and motorcoach operators.
Multi-tenant, with tenant isolation enforced by PostgreSQL row level security.

**Phase 1 (this milestone):** authentication, organizations and members,
database schema with RLS, dashboard shell, and CRUD for fleet, drivers and
customers. AI, payments, dispatch, GPS, the driver app and the website widget
are deliberately not built yet — but the schema and API shape are laid out so
they slot in without migration churn.

---

## Stack

| Layer     | Choice                                                     |
| --------- | ---------------------------------------------------------- |
| Framework | Next.js 16 (App Router, Server Components, Server Actions)  |
| Language  | TypeScript, strict, `noUncheckedIndexedAccess`             |
| UI        | Tailwind CSS v4, shadcn-style components, Lucide icons      |
| Backend   | Supabase — Postgres, Auth, Storage, RLS                     |
| Validation| Zod v4 on every write path                                  |

---

## Getting started

### 1. Install

```bash
npm install
```

### 2. Create a Supabase project

Either a hosted project at [supabase.com](https://supabase.com), or locally
with the [Supabase CLI](https://supabase.com/docs/guides/cli) (needs Docker):

```bash
npx supabase start
```

### 3. Configure the environment

```bash
cp .env.example .env.local
```

| Variable                        | Where it lives | Notes                                       |
| ------------------------------- | -------------- | ------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | client + server| Project URL                                 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server| Anon key — always subject to RLS            |
| `SUPABASE_SERVICE_ROLE_KEY`     | **server only**| Bypasses RLS. Never prefix with `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_SITE_URL`          | client + server| Used to build auth email redirect URLs      |
| `OPENROUTER_API_KEY`            | **server only**| Unused until Phase 2                        |

`lib/env.ts` imports `server-only`, so importing it from a Client Component is
a build error. That is the structural guarantee that the service-role and
OpenRouter keys never reach the browser bundle.

### 4. Apply the schema

Local:

```bash
npx supabase db reset      # runs every migration, then supabase/seed.sql
```

Hosted:

```bash
npx supabase link --project-ref <your-ref>
npx supabase db push       # migrations only; seed.sql is local-only
```

### 5. Run

```bash
npm run dev
```

Open <http://localhost:3000>, create an account, and you land on onboarding to
create your organization.

With local Supabase you can instead use the seeded accounts (password
`busify123` for all three):

| Email                       | Organization | Role       |
| --------------------------- | ------------ | ---------- |
| `owner@abccharters.test`    | ABC Charters | OWNER      |
| `dispatch@abccharters.test` | ABC Charters | DISPATCHER |
| `owner@xyzcoaches.test`     | XYZ Coaches  | OWNER      |

Confirmation emails on local Supabase are caught by Inbucket at
<http://localhost:54324>.

---

## Scripts

| Command            | Does                                                |
| ------------------ | --------------------------------------------------- |
| `npm run dev`      | Dev server                                          |
| `npm run build`    | Production build                                    |
| `npm run start`    | Serve the production build                          |
| `npm run typecheck`| `tsc --noEmit`                                      |
| `npm run lint`     | ESLint                                              |
| `npm run db:reset` | Reset the local database and re-seed                |
| `npm run db:push`  | Push migrations to the linked project               |
| `npm run db:types` | Regenerate `types/database.ts` from the local schema |

---

## Verifying tenant isolation

This is the property worth testing before anything else.

1. `npm run db:reset` to load both seeded organizations.
2. Sign in as `owner@abccharters.test` — you see 7 vehicles, 5 drivers, 4 customers.
3. Sign out, sign in as `owner@xyzcoaches.test` — you see 1 vehicle, 1 driver, 1 customer.
4. In the Supabase SQL editor, confirm the database refuses cross-tenant reads
   rather than the application filtering them out:

```sql
-- Impersonate the ABC Charters owner.
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select count(*) from public.vehicles;  -- 7, never 8
```

Turning off the role/claims settings restores superuser access, which is why
seeding works but the app never can.

---

## Architecture notes

### Tenancy

Every tenant table carries `organization_id`. Rows that reference another
tenant row use a **composite foreign key** `(organization_id, id)` rather than
a plain `id`, so pointing a vehicle at another company's vehicle type is
structurally impossible even before RLS is considered.

### RLS

`supabase/migrations/*_rls.sql` opens each table through four policies —
select for members, insert/update for writers, delete for managers — generated
in a loop so no table can drift out of the matrix. Policies call
`SECURITY DEFINER` helpers in the private `app` schema (not exposed to
PostgREST) so the policy on `organization_members` does not recurse into
itself.

`lib/permissions/index.ts` mirrors the same matrix in TypeScript. That copy
exists to hide buttons a user cannot use; it is never the authorization
boundary. Every Server Action re-checks the role, and the database rejects the
write regardless.

### Organization creation

`public.organizations` has **no INSERT policy**. The only way to create one is
`public.create_organization()`, which inserts the organization and the caller's
`OWNER` membership in a single transaction. Without that, a user could insert a
membership row attaching themselves to an organization they do not own.

### Money

Stored as `numeric(12,2)` in major units. Quote totals are computed by
application code and persisted — never derived in the browser, and never
calculated by a model.

---

## Project layout

```
app/
  (auth)/          login, signup, forgot/reset password, verify email
  (dashboard)/     overview, customers, vehicles, drivers, settings
  auth/            PKCE callback and token_hash confirm route handlers
  onboarding/      organization creation
components/
  ui/              shadcn-style primitives
  shared/          page header, empty state, search, filters, delete dialog
  auth/ dashboard/ customers/ vehicles/ drivers/ settings/ onboarding/
lib/
  supabase/        browser, server, admin (service role), proxy refresh
  auth/            session resolution and Server Action guards
  permissions/     role matrix mirroring RLS
  validations/     Zod schemas
  queries/         server-side data access
supabase/
  migrations/      schema, RLS, storage — the source of truth
  seed.sql         local demo data, two organizations
types/database.ts  schema types
proxy.ts           session refresh + route gating (Next 16 middleware)
```

---

## Next milestone

Trip requests end to end: the `/trip-requests` list, the request detail page
with fleet availability, and the accept/decline flow that produces a quote.
The tables already exist; only the interface and server actions are missing.
