import { supabase } from "../lib/supabase";

/**
 * Duelo de Talentos V1 — contrato con el backend.
 *
 * Toda escritura del Duelo pasa por RPC (migración 20260930005253):
 *   duelo_launch_round  → abre la ronda, fija participantes, video y reglas
 *   duelo_finish_round  → cierra la medición y persiste `result` (p1|p2|tie)
 *   duelo_cancel_round  → cancela la ronda activa y limpia la presentación
 *   applause_add        → un lote de aplausos (1..50) de un espectador
 *
 * Las RPC devuelven SIEMPRE un jsonb `{ ok, code, ... }` y no tiran por reglas
 * de negocio. Acá se normaliza la respuesta; nunca se decide nada que el
 * backend ya decide (ganador, cupo, quién puede votar).
 */

/** Máximo de taps por llamada a `applause_add` (espejo de c_max_delta). */
export const APLAUSOS_MAX_POR_ENVIO = 50;

/** Rangos de las reglas, espejo de los CHECK de `duelo_reglas_config`. */
export const DUELO_DURACION_MIN = 10;
export const DUELO_DURACION_MAX = 600;
export const DUELO_APLAUSOS_MIN = 10;
export const DUELO_APLAUSOS_MAX = 1000;

export const REGLA_DUELO_DURACION = "duracion_votacion";
export const REGLA_DUELO_APLAUSOS = "max_aplausos_usuario";

/**
 * Llama una RPC que devuelve jsonb. Un error de transporte o de Postgres se
 * convierte en `{ ok:false, code:'NETWORK_ERROR' | 'RPC_ERROR' }`, así el
 * llamador tiene un único formato que interpretar.
 */
async function rpcJson(nombre, args) {
  try {
    const { data, error } = await supabase.rpc(nombre, args);
    if (error) {
      console.error(`[duelo] ${nombre}:`, error);
      return { ok: false, code: error.code === "42501" ? "UNAUTHORIZED" : "RPC_ERROR", error: error.message };
    }
    if (!data || typeof data !== "object") return { ok: false, code: "RPC_ERROR", error: "Respuesta vacía" };
    return data;
  } catch (e) {
    return { ok: false, code: "NETWORK_ERROR", error: e?.message || String(e) };
  }
}

export const lanzarRondaDuelo = ({ sessionId, postulacion1, postulacion2, video = null }) =>
  rpcJson("duelo_launch_round", {
    p_session: sessionId,
    p_postulacion_1: postulacion1,
    p_postulacion_2: postulacion2,
    p_video: video,
  });

export const finalizarRondaDuelo = (roundId, force = true) =>
  rpcJson("duelo_finish_round", { p_round: roundId, p_force: force });

export const cancelarRondaDuelo = (sessionId, clearScreen = true) =>
  rpcJson("duelo_cancel_round", { p_session: sessionId, p_clear_screen: clearScreen });

export const enviarAplausos = (roundId, slot, delta) =>
  rpcJson("applause_add", { p_round: roundId, p_slot: slot, p_delta: delta });

/** Push nativo a los conectados de la sesión (Edge Function `send-push`). */
export async function pushDuelo(sessionId, { title, body, tag }) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.functions.invoke("send-push", {
      body: { session_id: sessionId, title, body, url: "/?view=games&game=duelo", tag },
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
    });
  } catch (e) {
    // El push es un aviso: si falla, el Duelo sigue igual.
    console.warn("[duelo] push:", e?.message || e);
  }
}

