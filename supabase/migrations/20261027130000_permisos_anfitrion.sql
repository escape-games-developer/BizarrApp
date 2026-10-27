-- Ajustes → Permisos del anfitrión — admin_ui_config key 'permisos_anfitrion'.
-- Qué puede hacer el perfil Anfitrión (panel de la tablet) además de ver y
-- lanzar. El administrador los prende o apaga; el panel del anfitrión los lee.
--   escenarioLlamar  → FTL / PT: llamar a un inscripto al escenario
--   escenarioCancion → FTL / PT: elegir la canción (biblioteca)
--   triviaPreguntas  → Desafío Demente: elegir las preguntas de la ronda
-- Valores: booleanos; lo que falte toma el valor por defecto del panel.

insert into public.admin_ui_config (key, value)
values ('permisos_anfitrion',
        '{"version":1,"escenarioLlamar":true,"escenarioCancion":false,"triviaPreguntas":false}'::jsonb)
on conflict (key) do nothing;
