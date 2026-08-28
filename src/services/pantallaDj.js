import { supabase, supabaseAnon } from "../lib/supabase";

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
  "trim_start_seconds,trim_end_seconds,youtube_volume,won_with_score";

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
    const [url, title, artist, start, end] = line.split("|").map((p) => p.trim());
    const youtube_id = extractYtId(url);
    if (!youtube_id) { errors.push(line); continue; }
    items.push({
      youtube_id,
      title:  title  || "",
      artist: artist || "",
      trim_start_seconds: Number(start) || 0,
      trim_end_seconds:   end ? String(Number(end) || "") : "",
    });
  }
  return { items, errors };
}

export const ytThumb  = (id) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
export const guestUrl = (code) => `${window.location.origin}/?pantallaCode=${code}`;
export const tvUrl    = (code, token) =>
  `${window.location.origin}/tv?code=${code}&key=${token}`;

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

export const getKickStatus  = (eventId) => rpc("pantalla_get_kick_status",  { _event_id: eventId });
export const toggleKickVote = (eventId) => rpc("pantalla_toggle_kick_vote", { _event_id: eventId });

/** Única escritura directa del cliente. La RLS exige user_id = auth.uid(). */
export async function sendReaction(eventId, userId, emoji) {
  const { error } = await supabase.from("pantalla_reactions")
    .insert({ event_id: eventId, user_id: userId, emoji });
  if (error) throw new Error(error.message);
}

// ── Acciones de admin / DJ ──────────────────────────────────────────────────

export const createEvent    = (name, sessionId = null) =>
  rpc("pantalla_create_event", { _name: name, _session_id: sessionId });
export const duplicateEvent = (eventId, name = null) =>
  rpc("pantalla_duplicate_event", { _event_id: eventId, _name: name });
export const startEvent  = (eventId) => rpc("pantalla_start_event",  { _event_id: eventId });
export const endEvent    = (eventId) => rpc("pantalla_end_event",    { _event_id: eventId });
export const resetEvent  = (eventId) => rpc("pantalla_reset_event",  { _event_id: eventId });
export const resetVotes  = (eventId) => rpc("pantalla_reset_votes",  { _event_id: eventId });
export const resetPowers = (eventId) => rpc("pantalla_reset_vote_powers", { _event_id: eventId });

export const freezeVoting = (eventId, frozen) =>
  rpc("pantalla_freeze_voting", { _event_id: eventId, _frozen: frozen });

export const advanceEvent = (eventId, forceItemId = null, expectedCurrentId = null) =>
  rpc("pantalla_advance_event", {
    _event_id: eventId, _force_item_id: forceItemId, _expected_current_id: expectedCurrentId,
  });

export const refillCandidates = (eventId) =>
  rpc("pantalla_refill_candidates", { _event_id: eventId });

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

export async function updateItem(itemId, patch) {
  const { error } = await supabase.from("pantalla_playlist_items").update(patch).eq("id", itemId);
  if (error) throw new Error(error.message);
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

// ── TV (sin sesión, autorizada por token) ───────────────────────────────────

export const resolveTv = (code, token) =>
  rpc("pantalla_resolve_tv", { _code: code, _token: token }, supabaseAnon);

export const tvReport = (eventId, token, currentTime, duration) =>
  rpc("pantalla_tv_report", {
    _event_id: eventId, _token: token,
    _current_time: currentTime ?? null, _duration: duration ?? null,
  }, supabaseAnon);

/**
 * Fin de la canción actual según la TV. `_item_id` no es informativo: viaja
 * como `_expected_current_id` al guard del servidor, así que un aviso atrasado
 * de la canción anterior no puede avanzar la que ya está sonando.
 * `_reason` distingue el final normal del salto por video no reproducible.
 */
export const tvSongEnded = (eventId, token, itemId, reason = "advance") =>
  rpc("pantalla_tv_song_ended", {
    _event_id: eventId, _token: token, _item_id: itemId, _reason: reason,
  }, supabaseAnon);
