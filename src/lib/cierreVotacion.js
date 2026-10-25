/**
 * Cierre automático de la votación del DJ Democracy (migración
 * 20261025030000): en los últimos `vote_close_seconds` segundos de la canción
 * al aire la votación se cierra sola y se prepara la próxima.
 *
 * Es el mismo cálculo que pantalla__segundos_restantes / pantalla__votacion_cerrada
 * en la base — que es la que manda: rechaza los votos con 'voting closed'. Acá
 * es para mostrarlo (TV, celular, editor). Sin sesión ni Supabase: sólo la
 * fila del evento.
 */

const VIGENCIA_MS = 30_000;   // un reporte de la TV más viejo que esto no sirve

/** Segundos que le quedan a la canción al aire, o null si no se sabe. */
export function segundosRestantes(ev, ahora = Date.now()) {
  if (!ev?.current_item_id || !(Number(ev.tv_duration) > 0) || !ev.tv_reported_at) return null;
  const reportado = Date.parse(ev.tv_reported_at);
  if (!Number.isFinite(reportado) || ahora - reportado > VIGENCIA_MS) return null;
  if (ev.current_started_at && reportado < Date.parse(ev.current_started_at)) return null;
  const corriendo = ev.is_playing !== false ? (ahora - reportado) / 1000 : 0;
  return Number(ev.tv_duration) - (Number(ev.tv_current_time) || 0) - corriendo;
}

/** ¿Ya cerró la votación de la canción al aire? */
export function votacionCerrada(ev, ahora = Date.now()) {
  const umbral = Number(ev?.vote_close_seconds) || 0;
  if (umbral <= 0) return false;
  const r = segundosRestantes(ev, ahora);
  return r !== null && r <= umbral;
}
