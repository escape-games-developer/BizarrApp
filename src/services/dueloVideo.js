import { supabase } from "../lib/supabase";

/**
 * Subida del video del Duelo a Storage.
 *
 * Reusa la infraestructura de video que YA existe: el bucket público
 * `videos-locales`, el mismo que usa `useVideoRequests.uploadLocal` para los
 * MP4 que el DJ sube a la cola de Pantalla. No usamos `bizarren-media` (la
 * biblioteca de imágenes de MediaUploader / mediaAssets.js) porque ese bucket
 * está declarado con `allowed_mime_types = image/png|jpeg|webp` y 10 MB de
 * tope: un MP4 lo rechaza el propio Storage.
 *
 * Acá NO se toca `video_requests`: `uploadLocal` además inserta un pedido y lo
 * auto-lanza en la cola del DJ, que no es lo que queremos para el Duelo. Esto
 * sube el archivo y devuelve su URL pública, nada más.
 *
 * La URL pública es la clave del requisito: /tv suele correr en OTRA máquina,
 * así que un `blob:` o una ruta local del Windows del operador no se puede
 * reproducir del otro lado.
 */

export const DUELO_VIDEO_BUCKET = "videos-locales";

/** Formatos que ya acepta el bucket hoy (mismo criterio que la carga del DJ). */
export const ALLOWED_VIDEO_MIME = ["video/mp4", "video/webm"];
export const ALLOWED_VIDEO_LABEL = "MP4 o WebM";

/** 100 MB — mismo tope que usa la carga local de Pantalla. */
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export function formatMB(bytes) {
  return `${((bytes || 0) / 1024 / 1024).toFixed(1)} MB`;
}

/** Valida tipo y tamaño antes de tocar la red. @returns {string|null} error */
export function validateVideoFile(file) {
  if (!file) return "No se seleccionó ningún archivo.";
  if (!ALLOWED_VIDEO_MIME.includes(file.type)) {
    return `Formato no permitido (${file.type || "desconocido"}). Sólo ${ALLOWED_VIDEO_LABEL}.`;
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return `El archivo pesa ${formatMB(file.size)}. El máximo es ${formatMB(MAX_VIDEO_BYTES)}.`;
  }
  return null;
}

/**
 * Sube el archivo y devuelve la URL pública persistente.
 *
 * El path arranca con `${sessionId}/`, igual que la carga local del DJ: es la
 * forma de path que las policies del bucket ya aceptan en producción. El
 * prefijo `duelo_` en el nombre lo distingue de los videos de la cola.
 *
 * @param {File} file
 * @param {{ sessionId: string }} opts
 * @returns {Promise<{ url: string, path: string, name: string }>}
 */
export async function uploadDueloVideo(file, { sessionId } = {}) {
  const invalid = validateVideoFile(file);
  if (invalid) throw new Error(invalid);
  if (!sessionId) throw new Error("Sin sesión activa: no se puede subir el video.");

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Sesión expirada. Volvé a iniciar sesión para subir el video.");

  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const path = `${sessionId}/duelo_${Date.now()}_${safeName}`;

  const { error: upErr } = await supabase.storage
    .from(DUELO_VIDEO_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
  if (upErr) throw new Error(`No se pudo subir el video: ${upErr.message}`);

  const { data } = supabase.storage.from(DUELO_VIDEO_BUCKET).getPublicUrl(path);
  const url = data?.publicUrl;
  if (!url) {
    await supabase.storage.from(DUELO_VIDEO_BUCKET).remove([path]);
    throw new Error("El archivo se subió pero no se pudo resolver su URL pública.");
  }
  return { url, path, name: file.name };
}
