import { supabase } from "../lib/supabase";

/**
 * Tandas publicitarias del DJ: lo que necesita la sección del Editor además
 * del CRUD de `pantalla_ad_clips` (ver pantallaConfig.js).
 *
 *   datosDeYoutube(ytId)  → { title, durationSeconds } del video, o null
 *   subirMp3(eventId, f)  → { audioPath, title, durationSeconds } (bucket tandas-audio)
 *   urlDeAudio(path)      → URL pública del MP3, para reproducirlo
 */

export const AUDIO_BUCKET = "tandas-audio";
export const MP3_MAX_BYTES = 20 * 1024 * 1024;   // mismo límite que el bucket

const YT_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

/** "PT1M32S" → 92 */
function segundosIso(iso) {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || "");
  if (!m) return null;
  return (Number(m[1]) || 0) * 3600 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0);
}

/**
 * Título y duración del video con la API de YouTube. Sin API key, o si falla,
 * devuelve null y quien llama usa un título genérico: no se pierde el clip.
 */
export async function datosDeYoutube(ytId) {
  if (!YT_KEY || !ytId) return null;
  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "snippet,contentDetails");
    url.searchParams.set("id", ytId);
    url.searchParams.set("key", YT_KEY);
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const item = (await res.json()).items?.[0];
    if (!item) return null;
    return { title: item.snippet?.title || null, durationSeconds: segundosIso(item.contentDetails?.duration) };
  } catch {
    return null;
  }
}

/** Duración real del MP3, leída en el navegador. null si no se pudo. */
function duracionDe(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const fin = (v) => { URL.revokeObjectURL(url); resolve(v); };
    audio.onloadedmetadata = () => fin(Number.isFinite(audio.duration) ? Math.round(audio.duration) : null);
    audio.onerror = () => fin(null);
    audio.src = url;
  });
}

const esMp3 = (file) => file?.type === "audio/mpeg" || file?.type === "audio/mp3"
  || /\.mp3$/i.test(file?.name || "");

/** Sube un MP3 de tanda. Tira con un mensaje legible si no se puede. */
export async function subirMp3(eventId, file) {
  if (!esMp3(file)) throw new Error(`"${file?.name}" no es un MP3.`);
  if (file.size > MP3_MAX_BYTES) throw new Error(`"${file.name}" pesa más de 20 MB.`);

  const base = file.name.replace(/\.[^.]+$/, "");
  const slug = base.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "tanda";
  const audioPath = `${eventId}/${Date.now().toString(36)}-${slug}.mp3`;

  const { error } = await supabase.storage.from(AUDIO_BUCKET)
    .upload(audioPath, file, { cacheControl: "31536000", upsert: false, contentType: "audio/mpeg" });
  if (error) {
    throw new Error(/bucket not found/i.test(error.message)
      ? "Falta crear en Supabase el bucket de audio de las tandas (migración 20261023140100_tandas_audio_bucket)."
      : `No se pudo subir "${file.name}": ${error.message}`);
  }
  return { audioPath, title: base.replace(/[_-]+/g, " ").trim(), durationSeconds: await duracionDe(file) };
}

export function urlDeAudio(audioPath) {
  if (!audioPath) return null;
  return supabase.storage.from(AUDIO_BUCKET).getPublicUrl(audioPath).data?.publicUrl || null;
}

/** Borra el MP3 de un clip que se elimina. Si falla, queda huérfano: no bloquea. */
export async function borrarMp3(audioPath) {
  if (!audioPath) return;
  const { error } = await supabase.storage.from(AUDIO_BUCKET).remove([audioPath]);
  if (error) console.warn("[tandas] no se pudo borrar el MP3:", error.message);
}
