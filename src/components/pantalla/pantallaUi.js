import { ytThumb } from "../../services/pantallaDj";

/**
 * Helpers de presentación del módulo Pantalla/Escenario.
 *
 * Sólo formato y traducción: ni una consulta, ni una regla de negocio. Lo usan
 * la consola del DJ, el admin y el cliente, así los tres hablan igual.
 */

/** Paleta del módulo. Identidad BizarrApp: noche, violeta, fucsia y amarillo. */
export const P = {
  bg:      "#08040F",
  bg2:     "#110820",
  violeta: "#9B2FFF",
  fucsia:  "#FF2D78",
  amarillo:"#FFD600",
  cyan:    "#00E5FF",
  verde:   "#00F5A0",
  naranja: "#FF9500",
  texto:   "#F0E8FF",
  tenue:   "rgba(240,232,255,.38)",
  tenue2:  "rgba(240,232,255,.22)",
};

/** Portada del tema; si no hay, el thumbnail del propio video. */
export const portada = (item) =>
  item?.cover_url || (item?.youtube_id ? ytThumb(item.youtube_id) : null);

/** 92 → "1:32" */
export function tiempo(segundos) {
  if (segundos == null || Number.isNaN(Number(segundos))) return "--:--";
  const t = Math.max(0, Math.floor(Number(segundos)));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

/** Score con signo, para que un +12 se lea distinto de un -3. */
export const conSigno = (n) => (n > 0 ? `+${n}` : String(n ?? 0));

export const colorScore = (n) =>
  n > 0 ? P.verde : n < 0 ? P.fucsia : "rgba(240,232,255,.28)";

/** Estado del evento, tal como lo guarda pantalla_events.status. */
export const ESTADO_EVENTO = {
  draft: { label: "BORRADOR",   color: P.amarillo, bg: "rgba(255,214,0,.12)",  borde: "rgba(255,214,0,.35)" },
  live:  { label: "EN VIVO",    color: P.verde,    bg: "rgba(0,245,160,.14)",  borde: "rgba(0,245,160,.45)" },
  ended: { label: "FINALIZADO", color: P.tenue,    bg: "rgba(240,232,255,.06)",borde: "rgba(240,232,255,.14)" },
};

/**
 * Estado visible de un tema dentro del evento. Deriva del estado real
 * (current_item_id + is_active_candidate + last_status), no inventa ninguno.
 */
export function estadoTema(item, event) {
  if (item.id === event?.current_item_id)  return { label: "SONANDO",     color: P.fucsia,   bg: "rgba(255,45,120,.15)" };
  if (!item.enabled)                       return { label: "INACTIVA",    color: P.tenue2,   bg: "rgba(240,232,255,.05)" };
  if (item.is_active_candidate)            return { label: "CANDIDATA",   color: P.cyan,     bg: "rgba(0,229,255,.12)" };
  if (item.last_status === "played_recently") return { label: "REPRODUCIDA", color: P.tenue, bg: "rgba(240,232,255,.05)" };
  if (item.last_status === "rejected")     return { label: "DESCARTADA",  color: P.naranja,  bg: "rgba(255,149,0,.1)" };
  return { label: "EN ESPERA", color: P.tenue2, bg: "rgba(240,232,255,.04)" };
}

/** Por qué terminó un tema, en castellano de bar. */
export const MOTIVO_HISTORIAL = {
  advance: { label: "Terminó / avanzó",     icono: "⏭", color: P.tenue },
  kick:    { label: "Sacada por el público", icono: "👎", color: P.fucsia },
  manual:  { label: "Salteada por el DJ",    icono: "🎛", color: P.cyan },
  skip:    { label: "Salteada",              icono: "⤼", color: P.naranja },
};

/**
 * Traduce los errores del motor a algo que una persona entienda.
 * Los mensajes del servidor NO se tocan: esto es sólo la capa de UI.
 */
const ERRORES = {
  "super already used":            "Ya usaste tu Super Voto en este evento.",
  "vote_disabled_for_role":        "Este tipo de voto no está habilitado para tu usuario.",
  "song not in active candidates": "Este tema ya no está disponible para votar.",
  "event not live":                "El evento todavía no arrancó.",
  "event not found":               "No encontramos el evento.",
  "not authenticated":             "Necesitás iniciar sesión para votar.",
  "not authorized":                "No tenés permisos para hacer esto.",
  "voting disabled":               "El DJ desactivó la votación por un rato.",
  "kick disabled":                 "Sacar Tema está deshabilitado en este evento.",
  "no current song":               "No hay ninguna canción sonando.",
  "invalid tv access":             "El acceso de la TV no es válido.",
  "forced song not available":     "Ese tema no está disponible para lanzar.",
  "participant not found":         "Ese participante ya no está en el evento.",
};

export function mensajeAmigable(error) {
  const raw = (typeof error === "string" ? error : error?.message || "").trim();
  if (!raw) return "Algo salió mal. Probá de nuevo.";
  if (ERRORES[raw]) return ERRORES[raw];
  // Los avances pisados son ruido de carrera: no vale asustar al DJ.
  if (raw.startsWith("stale advance")) return "Alguien ya cambió la canción. Actualizado.";
  const clave = Object.keys(ERRORES).find((k) => raw.includes(k));
  return clave ? ERRORES[clave] : raw;
}
