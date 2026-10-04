/**
 * Registro del motor: componentes, bindings, acciones, escenas y presets de
 * tema. Se arma componiendo módulos (básicos + dominios). No hay estado global
 * mutable: cada contexto (Cliente, preview, tests) arma o recibe su registro.
 *
 * Valida al crearse que las escenas sólo referencien claves registradas.
 */
function indexar(lista, tipo) {
  const map = new Map();
  for (const item of lista) {
    if (!item?.key && !item?.id) throw new Error(`[design-registry] ${tipo} sin clave`);
    const k = item.key ?? item.id;
    if (map.has(k)) throw new Error(`[design-registry] ${tipo} duplicado: ${k}`);
    map.set(k, Object.freeze({ ...item }));
  }
  return map;
}

export function createDesignRegistry({ components = [], bindings = [], actions = [], scenes = [], presets = {} } = {}) {
  const comps = indexar(components, "componente");
  const binds = indexar(bindings, "binding");
  const acts  = indexar(actions, "acción");
  const scns  = indexar(scenes, "escena");

  for (const s of scns.values()) {
    for (const k of s.allowedComponents ?? []) if (!comps.has(k)) throw new Error(`[design-registry] ${s.id}: componente desconocido ${k}`);
    for (const k of s.bindings ?? [])          if (!binds.has(k)) throw new Error(`[design-registry] ${s.id}: binding desconocido ${k}`);
    for (const k of s.actions ?? [])           if (!acts.has(k))  throw new Error(`[design-registry] ${s.id}: acción desconocida ${k}`);
  }
  for (const c of comps.values()) {
    if (c.binding && !binds.has(c.binding)) throw new Error(`[design-registry] ${c.key}: binding desconocido ${c.binding}`);
    for (const b of Object.values(c.inputs ?? {})) if (!binds.has(b)) throw new Error(`[design-registry] ${c.key}: binding desconocido ${b}`);
    if (c.action && !acts.has(c.action)) throw new Error(`[design-registry] ${c.key}: acción desconocida ${c.action}`);
    if (c.primitive === "custom" && typeof c.render !== "function") throw new Error(`[design-registry] ${c.key}: custom sin render`);
  }

  const presetMap = new Map(Object.entries(presets));
  return Object.freeze({
    component: (k) => comps.get(k) ?? null,
    binding:   (k) => binds.get(k) ?? null,
    action:    (k) => acts.get(k) ?? null,
    scene:     (id) => scns.get(id) ?? null,
    preset:    (k) => presetMap.get(k) ?? null,
    scenes:    () => [...scns.values()],
    scenesForSection: (section) => [...scns.values()].filter((s) => s.section === section),
    componentsForScene: (id) => (scns.get(id)?.allowedComponents ?? []).map((k) => comps.get(k)),
  });
}
