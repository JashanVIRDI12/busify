-- ===========================================================================
-- Repair columns the quote builder writes that a drifted hosted schema may
-- still be missing. Idempotent: a database that already ran quote_builder /
-- console_parity is a no-op besides the PostgREST schema-cache reload.
--
-- The live errors this addresses:
--   PGRST204 Could not find the 'contract_terms_id' column of 'quotes'
--   42703    column saved_views.name does not exist
-- ===========================================================================

alter table public.quotes
  add column if not exists contract_terms_id uuid;

alter table if exists public.saved_views
  add column if not exists name text;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'saved_views'
  ) then
    update public.saved_views
      set name = 'Untitled'
      where name is null or btrim(name) = '';
  end if;
end;
$$;

notify pgrst, 'reload schema';
