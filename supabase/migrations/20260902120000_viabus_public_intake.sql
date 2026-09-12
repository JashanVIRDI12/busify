-- ---------------------------------------------------------------------------
-- VIABUS public intake
--
-- The marketing site posts quote requests as an anonymous visitor. That path
-- runs through the service-role client (see app/api/public/quote/route.ts),
-- because `trip_requests` deliberately has no anon INSERT policy and opening
-- one would be a wider hole than the feature needs.
--
-- The success screen quotes a reference back to the customer, so intake needs
-- the same gap-free per-organization numbering the dashboard uses. That lives
-- in `app.next_document_number`, and the `app` schema is not exposed to
-- PostgREST — by design. This is a thin wrapper in `public` so the service-role
-- client can reach exactly that one function and nothing else in `app`.
-- ---------------------------------------------------------------------------

create or replace function public.next_trip_request_reference(org uuid)
returns text
language sql
security definer
set search_path = ''
as $$
  select app.next_document_number(org, 'TRIP_REQUEST', 'VB');
$$;

comment on function public.next_trip_request_reference(uuid) is
  'Allocates the next VB-00000 trip request reference. Service role only: the '
  'public site calls it through the server, never the browser.';

-- Not granted to `anon` or `authenticated`. A visitor who could call this
-- directly could burn reference numbers at will.
revoke all on function public.next_trip_request_reference(uuid) from public;
grant execute on function public.next_trip_request_reference(uuid) to service_role;
