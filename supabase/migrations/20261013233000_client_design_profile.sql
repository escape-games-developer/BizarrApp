-- client_design_active: "Mi Perfil" pasa a ser sección activable desde el
-- Diseñador Cliente. 'original' = Diseño Jorge, 'cantoni' = Diseño Cantoni
-- (ambos ya permitidos por client_design_active_design_key_valido).
-- Las filas se crean por migración; el Admin sólo hace UPDATE de design_key.

insert into public.client_design_active (section, design_key)
values ('profile', 'original')
on conflict (section) do nothing;
