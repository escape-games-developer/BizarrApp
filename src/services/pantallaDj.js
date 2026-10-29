import { supabase, supabaseAnon } from "../lib/supabase";
import { iniciarJornada } from "./jornada";

/**
 * Módulo Pantalla/Escenario — capa de acceso a datos.
 *
 * Réplica funcional de DJ Democracy sobre nuestro Supabase. Toda la lógica
 * sensible vive en RPCs SECURITY DEFINER: acá sólo se las llama. El cliente
 * nunca escribe score, candidatos ni canción actual.
 *
 * `supabase`     → cliente con sesión (cliente autenticado, admin, DJ)
 * `supabaseAnon` → sin sesión (la TV, que entra por token)
 */

// Columnas públicas de un tema. Nunca se piden columnas de secretos.
export const ITEM_COLS =
  "id,event_id,title,artist,album,cover_url,source_type,youtube_id,duration_seconds," +
  "position,enabled,locked,pinned,is_active_candidate,pos_votes,neg_votes,score," +
  "times_played,last_status,consecutive_last_place_rounds,hot_until," +
  "trim_start_seconds,trim_end_seconds,youtube_volume,won_with_score,category,edited";

const unwrap = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

/** Extrae el id de un link de YouTube en cualquiera de sus formas. */
export function extractYtId(url) {
  if (!url) return null;
  const u = String(url).trim();
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of patterns) { const m = u.match(re); if (m) return m[1]; }
  return /^[a-zA-Z0-9_-]{11}$/.test(u) ? u : null;
}

/**
 * Parsea el textarea del admin, mismo formato que DJ Democracy:
 *   URL
 *   URL | Título
 *   URL | Título | Artista
 *   URL | Título | Artista | Inicio | Fin      (recorte en segundos)
 */
