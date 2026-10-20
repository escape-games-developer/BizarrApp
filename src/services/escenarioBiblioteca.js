import { supabase } from "../lib/supabase";
import { extractYtId } from "./pantallaDj";
import { DUELO_VIDEO_BUCKET, validateVideoFile } from "./dueloVideo";

/**
 * Biblioteca de videos de los juegos de Escenario (Follow the Leader / PT).
 * Tablas: escenario_playlists, escenario_videos (migración 20261019120000).
 *
 * Los archivos van al bucket público `videos-locales`, el mismo del Duelo y de
 * la cola del DJ: la TV corre en otra máquina y necesita una URL pública.
 */

const unwrap = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

/**
 * Parsea el textarea del operador, mismo formato que DJ Democracy:
 *   URL | Nombre      (una por línea; sin nombre usa el id del video)
 * Devuelve { validos: [{ ytId, nombre }], invalidas: [línea] }.
 */
export function parseLineasYoutube(texto) {
  const validos = [], invalidas = [];
  // Link sin nombre en su línea (p. ej. "URL |" y el nombre abajo): la línea
  // siguiente sin link se toma como su nombre.
  let esperaNombre = null;
  for (const cruda of String(texto || "").split("\n")) {
    const linea = cruda.trim();
    if (!linea) continue;
    const [link, ...resto] = linea.split("|");
    const ytId = extractYtId(link);
    if (!ytId) {
      if (esperaNombre) { esperaNombre.nombre = linea.replace(/^\|\s*/, "").slice(0, 120); esperaNombre = null; }
      else invalidas.push(linea);
      continue;
    }
    const nombre = resto.join("|").trim();
    const item = { ytId, nombre: (nombre || ytId).slice(0, 120) };
    validos.push(item);
    esperaNombre = nombre ? null : item;
  }
  return { validos, invalidas };
}

export async function listarBiblioteca(juego) {
  const [playlists, videos] = await Promise.all([
    supabase.from("escenario_playlists").select("id, nombre, created_at")
      .eq("juego", juego).order("created_at", { ascending: true }).then(unwrap),
    supabase.from("escenario_videos")
      .select("id, playlist_id, nombre, fuente, yt_id, url, storage_path, created_at")
      .eq("juego", juego).order("created_at", { ascending: true }).then(unwrap),
  ]);
  return { playlists: playlists || [], videos: videos || [] };
}

export async function crearPlaylist(juego, nombre) {
  const n = String(nombre || "").trim();
  if (!n) throw new Error("Poné un nombre para la playlist.");
  return unwrap(await supabase.from("escenario_playlists")
    .insert({ juego, nombre: n.slice(0, 80) }).select("id").single());
}

/** Borra la playlist; sus videos quedan "Sin playlist" (FK on delete set null). */
export async function borrarPlaylist(id) {
  unwrap(await supabase.from("escenario_playlists").delete().eq("id", id));
}

export async function agregarYoutube(juego, items, playlistId = null) {
  if (!items.length) return;
  unwrap(await supabase.from("escenario_videos").insert(items.map(({ ytId, nombre }) => ({
    juego, playlist_id: playlistId, nombre, fuente: "youtube", yt_id: ytId,
  }))));
}

/** Sube un MP4/WebM y lo registra en la biblioteca. */
export async function subirArchivo(juego, file, { nombre, playlistId = null } = {}) {
  const invalido = validateVideoFile(file);
  if (invalido) throw new Error(invalido);

  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const path = `escenario/${juego}/${Date.now()}_${safeName}`;
  const { error: upErr } = await supabase.storage.from(DUELO_VIDEO_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
  if (upErr) {
    const sinPermiso = String(upErr.statusCode) === "403"
      || /row-level security|unauthorized|not allowed/i.test(upErr.message || "");
    throw new Error(sinPermiso
      ? "Tu usuario no tiene permiso para subir videos. Sólo el staff puede hacerlo."
      : `No se pudo subir el video: ${upErr.message}`);
  }
  const url = supabase.storage.from(DUELO_VIDEO_BUCKET).getPublicUrl(path).data?.publicUrl;

  const { error } = await supabase.from("escenario_videos").insert({
    juego, playlist_id: playlistId, fuente: "archivo", url, storage_path: path,
    nombre: (String(nombre || "").trim() || file.name.replace(/\.[^.]+$/, "")).slice(0, 120),
  });
  if (error) {
    // Sin fila no tiene sentido dejar el archivo huérfano en Storage.
    await supabase.storage.from(DUELO_VIDEO_BUCKET).remove([path]);
    throw new Error(error.message);
  }
}

export async function moverVideo(id, playlistId) {
  unwrap(await supabase.from("escenario_videos").update({ playlist_id: playlistId || null }).eq("id", id));
}

export async function borrarVideo(video) {
  unwrap(await supabase.from("escenario_videos").delete().eq("id", video.id));
  if (video.storage_path) {
    // Si falla el borrado del archivo, la biblioteca ya quedó bien: no se corta.
    await supabase.storage.from(DUELO_VIDEO_BUCKET).remove([video.storage_path]);
  }
}

/**
 * Forma que viaja en game_state.escenario_video. `ytTitle` es el nombre para
 * todas las fuentes: lo leen el celular y /pantalla. Un archivo lleva `url`
 * y lo reproduce /tv con un <video>; YouTube lleva `ytId` y usa los players
 * del DJ. Los videos de la biblioteca no tienen recorte.
 */
export function videoParaEscenario(v) {
  return v.fuente === "archivo"
    ? { fuente: "archivo", url: v.url, ytTitle: v.nombre, videoId: v.id }
    : { fuente: "youtube", ytId: v.yt_id, ytTitle: v.nombre, trimStart: 0, trimEnd: null, videoId: v.id };
}
