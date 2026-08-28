import { supabase } from "../lib/supabase";

/**
 * Módulo Pantalla/Escenario — configuración avanzada del evento.
 *
 * Todo lo que vive en tablas satélite del evento: equipos, regalos VIP, packs
 * de emojis, GIFs, tandas publicitarias, logros, premios, contactos, presets de
 * orden y links cortos.
 *
 * A diferencia de `pantallaDj.js`, acá no hay RPCs: son tablas planas con RLS
 * `pantalla_can_manage(event_id)`. Como la RLS filtra sin devolver error, cada
 * escritura pide `select()` y trata «cero filas» como error — igual que
 * `saveEventFields`.
 */

const CERO_FILAS = "rls_sin_filas";

const leer = async (tabla, eventId, orden = null) => {
  if (!eventId) return [];
  let q = supabase.from(tabla).select("*").eq("event_id", eventId);
  if (orden) q = q.order(orden, { ascending: true });
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
};

const escribir = async (promesa) => {
  const { data, error } = await promesa;
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error(CERO_FILAS);
  return data;
};

const borrar = async (tabla, filtro) => {
  const { error } = await filtro;
  if (error) throw new Error(error.message);
  return true;
};

const ahora = () => new Date().toISOString();

// ── Equipos (4.7) ────────────────────────────────────────────────────────────
// Hasta 6 equipos por evento; `points` lo lleva el motor, el panel no lo toca.
export const MAX_EQUIPOS = 6;

export const fetchTeams = (eventId) => leer("pantalla_teams", eventId, "position");

export const createTeam = (eventId, { name, icon, position }) =>
  escribir(supabase.from("pantalla_teams")
    .insert({ event_id: eventId, name, icon, position }).select("id"));

export const updateTeam = (id, patch) =>
  escribir(supabase.from("pantalla_teams").update(patch).eq("id", id).select("id"));

export const deleteTeam = (id) =>
  borrar("pantalla_teams", supabase.from("pantalla_teams").delete().eq("id", id));

// ── Regalos periódicos para VIP (4.6) ────────────────────────────────────────
// PK (event_id, gift_type). Los cuatro tipos los fija un CHECK en la tabla.
export const TIPOS_REGALO = ["screen_message", "gif_screen", "giant_reaction", "extra_super_vote"];

export const fetchVipGifts = (eventId) => leer("pantalla_vip_gifts", eventId);

export const saveVipGifts = (eventId, filas) =>
  escribir(supabase.from("pantalla_vip_gifts")
    .upsert(filas.map((f) => ({
      event_id: eventId, gift_type: f.gift_type, enabled: f.enabled,
      interval_minutes: f.interval_minutes, quantity: f.quantity, updated_at: ahora(),
    })), { onConflict: "event_id,gift_type" })
    .select("gift_type"));

// ── Packs de emojis por rol (4.5) ────────────────────────────────────────────
export const fetchEmojiPacks = (eventId) => leer("pantalla_emoji_packs", eventId);

export const saveEmojiPacks = (eventId, filas) =>
  escribir(supabase.from("pantalla_emoji_packs")
    .upsert(filas.map((f) => ({
      event_id: eventId, role: f.role, emojis: f.emojis, updated_at: ahora(),
    })), { onConflict: "event_id,role" })
    .select("role"));

// ── GIFs (4.11 transición, 4.12 premios) ─────────────────────────────────────
// `kind` acepta 'prize' y 'transition'; `is_active` marca el que se usa.
export const fetchGifs = (eventId) => leer("pantalla_gifs", eventId, "position");

export const createGif = (eventId, { url, kind, position }) =>
  escribir(supabase.from("pantalla_gifs")
    .insert({ event_id: eventId, url, kind, position }).select("id"));

export const deleteGif = (id) =>
  borrar("pantalla_gifs", supabase.from("pantalla_gifs").delete().eq("id", id));

/** Deja activo un solo GIF por tipo: apaga los del mismo `kind` y prende uno. */
export async function setGifActivo(eventId, kind, id) {
  const { error } = await supabase.from("pantalla_gifs")
    .update({ is_active: false }).eq("event_id", eventId).eq("kind", kind);
  if (error) throw new Error(error.message);
  if (!id) return true;
  return escribir(supabase.from("pantalla_gifs")
    .update({ is_active: true }).eq("id", id).select("id"));
}

// ── Tandas publicitarias (4.10) ──────────────────────────────────────────────
export const fetchAdClips = (eventId) => leer("pantalla_ad_clips", eventId, "position");

export const createAdClip = (eventId, clip) =>
  escribir(supabase.from("pantalla_ad_clips")
    .insert({ event_id: eventId, ...clip }).select("id"));

export const updateAdClip = (id, patch) =>
  escribir(supabase.from("pantalla_ad_clips").update(patch).eq("id", id).select("id"));

export const deleteAdClip = (id) =>
  borrar("pantalla_ad_clips", supabase.from("pantalla_ad_clips").delete().eq("id", id));

/**
 * Reordena la cola de tandas: recibe los ids en el orden nuevo y sube sólo las
 * filas cuya posición cambió. Misma mecánica que `reorderItems` de la playlist,
 * pero sobre `pantalla_ad_clips`; la cola nunca es larga, así que va de una.
 */
export async function reorderAdClips(idsEnOrden, posicionActual) {
  const cambios = [];
  idsEnOrden.forEach((id, i) => {
    if (posicionActual.get(id) !== i) cambios.push({ id, position: i });
  });
  await Promise.all(cambios.map(({ id, position }) =>
    supabase.from("pantalla_ad_clips").update({ position }).eq("id", id)
      .then(({ error }) => { if (error) throw new Error(error.message); })));
  return cambios.length;
}