export function parseYoutubeLines(text) {
  const items = [], errors = [];
  for (const raw of String(text || "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    // URL | Título | Artista | Inicio | Fin | Volumen (0-100) | Categoría (A/B/C/D)
    const [url, title, artist, start, end, vol, cat] = line.split("|").map((p) => p.trim());
    const youtube_id = extractYtId(url);
    if (!youtube_id) { errors.push(line); continue; }
    const volumen = vol === undefined || vol === "" ? null : Math.max(0, Math.min(100, Math.round(Number(vol) || 0)));
    const categoria = /^[ABCD]$/i.test(cat || "") ? cat.toUpperCase() : null;
    items.push({
      youtube_id,
      title:  title  || "",
      artist: artist || "",
      trim_start_seconds: Number(start) || 0,
      trim_end_seconds:   end ? String(Number(end) || "") : "",
      ...(volumen !== null ? { youtube_volume: volumen } : {}),
      ...(categoria ? { category: categoria } : {}),
    });
  }
  return { items, errors };
}

export const ytThumb  = (id) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
export const guestUrl = (code) => `${window.location.origin}/?pantallaCode=${code}`;
export const tvUrl    = (code, token) =>
  `${window.location.origin}/tv?code=${code}&key=${token}`;
/** Pantalla Telepronter: el espejo de /tv para el participante. Mismo token. */
export const telepronterUrl = (code, token) =>
  `${window.location.origin}/telepronter?code=${code}&key=${token}`;

// ── Lectura ─────────────────────────────────────────────────────────────────

/** Evento en vivo, si hay alguno. Devuelve null cuando el bar no tiene evento. */
export async function fetchLiveEvent(client = supabase) {
  const { data, error } = await client
    .from("pantalla_events").select("*").eq("status", "live").maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

export async function fetchEvent(eventId, client = supabase) {
  if (!eventId) return null;
  return unwrap(await client.from("pantalla_events").select("*").eq("id", eventId).maybeSingle());
}

export async function listEvents() {
  return unwrap(await supabase.from("pantalla_events").select("*")
    .order("created_at", { ascending: false })) || [];
}

export async function fetchItems(eventId, client = supabase) {
  if (!eventId) return [];
  return unwrap(await client.from("pantalla_playlist_items").select(ITEM_COLS)
    .eq("event_id", eventId)
    .order("position", { ascending: true })) || [];
}

export async function fetchVotePowers(eventId, client = supabase) {
  if (!eventId) return [];
  return unwrap(await client.from("pantalla_vote_powers")
    .select("role,vote_type,enabled,value").eq("event_id", eventId)) || [];
}

/** Sólo los votos propios: la RLS no deja ver los ajenos salvo al admin. */
export async function fetchMyVotes(eventId, userId) {
  if (!eventId || !userId) return [];
  return unwrap(await supabase.from("pantalla_votes")
    .select("item_id,vote_type,weight").eq("event_id", eventId).eq("user_id", userId)) || [];
}

/** La fila propia del invitado (la RLS sólo deja leer la suya): rol y súper votos. */
export async function fetchMyParticipant(eventId, userId) {
  if (!eventId || !userId) return null;
  return unwrap(await supabase.from("pantalla_participants")
    .select("role,super_votes_used,extra_super_votes")
    .eq("event_id", eventId).eq("user_id", userId).maybeSingle());
}

export async function fetchParticipants(eventId) {
  if (!eventId) return [];
  return unwrap(await supabase.from("pantalla_participants")
    .select("id,user_id,role,super_votes_used,extra_super_votes,joined_at,last_seen_at")
    .eq("event_id", eventId).order("joined_at", { ascending: true })) || [];
}

export async function fetchHistory(eventId, client = supabase) {
  if (!eventId) return [];
  return unwrap(await client.from("pantalla_play_history").select("*")
    .eq("event_id", eventId).order("played_at", { ascending: false }).limit(50)) || [];
}

/** Todos los votos del evento. Sólo devuelve filas si quien pregunta es admin. */
export async function fetchAllVotes(eventId) {
  if (!eventId) return [];
  return unwrap(await supabase.from("pantalla_votes")
    .select("item_id,user_id,vote_type,weight").eq("event_id", eventId)) || [];
}

// ── Acciones del cliente (todas por RPC) ────────────────────────────────────

const rpc = async (fn, args, client = supabase) => {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
};

export const joinEvent   = (eventId) => rpc("pantalla_join_event", { _event_id: eventId });
export const heartbeat   = (eventId) => rpc("pantalla_heartbeat",  { _event_id: eventId });

export const castVote = (eventId, itemId, type) =>
  rpc("pantalla_cast_vote", { _event_id: eventId, _item_id: itemId, _type: type });

export const clearVote = (eventId, itemId, type) =>
  rpc("pantalla_clear_vote", { _event_id: eventId, _item_id: itemId, _type: type });

export const castSuperVote = (eventId, itemId, type = "super_up") =>
  rpc("pantalla_cast_super_vote", { _event_id: eventId, _item_id: itemId, _type: type });

// La TV también la consulta, y entra sin sesión: el cliente es un parámetro
// para que pueda pasar `supabaseAnon`. La RPC es SECURITY DEFINER y sin sesión
// devuelve lo mismo salvo `voted`, que sin `auth.uid()` es false.
export const getKickStatus  = (eventId, client = supabase) =>
  rpc("pantalla_get_kick_status", { _event_id: eventId }, client);
// `itemId`: la canción que el celular tenía en pantalla al tocar. Si ya cambió,
// el servidor no anota el voto (devuelve el estado nuevo con `stale: true`):
// así un voto que llega tarde no cae sobre la canción siguiente.
const conCancion = (args, itemId) => (itemId ? { ...args, _item_id: itemId } : args);
export const toggleKickVote = (eventId, itemId) =>
  rpc("pantalla_toggle_kick_vote", conCancion({ _event_id: eventId }, itemId));
/** Amor y Odio / Guns & Roses: el voto único del invitado, +1 (flor) o −1 (tomate / bala). */
export const votarKickFijo  = (eventId, value, itemId) =>
  rpc("pantalla_kick_voto_fijo", conCancion({ _event_id: eventId, _value: value }, itemId));

/** Única escritura directa del cliente. La RLS exige user_id = auth.uid(). */
export async function sendReaction(eventId, userId, emoji) {
  const { error } = await supabase.from("pantalla_reactions")
    .insert({ event_id: eventId, user_id: userId, emoji });
  if (error) throw new Error(error.message);
}

// ── Acciones de admin / DJ ──────────────────────────────────────────────────

export const createEvent    = (name, sessionId = null) =>
  rpc("pantalla_create_event", { _name: name, _session_id: sessionId });
/**
 * Poner la noche en vivo. Es el comienzo real de la jornada en la app, así que
 * además del RPC deja `game_state` en neutro: sin esto el evento arranca
 * limpio pero /tv sigue mostrando el juego con el que se cerró la noche
 * anterior (ver `services/jornada.js`).
 *
 * La limpieza no puede tumbar el arranque del evento: para cuando corre, el
 * RPC ya se ejecutó y el evento quedó en vivo. Si falla, se avisa por consola
 * y se sigue.
 */
export async function startEvent(eventId) {
  const res = await rpc("pantalla_start_event", { _event_id: eventId });
  try {
    await iniciarJornada();
  } catch (err) {
    console.warn("[pantallaDj] Evento iniciado, pero no se pudo limpiar la jornada:", err);
  }
  return res;
}

export const resetEvent  = (eventId) => rpc("pantalla_reset_event",  { _event_id: eventId });
export const resetVotes  = (eventId) => rpc("pantalla_reset_votes",  { _event_id: eventId });
export const resetPowers = (eventId) => rpc("pantalla_reset_vote_powers", { _event_id: eventId });

export const freezeVoting = (eventId, frozen) =>
  rpc("pantalla_freeze_voting", { _event_id: eventId, _frozen: frozen });

export const advanceEvent = (eventId, forceItemId = null, expectedCurrentId = null) =>
  rpc("pantalla_advance_event", {
    _event_id: eventId, _force_item_id: forceItemId, _expected_current_id: expectedCurrentId,
  });

// `pantalla_refill_candidates` es interna (sin EXECUTE público desde la
// migración 20261020050000); el panel usa la versión con chequeo de admin.
export const refillCandidates = (eventId) =>
  rpc("pantalla_refill_event", { _event_id: eventId });

export const addItems = (eventId, items) =>
  rpc("pantalla_add_items", { _event_id: eventId, _items: items });

export const importPlaylist = (eventId, playlistId) =>
  rpc("pantalla_import_playlist", { _event_id: eventId, _playlist_id: playlistId });

export const setParticipantRole = (eventId, userId, role) =>
  rpc("pantalla_set_participant_role", { _event_id: eventId, _user_id: userId, _role: role });

export const removeParticipant = (eventId, userId) =>
  rpc("pantalla_remove_participant", { _event_id: eventId, _user_id: userId });

export const getTvLink        = (eventId) => rpc("pantalla_get_tv_link",        { _event_id: eventId });
export const regenerateTvToken = (eventId) => rpc("pantalla_regenerate_tv_token", { _event_id: eventId });

/** Actualiza config del evento. La RLS sólo lo permite al admin/dueño. */
export async function updateEvent(eventId, patch) {
  const { error } = await supabase.from("pantalla_events").update(patch).eq("id", eventId);
  if (error) throw new Error(error.message);
}

/**
 * Guardado de configuración del evento con verificación de filas.
 *
 * Supabase no devuelve error cuando la RLS filtra el UPDATE: devuelve 0 filas
 * y `error === null`. Para el panel eso no es un guardado exitoso, así que se
 * pide `select()` y se convierte en error explícito.
 */
export async function saveEventFields(eventId, patch) {
  const { data, error } = await supabase
    .from("pantalla_events")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", eventId)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("rls_sin_filas");
  return data[0];
}

/** Misma verificación de filas, sobre un tema de la playlist. */
export async function saveItemFields(itemId, patch) {
  const { data, error } = await supabase
    .from("pantalla_playlist_items")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", itemId)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("rls_sin_filas");
  return data[0];
}

export async function updateItem(itemId, patch) {
  const { error } = await supabase.from("pantalla_playlist_items").update(patch).eq("id", itemId);
  if (error) throw new Error(error.message);
}

/**
 * Reordena la playlist: recibe la lista de ids en el orden nuevo y sube sólo
 * las filas cuya posición cambió. Va de a tandas para no abrir 400 requests
 * en paralelo con una playlist grande.
 */
export async function reorderItems(idsEnOrden, posicionActual) {
  const cambios = [];
  idsEnOrden.forEach((id, i) => {
    if (posicionActual.get(id) !== i + 1) cambios.push({ id, position: i + 1 });
  });
  for (let i = 0; i < cambios.length; i += 25) {
    await Promise.all(cambios.slice(i, i + 25).map(({ id, position }) =>
      supabase.from("pantalla_playlist_items").update({ position }).eq("id", id)
        .then(({ error }) => { if (error) throw new Error(error.message); })));
  }
  return cambios.length;
}

/** Borra varios temas de una. Devuelve cuántos se fueron de verdad. */
export async function deleteItems(ids) {
  if (!ids.length) return 0;
  const { data, error } = await supabase.from("pantalla_playlist_items")
    .delete().in("id", ids).select("id");
  if (error) throw new Error(error.message);
  return data?.length || 0;
}

/** Habilita o deshabilita varios temas de una. */
export async function setItemsEnabled(ids, enabled) {
  if (!ids.length) return 0;
  const { data, error } = await supabase.from("pantalla_playlist_items")
    .update({ enabled, updated_at: new Date().toISOString() }).in("id", ids).select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("rls_sin_filas");
  return data.length;
}

export async function deleteItem(itemId) {
  const { error } = await supabase.from("pantalla_playlist_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
}

export async function setVotePower(eventId, role, voteType, patch) {
  const { error } = await supabase.from("pantalla_vote_powers")
    .upsert({ event_id: eventId, role, vote_type: voteType, ...patch, updated_at: new Date().toISOString() },
            { onConflict: "event_id,role,vote_type" });
  if (error) throw new Error(error.message);
}

/**
 * Guarda varias celdas de la matriz de poderes de una sola vez.
 * Misma verificación de filas que `saveEventFields`: cero filas sin error es RLS.
 */
export async function saveVotePowers(eventId, rows) {
  if (!rows.length) return 0;
  const ahora = new Date().toISOString();
  const { data, error } = await supabase.from("pantalla_vote_powers")
    .upsert(
      rows.map((r) => ({
        event_id: eventId, role: r.role, vote_type: r.vote_type,
        enabled: r.enabled, value: r.value, updated_at: ahora,
      })),
      { onConflict: "event_id,role,vote_type" },
    )
    .select("role");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("rls_sin_filas");
  return data.length;
}

// ── TV (sin sesión, autorizada por token) ───────────────────────────────────

export const resolveTv = (code, token) =>
  rpc("pantalla_resolve_tv", { _code: code, _token: token }, supabaseAnon);

/** `itemId`: la canción de la que es el tiempo (el cierre de la votación no toma el de otra). */
export const tvReport = (eventId, token, currentTime, duration, itemId = null) =>
  rpc("pantalla_tv_report", {
    _event_id: eventId, _token: token,
    _current_time: currentTime ?? null, _duration: duration ?? null, _item_id: itemId,
  }, supabaseAnon);

/**
 * Latido de la TV: sólo marca que está abierta (`tv_connected_at`). Va aparte
 * del reporte de progreso, que se corta cuando no suena una canción del DJ
 * (juegos, escenario, placas) y dejaba la TV como inactiva en el Admin.
 */
export const tvLatido = (eventId, token) =>
  rpc("pantalla_tv_latido", { _event_id: eventId, _token: token }, supabaseAnon);

/** Latido de la Telepronter: sólo marca que está abierta. No toca la reproducción. */
export const telepronterReport = (eventId, token) =>
  rpc("pantalla_telepronter_report", { _event_id: eventId, _token: token }, supabaseAnon);

/**
 * Fin de la canción actual según la TV. `_item_id` no es informativo: viaja
 * como `_expected_current_id` al guard del servidor, así que un aviso atrasado
 * de la canción anterior no puede avanzar la que ya está sonando.
 * `_reason` distingue el final normal del salto por video no reproducible.
 */
/**
 * Terminó el video del participante de un juego de Escenario: la TV vuelve a
 * la convocatoria (baja al participante y cierra el turno). Idempotente.
 */
export const tvEscenarioVideoTerminado = (eventId, token, turnId) =>
  rpc("tv_escenario_video_terminado", {
    _event_id: eventId, _token: token, _turn_id: turnId,
  }, supabaseAnon);

/** La TV terminó de emitir una tanda publicitaria: suma una emisión al clip. */
export const tvTandaEmitida = (eventId, token, clipId) =>
  rpc("tv_tanda_emitida", {
    _event_id: eventId, _token: token, _clip_id: clipId,
  }, supabaseAnon);

/** Cola de tandas de un evento (lectura pública: la usa la TV, sin sesión). */
export async function tvTandas(eventId) {
  if (!eventId) return [];
  const { data, error } = await supabaseAnon.from("pantalla_ad_clips")
    .select("id,title,source_type,youtube_id,audio_path,duration_seconds,trim_start_seconds,trim_end_seconds,volume,position,enabled,times_played")
    .eq("event_id", eventId).order("position");
  if (error) throw new Error(error.message);
  return data || [];
}

export const tvSongEnded = (eventId, token, itemId, reason = "advance") =>
  rpc("pantalla_tv_song_ended", {
    _event_id: eventId, _token: token, _item_id: itemId, _reason: reason,
  }, supabaseAnon);

// ── Sets de canciones (migración 20261020110000_pantalla_sets) ──────────────
// Un set es un subconjunto con nombre de la playlist. Con un set activo, sólo
// sus canciones entran a la votación (lo aplica el servidor).

const FALTA_SETS = "Falta aplicar en Supabase la migración 20261020110000_pantalla_sets.";
const errSets = (error) => {
  const m = error?.message || String(error);
  return new Error(/pantalla_sets|pantalla_set_items|active_set_id|pantalla_activate_set|pantalla_set_category_rotation|category_rotation/.test(m)
    && /does not exist|could not find|schema cache/i.test(m) ? FALTA_SETS : m);
};

/** Sets del evento con los ids de sus canciones: [{ id, name, itemIds:Set }]. */
export async function fetchSets(eventId) {
  if (!eventId) return [];
  const { data, error } = await supabase.from("pantalla_sets")
    .select("id,name,created_at,pantalla_set_items(item_id)")
    .eq("event_id", eventId).order("created_at", { ascending: true });
  if (error) throw errSets(error);
  return (data || []).map((s) => ({
    id: s.id, name: s.name, created_at: s.created_at,
    itemIds: new Set((s.pantalla_set_items || []).map((x) => x.item_id)),
  }));
}

export async function createSet(eventId, name, itemIds) {
  const { data, error } = await supabase.from("pantalla_sets")
    .insert({ event_id: eventId, name: String(name).trim().slice(0, 60) }).select("id").single();
  if (error) throw errSets(error);
  if (itemIds.length) await addToSet(data.id, itemIds);
  return data.id;
}

export async function addToSet(setId, itemIds) {
  if (!itemIds.length) return 0;
  const { error } = await supabase.from("pantalla_set_items")
    .upsert(itemIds.map((item_id) => ({ set_id: setId, item_id })), { onConflict: "set_id,item_id", ignoreDuplicates: true });
  if (error) throw errSets(error);
  return itemIds.length;
}

export async function removeFromSet(setId, itemIds) {
  if (!itemIds.length) return 0;
  const { error } = await supabase.from("pantalla_set_items")
    .delete().eq("set_id", setId).in("item_id", itemIds);
  if (error) throw errSets(error);
  return itemIds.length;
}

export async function deleteSet(setId) {
  const { error } = await supabase.from("pantalla_sets").delete().eq("id", setId);
  if (error) throw errSets(error);
}

/** Activa un set (o ninguno con null). El servidor retira las candidatas de afuera. */
export async function activateSet(eventId, setId) {
  const { data, error } = await supabase.rpc("pantalla_activate_set", { _event_id: eventId, _set_id: setId });
  if (error) throw errSets(error);
  return data;
}

/**
 * Rotación por categorías: { enabled, rows: [{ slots, categories: ["A",…] }] }
 * (filas de lugares fijos en la ventana de candidatas). Guarda y re-completa la ventana.
 */
export async function saveCategoryRotation(eventId, rotation) {
  const { data, error } = await supabase.rpc("pantalla_set_category_rotation",
    { _event_id: eventId, _rotation: rotation });
  if (error) throw errSets(error);
  return data;
}
