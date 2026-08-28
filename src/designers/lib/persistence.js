import { cloneConfig, DEFAULT_GUEST_CONFIG, DEFAULT_TV_CONFIG } from "../defaults";

const KEY_TV = "bizarr-tv-canvas-config";
const KEY_GUEST = "bizarr-guest-canvas-config";
const key = (base, sessionId) => `${base}:${sessionId || "default"}`;

function load(base, sessionId, fallback) {
  try {
    const value = localStorage.getItem(key(base, sessionId));
    return value ? JSON.parse(value) : cloneConfig(fallback);
  } catch {
    return cloneConfig(fallback);
  }
}

/**
 * Completa los campos que una config vieja puede no traer.
 *
 * Se exporta porque ahora el diseño también puede venir de
 * `pantalla_events.tv_canvas_config`, y esa hay que normalizarla igual que la
 * que sale de localStorage.
 */
export function normalizeTvConfig(loaded) {
  const normalizeBlocks = blocks => Object.fromEntries(Object.entries(blocks || {}).map(([id, block]) => [id, {
    ...block,
    border: { enabled: false, ...block.border },
    content: { text: "", textPosition: "bottom", textSize: 16, textColor: "#ffffff", bold: true, ...block.content },
  }]));
  return { ...loaded, blocks: normalizeBlocks(loaded.blocks), customBlocks: normalizeBlocks(loaded.customBlocks) };
}

export function loadTvConfig(sessionId) {
  return normalizeTvConfig(load(KEY_TV, sessionId, DEFAULT_TV_CONFIG));
}
function save(base, sessionId, config) {
  try {
    localStorage.setItem(key(base, sessionId), JSON.stringify(config));
    return { ok: true };
  } catch (error) {
    const quotaExceeded = error?.name === "QuotaExceededError" || error?.name === "NS_ERROR_DOM_QUOTA_REACHED" || error?.code === 22 || error?.code === 1014;
    return { ok: false, error: quotaExceeded ? "quota" : "storage", cause: error };
  }
}

export function saveTvConfig(sessionId, config) {
  const result = save(KEY_TV, sessionId, config);
  if (result.ok) window.dispatchEvent(new CustomEvent("bizarr-tv-config-saved", { detail: { sessionId } }));
  return result;
}
export function resetTvConfig(sessionId) {
  const config = cloneConfig(DEFAULT_TV_CONFIG);
  const result = save(KEY_TV, sessionId, config);
  if (result.ok) window.dispatchEvent(new CustomEvent("bizarr-tv-config-saved", { detail: { sessionId } }));
  return { ...result, config };
}
export function loadGuestConfig(sessionId) { return load(KEY_GUEST, sessionId, DEFAULT_GUEST_CONFIG); }
export function saveGuestConfig(sessionId, config) { return save(KEY_GUEST, sessionId, config); }
export function resetGuestConfig(sessionId) {
  const config = cloneConfig(DEFAULT_GUEST_CONFIG);
  return { ...save(KEY_GUEST, sessionId, config), config };
}
