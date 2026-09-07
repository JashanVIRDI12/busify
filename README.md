# Busify

Charter and motorcoach operations, from the first enquiry to the driver's pay
stub. Multi-tenant, with tenant isolation enforced by PostgreSQL row level
security rather than by application filters.

---

## Stack

| Layer      | Choice                                                    |
| ---------- | --------------------------------------------------------- |
| Framework  | Next.js 16 (App Router, Server Components, Server Actions) |
| Language   | TypeScript, strict, `noUncheckedIndexedAccess`             |
| UI         | Tailwind CSS v4, shadcn-style primitives, Lucide icons     |
| Backend    | Supabase — Postgres, Auth, Storage, RLS                    |
| Validation | Zod v4 on every write path                                 |

---

## The screens

The top bar is six entries wide. Everything an operator touches hourly is one
click; everything they touch daily is two.

| Area             | Route                                       | What it does                                                    |
| ---------------- | ------------------------------------------- | --------------------------------------------------------------- |
| **Quotes**       | `/quotes`, `/quotes/[id]`                   | Pipeline list, and the four-tab builder that prices a job        |
| **Reservations** | `/reservations`, `/reservations/[id]`       | Confirmed work: money owed, assignment state, invoice state      |
| **Dispatch**     | `/board`, `/dispatch`, `/assignments`       | Today's runs beside the grid; month calendar; utilisation timeline |
| **Contacts**     | `/contacts`, `/companies`                   | The people who book, and the accounts they book for             |
| **Operations**   | `/vehicles`, `/drivers`, `/driver-pay`, `/tickets`, `/garages`, `/trip-requests`, `/bookings` | Fleet, roster, payroll, issues, depots, inbound demand |
| **Reports**      | `/reports`, `/payments`                     | Where the business stands, and what is still owed                |

