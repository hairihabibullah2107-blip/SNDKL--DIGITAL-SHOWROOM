-- Retain the legacy Member Club tables and records, but disable unused RPC entry points
-- now that the database is dedicated to the Digital Showroom.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'mc\_%' escape '\'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.signature);
  end loop;
end $$;
