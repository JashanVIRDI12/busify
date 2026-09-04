-- ===========================================================================
-- Busify AI — 0007: invitations
--
-- Until now the only way to get a login was to run onboarding, which makes you
-- the OWNER. There was no way to add a second admin or dispatcher, and no way
-- to give a driver an account at all — `drivers.user_id` existed but nothing
-- ever set it.
--
-- An invitation records who a manager asked to join, as what role, and (for
-- drivers) which driver record to attach the new login to. Supabase Auth sends
-- the email; `public.accept_invitation()` turns a pending invitation into a
-- membership when the invitee first signs in.
-- ===========================================================================

create table public.invitations (
  id              uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email           text not null check (position('@' in email) > 1 and email = btrim(email)),
  role            public.org_role not null default 'STAFF',
  -- Set only for driver invitations; the composite FK guarantees the driver
  -- belongs to the inviting organization.
  driver_id       uuid,
  invited_by      uuid references auth.users(id) on delete set null,
  status          text not null default 'PENDING'
                    check (status in ('PENDING', 'ACCEPTED', 'REVOKED')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  accepted_at     timestamptz,
  -- A driver_id only makes sense when the person is being invited as a driver.
  check (driver_id is null or role = 'DRIVER'),
  -- If the driver record is deleted the pending invite is meaningless, so it
  -- goes too. (A composite ON DELETE SET NULL would try to null the NOT NULL
  -- organization_id.)
  foreign key (organization_id, driver_id)
    references public.drivers (organization_id, id) on delete cascade
);

-- One live invitation per address per organization; re-inviting after a revoke
-- or an accept is fine.
create unique index invitations_pending_key
  on public.invitations (organization_id, lower(email))
  where status = 'PENDING';

create index invitations_email_idx
  on public.invitations (lower(email))
  where status = 'PENDING';

create index invitations_org_id_idx on public.invitations (organization_id);

create trigger invitations_set_updated_at
  before update on public.invitations
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: only the organization's managers ever touch this table directly. The
-- invitee reads nothing here — accept_invitation() runs SECURITY DEFINER.
-- ---------------------------------------------------------------------------
alter table public.invitations enable row level security;

create policy "invitations: managers read"
  on public.invitations for select to authenticated
  using (app.can_manage(organization_id, (select auth.uid())));

create policy "invitations: managers insert"
  on public.invitations for insert to authenticated
  with check (app.can_manage(organization_id, (select auth.uid())));

create policy "invitations: managers update"
  on public.invitations for update to authenticated
  using (app.can_manage(organization_id, (select auth.uid())))
  with check (app.can_manage(organization_id, (select auth.uid())));

create policy "invitations: managers delete"
  on public.invitations for delete to authenticated
  using (app.can_manage(organization_id, (select auth.uid())));

grant select, insert, update, delete on public.invitations to authenticated;

-- ---------------------------------------------------------------------------
-- accept_invitation()
--
-- Mirrors public.create_organization(): the invitee cannot insert their own
-- membership row (no self-insert policy on organization_members), so this
-- SECURITY DEFINER function does it — and links the driver record — in one
-- transaction, keyed off the address the invitation was sent to.
-- ---------------------------------------------------------------------------
create or replace function public.accept_invitation()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_inv   public.invitations;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select u.email into v_email from auth.users u where u.id = v_uid;

  if v_email is null then
    raise exception 'This account has no email address' using errcode = '42501';
  end if;

  for v_inv in
    select * from public.invitations
    where lower(email) = lower(v_email)
      and status = 'PENDING'
    order by created_at
    for update
  loop
    insert into public.organization_members (organization_id, user_id, role)
    values (v_inv.organization_id, v_uid, v_inv.role)
    on conflict (organization_id, user_id) do nothing;

    -- Attach the login to the driver record, but never steal one already
    -- linked to somebody else.
    if v_inv.driver_id is not null then
      update public.drivers
        set user_id = v_uid
      where id = v_inv.driver_id
        and organization_id = v_inv.organization_id
        and user_id is null;
    end if;

    update public.invitations
      set status = 'ACCEPTED', accepted_at = now()
    where id = v_inv.id;
  end loop;
end;
$$;

revoke all on function public.accept_invitation() from public, anon;
grant execute on function public.accept_invitation() to authenticated;