Public, no account needed: `/book/[slug]` (booking enquiry form) and
`/quote/[token]` (the customer's copy of a quote).

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

| Variable                        | Where it lives  | Notes                                          |
| ------------------------------- | --------------- | ---------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | client + server | Project URL                                    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Anon key — always subject to RLS               |
| `SUPABASE_SERVICE_ROLE_KEY`     | **server only** | Bypasses RLS. Never prefix with `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_SITE_URL`          | client + server | Builds auth email redirect URLs                |
| `OPENROUTER_API_KEY`            | **server only** | Optional. Enables the assistant                |

`lib/env.ts` imports `server-only`, so importing it from a Client Component is
a build error. That is the structural guarantee that the service-role and
OpenRouter keys never reach the browser bundle.

### 4. Apply the schema

Local:

```bash
npx supabase db reset      # every migration, then the seed files
```

Hosted:

```bash
npx supabase link --project-ref <your-ref>
npx supabase db push       # migrations only; the seeds are local-only
```

### 5. Regenerate the database types

`types/database.ts` is hand-written in the generator's shape. After changing a
migration, either edit it to match or regenerate against a local database:

```bash
npm run db:types
```

### 6. Run

```bash
npm run dev
```

`/` routes by session: signed-in staff land on Quotes, everyone else on the
sign-in page.

With local Supabase, the seed creates two organizations (password `busify123`
for all three accounts):

| Email                          | Organization           | Role       |
| ------------------------------ | ---------------------- | ---------- |
| `owner@mapleleafcoach.test`    | Maple Leaf Coach Lines | OWNER      |
| `dispatch@mapleleafcoach.test` | Maple Leaf Coach Lines | DISPATCHER |
| `owner@rivierenord.test`       | Autocars Rivière-Nord  | OWNER      |

Confirmation emails on local Supabase are caught by Inbucket at
<http://localhost:54324>.

---

## Scripts

| Command             | Does                                                  |
| ------------------- | ----------------------------------------------------- |
| `npm run dev`       | Dev server                                            |
| `npm run build`     | Production build                                      |
| `npm run typecheck` | `tsc --noEmit`                                        |
| `npm run lint`      | ESLint                                                |
| `npm run test`      | Datetime, pricing and tax unit checks                 |
| `npm run db:reset`  | Reset the local database and re-seed                  |
| `npm run db:push`   | Push migrations to the linked project                 |
| `npm run db:types`  | Regenerate `types/database.ts` from the local schema   |

---

## Verifying tenant isolation

This is the property worth testing before anything else.

1. `npm run db:reset` to load both seeded organizations.
2. Sign in as `owner@mapleleafcoach.test` — you see the Ontario fleet.
3. Sign out, sign in as `owner@rivierenord.test` — you see one coach, one
   driver, one contact.
4. In the Supabase SQL editor, confirm the database refuses cross-tenant reads
   rather than the application filtering them out:

```sql
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select count(*) from public.vehicles;  -- the Ontario fleet only
```

Turning off the role and claims settings restores superuser access, which is
why seeding works but the application never can.

---

## Architecture notes

### Tenancy

Every tenant table carries `organization_id`. Rows that reference another
tenant row use a **composite foreign key** `(organization_id, id)` rather than
a plain `id`, so pointing a vehicle at another company's vehicle type is
structurally impossible even before RLS is considered.

### RLS

`supabase/migrations/*_rls.sql` and the console migration open each table
through four policies — select for members, insert/update for writers, delete
for managers — generated in a loop so no table can drift out of the matrix.
Policies call `SECURITY DEFINER` helpers in the private `app` schema (not
exposed to PostgREST) so the policy on `organization_members` does not recurse
into itself.

`lib/permissions/index.ts` mirrors the same matrix in TypeScript. That copy
exists to hide buttons a user cannot use; it is never the authorization
boundary. Every Server Action re-checks the role, and the database rejects the
write regardless.

### List state lives in the URL

Search, filters, sort, page and page size are query parameters, parsed on the
server by `lib/list-params.ts` and written on the client by
`lib/hooks/use-list-params.ts`. That makes a filtered view shareable and
back-button-safe, and lets the server render the right page on first paint. A
saved view is just a stored query string.

### One number line

Quotes and reservations share a per-organization record counter, so quote
11423 becomes reservation 11423 and its second vehicle becomes 11423-2. An
operator, a driver and a customer all say the same number about the same job
for its whole life.

### Derived columns are maintained, not computed per row

Three values are denormalised deliberately, each because the alternative made
the most-used screen the slowest:

- `trips.assignment_status` — maintained by a trigger on `trip_assignments`.
  "What is not covered yet" cannot be expressed as a filter on an embedded
  resource at all.
- `trips.balance_due` — a generated column, so a list can never drift out of
  step with the payments that produced it.
- `quotes.pickup_at` / `pickup_address` — written by the builder's save, which
  already recomputes everything server-side. Sorting the quotes list on pickup
  otherwise means reaching two tables deep through an embed.

### Time

Every date boundary is midnight *in the operator's timezone*, never UTC and
never the server's. The dispatch timelines position bars in elapsed hours on
real instants rather than wall-clock hours, so a board spanning a DST change
does not shift every bar after the transition.

### Money

Stored as `numeric(12,2)` in major units. Quote totals are computed by
application code and persisted — never derived in the browser, and never
calculated by a model.

---

## Project layout

```
app/
  (auth)/          login, forgot/reset password, verify email
  (dashboard)/     the console: quotes, reservations, dispatch, contacts,
                   operations, reports
  auth/            PKCE callback and token_hash confirm route handlers
  book/[slug]/     public booking enquiry form
  quote/[token]/   the customer's copy of a quote
components/
  ui/              shadcn-style primitives
  data/            table, filters, pagination, selection, saved views, fields
  shell/           top nav, brand mark, side drawer
  dispatch/        timeline, calendar, board controls
  quotes/builder/  the four-tab quote builder
lib/
  supabase/        browser, server, admin (service role), proxy refresh
  auth/            session resolution and Server Action guards
  permissions/     role matrix mirroring RLS
  validations/     Zod schemas
  queries/         server-side data access
  list-params.ts   URL <-> list state
  calendar.ts      timezone-correct calendar geometry
supabase/
  migrations/      schema, RLS, storage — the source of truth
  seed.sql         local tenancy fixture, two organizations
  seed-console.sql local demo data for the operations screens
types/database.ts  schema types
proxy.ts           session refresh + route gating (Next 16 middleware)
```