// ── Logros (4.12) ────────────────────────────────────────────────────────────
// PK (event_id, achievement_key). `levels` es jsonb: [{ label, threshold }].
export const fetchAchievements = (eventId) => leer("pantalla_achievements", eventId);

export const saveAchievements = (eventId, filas) =>
  escribir(supabase.from("pantalla_achievements")
    .upsert(filas.map((f) => ({
      event_id: eventId, achievement_key: f.achievement_key, enabled: f.enabled,
      title: f.title, description: f.description, levels: f.levels, updated_at: ahora(),
    })), { onConflict: "event_id,achievement_key" })
    .select("achievement_key"));

// ── Catálogo de premios (4.12) ───────────────────────────────────────────────
// `prize_key` está acotado por CHECK: estos ocho y ninguno más.
export const CLAVES_PREMIO = [
  "extra_super_vote", "giant_reaction", "highlighted_nickname", "physical_prize",
  "vip_upgrade", "gif_screen", "screen_message", "vip_badge",
];

export const fetchPrizes = (eventId) => leer("pantalla_prizes", eventId);

export const savePrizes = (eventId, filas) =>
  escribir(supabase.from("pantalla_prizes")
    .upsert(filas.map((f) => ({
      event_id: eventId, prize_key: f.prize_key, enabled: f.enabled, updated_at: ahora(),
    })), { onConflict: "event_id,prize_key" })
    .select("prize_key"));

// ── Premios reales del local (4.12) ──────────────────────────────────────────
export const fetchPhysicalPrizes = (eventId) => leer("pantalla_physical_prizes", eventId, "position");

export const createPhysicalPrize = (eventId, { name, position }) =>
  escribir(supabase.from("pantalla_physical_prizes")
    .insert({ event_id: eventId, name, position }).select("id"));

export const updatePhysicalPrize = (id, patch) =>
  escribir(supabase.from("pantalla_physical_prizes").update(patch).eq("id", id).select("id"));

export const deletePhysicalPrize = (id) =>
  borrar("pantalla_physical_prizes", supabase.from("pantalla_physical_prizes").delete().eq("id", id));

// ── Código de canje del premio físico ────────────────────────────────────────
//
// Vive en `pantalla_event_secrets`, que NO tiene policy de lectura pública: es
// la misma tabla del token de la TV. Por eso el código no puede salir por REST
// hacia un invitado ni aparecer en ninguna respuesta que él pueda pedir.
//
// Las dos funciones usan `supabase` (cliente con sesión). Nunca `supabaseAnon`:
// sin sesión, `pantalla_can_manage` es falso y no devolverían nada.

export async function fetchPhysicalPrizeCode(eventId) {
  const { data, error } = await supabase.from("pantalla_event_secrets")
    .select("physical_prize_code").eq("event_id", eventId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.physical_prize_code ?? null;
}

/**
 * La fila de secretos puede no existir todavía (la crea `pantalla_get_tv_link`).
 * El upsert sólo manda `event_id` y el código: en un conflicto, PostgREST
 * actualiza nada más que esas columnas, así que `tv_access_token` queda intacto
 * y nadie pierde el acceso de la TV por guardar un código de canje.
 */
export async function savePhysicalPrizeCode(eventId, code) {
  const { data, error } = await supabase.from("pantalla_event_secrets")
    .upsert({ event_id: eventId, physical_prize_code: code || null },
            { onConflict: "event_id" })
    .select("event_id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error(CERO_FILAS);
  return true;
}

// ── Base de contactos (4.4) ──────────────────────────────────────────────────
export const fetchContacts = (eventId) =>
  leer("pantalla_contacts", eventId, "created_at");

/** CSV con comillas escapadas. Sin dependencias: son cuatro columnas. */
export function contactosACsv(filas) {
  const escapar = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const cabecera = ["Apodo", "Email", "Teléfono", "Fecha"].map(escapar).join(",");
  const cuerpo = filas.map((f) => [
    f.nickname, f.email, f.phone,
    f.created_at ? new Date(f.created_at).toLocaleString("es-AR") : "",
  ].map(escapar).join(","));
  return [cabecera, ...cuerpo].join("\r\n");
}

// ── Presets de orden de playlist (4.13) ──────────────────────────────────────
// `item_order` guarda el array de ids en el orden en que estaban.
export const fetchPresets = (eventId) => leer("pantalla_playlist_presets", eventId, "created_at");

export const createPreset = (eventId, { name, item_order }) =>
  escribir(supabase.from("pantalla_playlist_presets")
    .insert({ event_id: eventId, name, item_order }).select("id"));

export const deletePreset = (id) =>
  borrar("pantalla_playlist_presets", supabase.from("pantalla_playlist_presets").delete().eq("id", id));

// ── Links cortos (4.14) ──────────────────────────────────────────────────────
// La PK es el propio `code`, así que un código repetido falla en la base.
export const fetchShortLinks = (eventId) => leer("pantalla_short_links", eventId, "created_at");

export const createShortLink = (eventId, { code, target }) =>
  escribir(supabase.from("pantalla_short_links")
    .insert({ code, event_id: eventId, target }).select("code"));

export const deleteShortLink = (code) =>
  borrar("pantalla_short_links", supabase.from("pantalla_short_links").delete().eq("code", code));

/** Descarga un texto como archivo, sin dependencias ni servidor. */
export function descargarTexto(nombre, contenido, tipo = "text/plain;charset=utf-8") {
  const blob = new Blob([contenido], { type: tipo });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
