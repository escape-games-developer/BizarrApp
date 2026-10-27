-- El panel (contador 👥 y listas de participantes de Rey, Sumate y Palabra)
-- escucha connected_users en vivo en vez de releer cada 10 s o con ↻.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'connected_users') then
    alter publication supabase_realtime add table public.connected_users;
  end if;
end $$;
