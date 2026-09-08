import { supabase } from "../lib/supabase";

/**
 * Inicio de jornada — el único punto donde la noche arranca en limpio.
 *
 * `sessions` no rota: hay una sola fila activa desde que se creó la base, y
 * `game_state` cuelga de ella con PRIMARY KEY (session_id). Es decir: lo que
 * quedó puesto en la pantalla anoche sigue puesto mañana, porque nadie lo
 * apaga. Por eso una noche que terminó con el Duelo al aire abre la noche
 * siguiente con el Duelo al aire.
 *
 * La limpieza NO puede vivir en el montaje de /tv ni de /pantalla: un F5
 * durante un juego en vivo, o volver a abrir la TV en medio de la misma
 * jornada, tienen que reconstruir el juego activo. Vive acá, en una acción
 * explícita de comienzo de jornada, y todos los llamadores pasan por esta
 * función — sin lógica duplicada por juego.
 *
 * DJ Democracy no necesita `active_game`: es la capa base de /tv y aparece
 * sola en cuanto no queda ningún overlay encima.
 */

/**
 * Campos de `game_state` que existen SÓLO para sostener algo encima del DJ.
 * Vuelven al valor con el que nace la fila (ver `supabase/schema.sql`).
 *
 * Quedan deliberadamente afuera:
 *  - `raffle_prize` y `trivia_coupon`: configuración de la casa, no overlay.
 *  - `zocalo_active` y `screen_audio_enabled`: modos de operación de la
 *    pantalla, no un juego anterior.
 *  - `webapp_banner`: columna sin uso en el código.
 */
export const CAMPOS_NEUTROS_JORNADA = Object.freeze({
  // Capas principales
  active_game:           null,
  active_escenario:      null,
  active_placa:          null,
  placa_custom:          null,
  // Rey del Orto
  raffle_state:          "idle",
  raffle_winner_id:      null,
  raffle_winner_name:    null,
  // Desafío Demente
  trivia_state:          "idle",
  trivia_question:       0,
  trivia_round_id:       null,
  trivia_winner_team:    null,
  // Duelo de Talentos
  duelo_state:           "idle",
  duelo_slot1:           null,
  duelo_slot2:           null,
  duelo_video:           null,
  duelo_winner:          null,
  duelo_votes_a:         0,
  duelo_votes_b:         0,
  // Escenario (FTL / PT / Karaoke)
  escenario_invite_type: null,
  escenario_participant: null,
  escenario_video:       null,
  // Minijuegos
  minijuego_payload:     null,
});

/** Sesión activa. Es la que leen /tv, /pantalla y la WebApp. */
async function sesionActiva() {
  const { data, error } = await supabase
    .from("sessions")
    .select("id")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No hay sesión activa: no se puede iniciar la jornada.");
  return data.id;
}

/**
 * Deja la jornada en cero: sin juego, sin escenario, sin placa y sin video
 * proyectado. No toca historial, resultados, playlists, canciones, usuarios,
 * configuración ni votos históricos — sólo apaga lo que está puesto ahora.
 *
 * Idempotente: correrla dos veces no cambia nada. Requiere admin (RLS).
 */
export async function iniciarJornada(sessionId = null) {
  const id = sessionId || await sesionActiva();

  // `.select()` para saber si el UPDATE tocó algo: una sesión activa sin fila
  // en `game_state` haría un no-op silencioso y el operador se iría creyendo
  // que arrancó limpio.
  const { data, error } = await supabase
    .from("game_state")
    .update(CAMPOS_NEUTROS_JORNADA)
    .eq("session_id", id)
    .select("session_id");
  if (error) throw new Error(error.message);
  if (!data?.length) {
    throw new Error(`La sesión activa (${id}) no tiene fila en game_state.`);
  }

  // El video proyectado vive en `video_requests`, no en `game_state`, y
  // sobrevive al cambio de día igual que el resto. Se marca 'dismissed' —
  // el pedido queda en la tabla, sólo deja de estar al aire.
  const { error: eVideo } = await supabase
    .from("video_requests")
    .update({ status: "dismissed" })
    .eq("session_id", id)
    .eq("status", "launched");
  if (eVideo) throw new Error(eVideo.message);

  // La cola de escenario (FTL / PT / Karaoke) tampoco rota sola. Una fila
  // 'called' de anoche hace que el panel abra la jornada mostrando un líder
  // fantasma en escena. Pasan a 'done': la fila queda, sólo deja de estar en
  // curso.
  const { error: eCola } = await supabase
    .from("escenario_queue")
    .update({ status: "done" })
    .eq("session_id", id)
    .in("status", ["waiting", "called"]);
  if (eCola) throw new Error(eCola.message);

  return { session_id: id };
}
