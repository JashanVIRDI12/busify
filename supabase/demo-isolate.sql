-- ===========================================================================
-- Keep the demo login inside the demo tenant only.
--
-- getSession() resolves the caller's *first* membership by created_at, so an
-- account that belongs to two organizations silently lands in the older one.
-- The demo account was joined to the live organization before the demo tenant
-- existed; this drops that membership so signing in as the demo account can
-- only ever show demo data.
-- ===========================================================================

delete from public.organization_members m
 using auth.users u, public.organizations o
 where m.user_id = u.id
   and m.organization_id = o.id
   and u.email = 'demo@viabus.ca'
   and o.name <> 'Via Bus Demo';
