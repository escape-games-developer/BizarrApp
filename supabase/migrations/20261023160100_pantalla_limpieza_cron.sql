-- Limpieza automática de invitados: el job que faltaba.
--
-- `pantalla_cleanup_guests()` existe desde 20260909130000, pero nada la corría
-- (la base no tenía pg_cron). Cada 15 minutos alcanza: la configuración es en
-- horas (`guest_max_connection_hours`), así que en el peor caso alguien queda
-- 15 minutos de más. La función sólo actúa sobre eventos en vivo con
-- `guest_cleanup_enabled` y nunca toca vip / staff / dj.

create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'pantalla-limpieza-invitados') then
    perform cron.unschedule('pantalla-limpieza-invitados');
  end if;
end $$;

select cron.schedule('pantalla-limpieza-invitados', '*/15 * * * *', 'select public.pantalla_cleanup_guests()');
