-- ===========================================================================
-- Busify AI — 0005: Storage buckets and their policies
--
-- Path convention for every bucket:  <organization_id>/<...>
-- The first path segment is the tenant key, and the policies below read it
-- back out of the object name. Anything not starting with a UUID the caller
-- belongs to is unreachable.
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('organization-logos', 'organization-logos', true,  2 * 1024 * 1024,
   array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  ('vehicle-images', 'vehicle-images', true, 5 * 1024 * 1024,
   array['image/png', 'image/jpeg', 'image/webp']),
  ('driver-documents', 'driver-documents', false, 10 * 1024 * 1024, null),
  ('customer-attachments', 'customer-attachments', false, 10 * 1024 * 1024, null),
  ('trip-documents', 'trip-documents', false, 10 * 1024 * 1024, null)
on conflict (id) do nothing;

-- Safely pull the tenant UUID out of an object path. Returns null rather than
-- raising when the first segment is not a UUID, so a malformed upload path
-- simply fails the policy.
create or replace function app.storage_org_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_first text := split_part(coalesce(object_name, ''), '/', 1);
begin
  if v_first !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return v_first::uuid;
end;
$$;

grant execute on function app.storage_org_id(text) to authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- Private buckets: members read, writers write, managers delete.
-- ---------------------------------------------------------------------------
create policy "storage: members read tenant objects"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('driver-documents', 'customer-attachments', 'trip-documents',
                  'organization-logos', 'vehicle-images')
    and app.is_org_member(app.storage_org_id(name), (select auth.uid()))
  );

create policy "storage: writers upload tenant objects"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('driver-documents', 'customer-attachments', 'trip-documents',
                  'organization-logos', 'vehicle-images')
    and app.can_write(app.storage_org_id(name), (select auth.uid()))
  );

create policy "storage: writers replace tenant objects"
  on storage.objects for update to authenticated
  using (
    bucket_id in ('driver-documents', 'customer-attachments', 'trip-documents',
                  'organization-logos', 'vehicle-images')
    and app.can_write(app.storage_org_id(name), (select auth.uid()))
  )
  with check (
    bucket_id in ('driver-documents', 'customer-attachments', 'trip-documents',
                  'organization-logos', 'vehicle-images')
    and app.can_write(app.storage_org_id(name), (select auth.uid()))
  );

create policy "storage: managers delete tenant objects"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('driver-documents', 'customer-attachments', 'trip-documents',
                  'organization-logos', 'vehicle-images')
    and app.can_manage(app.storage_org_id(name), (select auth.uid()))
  );
