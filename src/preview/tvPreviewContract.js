/**
 * Contrato entre el Diseño de juegos (Admin) y la vista previa de la TV que
 * vive en su iframe. Sin imports a propósito: lo carga main.jsx antes de
 * decidir qué ruta montar, y no puede arrastrar nada más.
 *
 * El iframe dibuja las MISMAS pantallas que /tv con datos de ejemplo. Lee la
 * configuración pública como la TV (src/lib/supabase.js arranca sin sesión
 * en /designer-preview/*, así no toca la del Admin):
 *
 *   Admin → iframe   kind "render" { escena }
 *   iframe → Admin   kind "ready"  {}   (ya escucha; el Admin reenvía la escena)
 *
 * `escena` = {
 *   juego:  'rey'|'trivia'|'suma'|'palabra'|'duelo'|'ftl'|'pt',
 *   vista:  'convocatoria'|'listo'|'performance',
 *   estado: id del estado dentro de la vista (p. ej. 'ganador'), opcional,
 *   rev:    sube con cada guardado del Admin → el iframe relee la config ya,
 *   listo, qr, logo: sólo FTL / PT, la config que el Admin tiene en memoria,
 * }
 */

export const TV_PREVIEW_PATH = "/designer-preview/tv";
export const TV_PREVIEW_MESSAGE_TYPE = "bizarrapp-tv-preview";
export const TV_PREVIEW_PROTOCOL_VERSION = 1;

/** Coincidencia exacta, con o sin "/" final. */
export function isTvPreviewPath(pathname) {
  return pathname === TV_PREVIEW_PATH || pathname === TV_PREVIEW_PATH + "/";
}

export function tvPreviewMessage(kind, payload) {
  return { type: TV_PREVIEW_MESSAGE_TYPE, version: TV_PREVIEW_PROTOCOL_VERSION, kind, ...payload };
}

/** ¿Es un mensaje del protocolo, del mismo origen y de la ventana esperada? */
export function isTvPreviewMessage(event, expectedSource) {
  const d = event.data;
  return event.origin === window.location.origin && event.source === expectedSource &&
    !!d && d.type === TV_PREVIEW_MESSAGE_TYPE && d.version === TV_PREVIEW_PROTOCOL_VERSION &&
    typeof d.kind === "string";
}
