# VIABUS portal

This branch turns Busify — a multi-tenant charter SaaS — into the operations
portal for a single operator, VIABUS, and serves the VIABUS marketing site from
the same deployment.

One app, one origin, one deploy. The marketing site and the portal share a
domain, so the public quote form posts to a same-origin endpoint and there is no
CORS to configure.

---

## What changed

| Area | Change |
| --- | --- |
| Marketing site | The VIABUS static site is served verbatim from `public/`. |
| Landing page | Busify's SaaS landing page (`app/page.tsx`) is gone; `/` is the VIABUS home page. |
| Signup | `app/(auth)/signup` and `app/onboarding` removed. Staff accounts are created by an administrator. |
| Tenancy | Schema is untouched and still multi-tenant. The organization is pinned by `VIABUS_ORG_SLUG` instead of read from a URL slug. |
| Intake | New `POST /api/public/quote` — the JSON endpoint the static form posts to. |

### Why the site is not React

The marketing pages are static content whose interactivity is entirely vanilla
GSAP operating on the DOM. Porting ~7,000 lines of HTML to JSX would have risked
the design for no functional gain, so the pages are served exactly as they were
built and reviewed. They can be converted one at a time later if a page ever
needs to read live data.

### Why multi-tenancy stayed

`organization_id` is on all 26 tables and every RLS policy is built on it.
Removing it would be a wide, risky refactor whose only payoff is deleting a
column. With one tenant it costs nothing, and it keeps this a configuration
difference rather than a fork of the data model.

---

## Setup

### 1. Environment

```bash
cp .env.example .env.local
```

Beyond the standard Supabase keys, set:

| Variable | Notes |
| --- | --- |
| `VIABUS_ORG_SLUG` | Slug of the single organization. Default `viabus`. |

`SUPABASE_SERVICE_ROLE_KEY` is **required** here, not optional — the public
intake endpoint runs through the service-role client.

### 2. Migration

```bash
npm run db:push
```

Adds `public.next_trip_request_reference`, a service-role-only wrapper that
allocates the `VB-00001` references shown on the form's success screen.

### 3. Provision the organization

Edit the admin email at the top of `supabase/provision-viabus.sql`, create that
user in Supabase (Authentication → Users → Add user), then run:

```bash
psql "$DATABASE_URL" -f supabase/provision-viabus.sql
```

Idempotent and safe to re-run. Without it the quote endpoint throws, because
there is no organization for a request to belong to.

### 4. Regenerate database types

```bash
npm run db:types
```

Drops the one `as unknown as` cast in `app/api/public/quote/route.ts`, which is
there only because the generated types predate the migration.

---

## The quote flow

```
public/quote.html
  → POST /api/public/quote          (JSON, same origin)
      → viabusQuoteSchema           (Zod; honeypot, field rules)
      → requireViabusOrganization() (slug from env, never from the browser)
      → next_trip_request_reference (VB-00001)
      → insert trip_requests        (service role, source HOSTED_PAGE)
  ← { ok: true, reference }
      → success panel shows the real reference
```

### Field mapping

The site's form predates the schema, so three fields have nowhere to land and
are folded into `trip_requests.notes` rather than dropped: **trip type**,
**service type** and **company name**.

The form also collects a departure **date** with no time. The endpoint assumes
09:00 (and 17:00 for a return) in the operator's timezone and records that
assumption in the notes for the operator to confirm.

---

## Known gaps

- **The homepage search bar has no backend.** Busify models charter work —
  request → quote → trip. There is no routes table, no schedules and no seat
  inventory, so the "From / To / Passengers" search on the home page and the
  route cards on `/routes` are presentation only. Backing them is new schema,
  not configuration.
- **The corporate page form is not wired.** `corporate.html` still has
  `onsubmit="return false"`. Pointing it at the same endpoint is small, but it
  collects a different set of fields and was left alone rather than guessed at.
- **Rate limiting is in-process.** The throttle in the intake route resets on
  deploy and does not span instances. Real protection needs a shared store or a
  WAF rule.