// ── Mensajes para el operador ──────────────────────────────────────────────
const MENSAJES_ADMIN = {
  UNAUTHORIZED:        "Tu usuario no figura como administrador.",
  INVALID_REQUEST:     "Faltan datos: elegí a los dos participantes.",
  SAME_PARTICIPANT:    "Los dos participantes tienen que ser personas distintas.",
  PARTICIPANT_INVALID: "Uno de los participantes ya no es una postulación válida. Elegilo de nuevo.",
  INVALID_VIDEO:       "El video no es válido: usá un link de YouTube o una URL http(s).",
  SESSION_NOT_FOUND:   "La sesión activa no tiene estado de juego.",
  SESSION_INACTIVE:    "La sesión no está activa.",
  CONFIG_INCOMPLETE:   "Falta configuración del Duelo en la base.",
  CONFLICT:            "Otro lanzamiento se cruzó con este. Reintentá.",
  ROUND_NOT_FOUND:     "La ronda ya no existe.",
  ROUND_CANCELLED:     "La ronda fue cancelada.",
  VOTING_STILL_OPEN:   "La votación sigue abierta.",
  NETWORK_ERROR:       "No se pudo contactar al servidor. Revisá la conexión.",
  RPC_ERROR:           "El servidor rechazó la operación.",
};

export function mensajeDueloAdmin(r) {
  if (r?.code === "PARTICIPANT_INVALID" && (r.slot === 1 || r.slot === 2)) {
    return `El participante ${r.slot} ya no es una postulación válida. Elegilo de nuevo.`;
  }
  return MENSAJES_ADMIN[r?.code] || r?.error || "No se pudo completar la operación.";
}

// ── Lectura de la ronda ────────────────────────────────────────────────────
/** `p1_avatar` / `p2_avatar` son texto JSON escrito por la RPC. */
function leerAvatar(txt) {
  if (!txt) return {};
  try { const o = JSON.parse(txt); return o && typeof o === "object" ? o : {}; }
  catch { return {}; }
}

/** Los dos duelistas, tal como quedaron congelados en la ronda. */
export function duelistasDeRonda(round) {
  if (!round) return [null, null];
  const armar = (n) => {
    const a = leerAvatar(round[`p${n}_avatar`]);
    return {
      slot: n,
      user_id: round[`p${n}_user_id`] || null,
      name: round[`p${n}_name`] || `Participante ${n}`,
      avatar_emoji: a.avatar_emoji || null,
      photo_url: a.photo_url || null,
    };
  };
  return [armar(1), armar(2)];
}

/**
 * Fase visible del Duelo, igual en Admin, Cliente y Pantalla.
 *
 *   off          → el Duelo no está en el escenario
 *   convocatoria → al aire, sin ronda votando (postulaciones abiertas)
 *   voting       → ronda en votación
 *   result       → ronda terminada y todavía en pantalla
 *
 * La ronda manda sobre `game_state.duelo_state`: el resultado se muestra en
 * cuanto la ronda está `finished`, aunque el espejo de game_state llegue unos
 * milisegundos después. `duelo_state='idle'` (Nueva ronda / cancelar) es lo
 * único que baja el resultado.
 */
export function faseDuelo(gameState, round) {
  if (gameState?.active_escenario !== "duelo") return "off";
  if (round?.status === "voting") return "voting";
  if (round?.status === "finished" && gameState?.duelo_state !== "idle") return "result";
  return "convocatoria";
}

/** Reparto 0–100 de los totales. Sólo presentación: el ganador es `round.result`. */
export function porcentajesDuelo(counts) {
  const p1 = Number(counts?.p1) || 0;
  const p2 = Number(counts?.p2) || 0;
  const total = p1 + p2;
  if (!total) return { p1: 50, p2: 50 };
  const p1Pct = Math.round((p1 / total) * 100);
  return { p1: p1Pct, p2: 100 - p1Pct };
}

/** Segundos que faltan para `voting_ends_at` (null si la ronda no tiene reloj). */
export function segundosRestantes(round, nowMs) {
  if (!round?.voting_ends_at) return null;
  return Math.max(0, Math.ceil((new Date(round.voting_ends_at).getTime() - nowMs) / 1000));
}

export function formatoReloj(seg) {
  if (seg == null) return "";
  const m = Math.floor(seg / 60), s = seg % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
