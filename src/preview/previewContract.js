/**
 * Contrato entre el Diseñador Cliente (Admin) y la ruta de preview del Cliente
 * que vive dentro de su iframe. Sin imports a propósito: lo carga main.jsx
 * antes de decidir qué ruta montar, y no puede arrastrar nada más.
 *
 * Mensajes (postMessage, mismo origen, `{ type, version, kind, … }`):
 *
 *   Admin → iframe
 *     kind "native"    { section, rendererKey }           renderer nativo registrado
 *     kind "document"  { document, fixtureId?, selectedId? }  DesignDocument por el motor
 *   iframe → Admin
 *     kind "node-selected" { nodeId }                      click sobre un nodo del documento
 *
 * La carga inicial usa la query (`buildClientPreviewUrl`); todo cambio
 * posterior viaja por mensaje, sin recargar. Ambos lados validan forma,
 * origen y ventana emisora; el iframe valida además el documento completo.
 */

export const CLIENT_PREVIEW_PATH = "/designer-preview/client";
export const PREVIEW_MESSAGE_TYPE = "bizarrapp-designer-preview";
export const PREVIEW_PROTOCOL_VERSION = 2;

/** Texto que devuelven las acciones inertes del preview. */
export const PREVIEW_ACTION_DISABLED = "Vista previa: esta acción está deshabilitada.";

/**
 * Coincidencia exacta (con o sin "/" final): `/designer-preview/client/home`
 * es otra ruta (ClientHomePreview del Designer existente) y no entra acá.
 */
export function isClientPreviewPath(pathname) {
  return pathname === CLIENT_PREVIEW_PATH || pathname === CLIENT_PREVIEW_PATH + "/";
}

/** URL inicial del iframe. `request` = { kind:"native", section, rendererKey } | { kind:"document", sceneId }. */
export function buildClientPreviewUrl(request) {
  const q = request.kind === "document"
    ? new URLSearchParams({ mode: "document", scene: request.sceneId })
    : new URLSearchParams({ section: request.section, renderer: request.rendererKey });
  return `${CLIENT_PREVIEW_PATH}?${q}`;
}

export function previewMessage(kind, payload) {
  return { type: PREVIEW_MESSAGE_TYPE, version: PREVIEW_PROTOCOL_VERSION, kind, ...payload };
}

/** ¿Es un mensaje del protocolo, del mismo origen y de la ventana esperada? */
export function isPreviewMessage(event, expectedSource) {
  const d = event.data;
  return event.origin === window.location.origin && event.source === expectedSource &&
    !!d && d.type === PREVIEW_MESSAGE_TYPE && d.version === PREVIEW_PROTOCOL_VERSION && typeof d.kind === "string";
}
