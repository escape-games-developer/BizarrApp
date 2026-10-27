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
      .select("id, playlist_id, nombre, fuente, yt_id, url, storage_path, inicio_seg, fin_seg, created_at")
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

/**
 * Tiempo del recorte, como lo escribe el operador: «90», «1:30» o vacío.
 * Devuelve segundos, null si está vacío, o NaN si no se entiende.
 */
export function parseTiempo(texto) {
  const t = String(texto ?? "").trim();
  if (!t) return null;
  const m = t.match(/^(?:(\d+):)?(\d+)$/);
  if (!m) return NaN;
  const seg = Number(m[2]);
  if (m[1] != null && seg > 59) return NaN;
  return (m[1] != null ? Number(m[1]) * 60 : 0) + seg;
}
/** 90 → «1:30». */
export const formatoTiempo = (s) => (s == null ? "" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);

/** Valida «desde» y «hasta». → { inicio_seg, fin_seg } o tira con el motivo. */
export function recorteDesde(desde, hasta) {
  const ini = parseTiempo(desde), fin = parseTiempo(hasta);
  if (Number.isNaN(ini) || Number.isNaN(fin)) throw new Error("Los tiempos van en segundos (90) o minutos:segundos (1:30).");
  const inicio_seg = ini ?? 0;
  if (fin != null && fin <= inicio_seg) throw new Error("El final tiene que ser después del comienzo.");
  if (inicio_seg > 7200 || (fin ?? 0) > 7200) throw new Error("El recorte no puede pasar las 2 horas.");
  return { inicio_seg, fin_seg: fin };
}

export async function agregarYoutube(juego, items, playlistId = null, recorte = { inicio_seg: 0, fin_seg: null }) {
  if (!items.length) return;
  unwrap(await supabase.from("escenario_videos").insert(items.map(({ ytId, nombre }) => ({
    juego, playlist_id: playlistId, nombre, fuente: "youtube", yt_id: ytId, ...recorte,
  }))));
}

/** Sube un MP4/WebM y lo registra en la biblioteca. */
export async function subirArchivo(juego, file, { nombre, playlistId = null, recorte = { inicio_seg: 0, fin_seg: null } } = {}) {
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
    juego, playlist_id: playlistId, fuente: "archivo", url, storage_path: path, ...recorte,
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

/**
 * El nombre de un video es «Tema | Artista» (así lo cargan con el formato
 * «Link | Tema | Artista» y así lo muestran la TV y el celular). Para editarlo
 * se separa en los dos campos y se vuelve a unir igual.
 */
export function separarNombre(nombre) {
  const [tema, ...resto] = String(nombre || "").split("|");
  return { tema: tema.trim(), artista: resto.join("|").trim() };
}
export const unirNombre = (tema, artista) =>
  [String(tema || "").trim(), String(artista || "").trim()].filter(Boolean).join(" | ");

/**
 * Edición desde el lápiz: nombre (tema + artista), playlist y, si es de
 * YouTube, el link. Un archivo subido no cambia de link: se borra y se sube otro.
 */
export async function editarVideo(video, { tema, artista, link, playlistId, desde, hasta }) {
  const nombre = unirNombre(tema, artista);
  if (!String(tema || "").trim()) throw new Error("Poné el nombre del tema.");
  if (nombre.length > 120) throw new Error("Tema y artista juntos no pueden pasar los 120 caracteres.");
  const cambios = { nombre, playlist_id: playlistId || null, ...recorteDesde(desde, hasta) };
  if (video.fuente === "youtube") {
    const ytId = extractYtId(link);
    if (!ytId) throw new Error("Ese link no es un video de YouTube válido.");
    cambios.yt_id = ytId;
  }
  unwrap(await supabase.from("escenario_videos").update(cambios).eq("id", video.id));
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
 * del DJ. trimStart / trimEnd = el recorte del tema (desde / hasta, en segundos).
 */
export function videoParaEscenario(v) {
  const trimStart = v.inicio_seg || 0, trimEnd = v.fin_seg ?? null;
  return v.fuente === "archivo"
    ? { fuente: "archivo", url: v.url, ytTitle: v.nombre, trimStart, trimEnd, videoId: v.id }
    : { fuente: "youtube", ytId: v.yt_id, ytTitle: v.nombre, trimStart, trimEnd, videoId: v.id };
}
