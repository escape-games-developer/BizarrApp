import {
  DOCUMENT_VERSION, NODE_KEYS, STYLE_KEYS, LAYOUT_DIRECTIONS, LAYOUT_ALIGN, LAYOUT_JUSTIFY,
  WIDTH_MODES, HEIGHT_MODES, TEXT_TAGS, IMAGE_FITS, FONT_FAMILIES,
} from "./contracts";

/**
 * Valida un DesignDocument contra el registro y su escena. Se usa en el editor
 * y, sobre todo, en el iframe de preview: lo que llega por postMessage es una
 * entrada no confiable.
 *
 * @returns {{ ok: boolean, errors: string[] }}
 */
const ID_RE = /^[A-Za-z][\w-]{0,63}$/;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
// Valores de estilo en texto: nada que pueda cargar recursos o romper el CSS.
const SAFE_CSS_TEXT = /^[^<>;{}\\]*$/;
const unsafeCss = (v) => typeof v === "string" && (!SAFE_CSS_TEXT.test(v) || /url\s*\(|expression\s*\(|@import/i.test(v));

export function validateDocument(doc, registry) {
  const errors = [];
  const err = (m) => errors.push(m);
  if (!doc || typeof doc !== "object") return { ok: false, errors: ["documento inválido"] };
  if (doc.version !== DOCUMENT_VERSION) err(`versión ${doc.version} no soportada`);
  const scene = registry.scene(doc.scene);
  if (!scene) return { ok: false, errors: [...errors, `escena desconocida: ${doc.scene}`] };
  if (!doc.root || doc.root.component !== "container") err("root debe ser un contenedor");

  const allowed = new Set(scene.allowedComponents);
  const sceneBindings = new Set(scene.bindings);
  const sceneActions = new Set(scene.actions);
  const ids = new Set();

  // Binding válido en el alcance: de la escena, o campo de un ítem de repeat abierto.
  const bindingOk = (key, items) => {
    if (sceneBindings.has(key)) return true;
    const dot = typeof key === "string" ? key.indexOf(".") : -1;
    if (dot <= 0) return false;
    const list = items[key.slice(0, dot)];
    return !!list && Object.hasOwn(list.itemFields ?? {}, key.slice(dot + 1));
  };
  const checkCondition = (c, where, items) => {
    if (c == null) return;
    if (typeof c !== "object" || !bindingOk(c.binding, items)) err(`${where}: condición con binding inválido`);
    for (const k of Object.keys(c)) if (!["binding", "equals", "negate"].includes(k)) err(`${where}: campo de condición desconocido ${k}`);
  };
  const checkStyle = (s, where) => {
    if (s == null) return;
    if (typeof s !== "object") return err(`${where}: style inválido`);
    for (const [k, v] of Object.entries(s)) {
      if (!STYLE_KEYS.includes(k)) err(`${where}: propiedad de estilo no permitida ${k}`);
      else if (typeof v === "string" ? unsafeCss(v) : !isNum(v)) err(`${where}: valor no permitido en ${k}`);
    }
    if (s.fontFamily != null && !FONT_FAMILIES.includes(s.fontFamily)) err(`${where}: fontFamily desconocida`);
  };
  const checkSides = (a, where) => {
    if (a != null && !(Array.isArray(a) && a.length === 4 && a.every(isNum))) err(`${where}: debe ser [t,r,b,l] numérico`);
  };

  const visit = (node, items) => {
    if (!node || typeof node !== "object") return err("nodo inválido");
    const where = `nodo ${node.id ?? "?"}`;
    for (const k of Object.keys(node)) if (!NODE_KEYS.includes(k)) err(`${where}: campo desconocido ${k}`);
    if (!ID_RE.test(node.id ?? "")) err(`${where}: id inválido`);
    else if (ids.has(node.id)) err(`${where}: id duplicado`);
    else ids.add(node.id);

    const def = registry.component(node.component);
    if (!def) return err(`${where}: componente desconocido ${node.component}`);
    if (!allowed.has(node.component)) err(`${where}: ${node.component} no está permitido en ${scene.id}`);
    for (const k of [def.binding, ...Object.values(def.inputs ?? {})].filter(Boolean)) {
      if (!sceneBindings.has(k)) err(`${where}: la escena no provee el dato ${k}`);
    }
    if (def.action && !sceneActions.has(def.action)) err(`${where}: la escena no provee la acción ${def.action}`);

    // repeat abre el alcance del ítem para el propio nodo y sus hijos
    let scoped = items;
    if (node.repeat != null) {
      const b = registry.binding(node.repeat.binding);
      if (!b || b.type !== "list" || !sceneBindings.has(b.key)) err(`${where}: repeat sin lista válida`);
      else scoped = { ...items, [node.repeat.as ?? "item"]: b };
    }

    if (node.children != null) {
      if (!def.acceptsChildren) err(`${where}: ${node.component} no acepta hijos`);
      else if (!Array.isArray(node.children)) err(`${where}: children inválido`);
    }
    const l = node.layout;
    if (l != null) {
      if (def.primitive !== "container" && def.primitive !== "button") err(`${where}: layout sólo en contenedores y botones`);
      if (!LAYOUT_DIRECTIONS.includes(l.direction)) err(`${where}: direction inválida`);
      if (l.align != null && !LAYOUT_ALIGN.includes(l.align)) err(`${where}: align inválido`);
      if (l.justify != null && !LAYOUT_JUSTIFY.includes(l.justify)) err(`${where}: justify inválido`);
      if (l.gap != null && !isNum(l.gap)) err(`${where}: gap inválido`);
    }
    const b = node.box;
    if (b != null) {
      if (b.width != null && !WIDTH_MODES.includes(b.width.mode)) err(`${where}: width.mode inválido`);
      if (b.height != null && !HEIGHT_MODES.includes(b.height.mode)) err(`${where}: height.mode inválido`);
      for (const k of ["minWidth", "maxWidth", "minHeight", "maxHeight"]) if (b[k] != null && !isNum(b[k])) err(`${where}: ${k} inválido`);
      checkSides(b.padding, `${where} padding`); checkSides(b.margin, `${where} margin`);
    }
    checkStyle(node.style, where);
    if (node.preset != null && !registry.preset(node.preset)) err(`${where}: preset desconocido ${node.preset}`);

    const p = node.props ?? {};
    for (const k of ["text", "label", "prefix", "suffix", "fallback", "alt"]) if (p[k] != null && typeof p[k] !== "string") err(`${where}: ${k} debe ser texto`);
    if (p.tag != null && !TEXT_TAGS.includes(p.tag)) err(`${where}: tag no permitido`);
    if (p.fit != null && !IMAGE_FITS.includes(p.fit)) err(`${where}: fit inválido`);
    if (p.src != null && (typeof p.src !== "string" || /^\s*(javascript|data:text)/i.test(p.src))) err(`${where}: src no permitido`);

    // binding/acción: los de sistema vienen de la definición; el documento no puede cambiarlos
    if (node.binding != null) {
      if (def.kind === "system") err(`${where}: un componente de sistema no acepta binding en el documento`);
      else if (!bindingOk(node.binding, scoped)) err(`${where}: binding no disponible ${node.binding}`);
    }
    if (node.action != null) {
      if (def.kind === "system") err(`${where}: un componente de sistema no acepta acción en el documento`);
      else if (def.primitive !== "button" || !sceneActions.has(node.action)) err(`${where}: acción no disponible ${node.action}`);
    }
    checkCondition(node.visibleWhen, `${where} visibleWhen`, scoped);
    checkCondition(node.disabledWhen, `${where} disabledWhen`, scoped);
    for (const [i, v] of (node.variants ?? []).entries()) {
      checkCondition(v?.when, `${where} variante ${i}`, scoped);
      checkStyle(v?.style, `${where} variante ${i}`);
    }
    for (const c of node.children ?? []) visit(c, scoped);
  };
  if (doc.root) visit(doc.root, {});
  return { ok: errors.length === 0, errors };
}
