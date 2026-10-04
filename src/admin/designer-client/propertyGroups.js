/**
 * Campos del panel de propiedades por capability (ver CAPABILITIES en
 * design-engine/contracts.js). El panel muestra un grupo sólo si la definición
 * del componente lo declara: no hay casos especiales por componente.
 *
 * `fields(node, def, ctx)` devuelve los campos del grupo para ese nodo.
 * Campo: { path, label, control, options?, step? }  — path relativo al nodo.
 */
const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const AUTO = ["", "—"];

export const PROPERTY_GROUPS = [
  { capability: "layout", label: "Disposición", fields: () => [
    { path: "layout.direction", label: "Dirección", control: "select", options: opt([["column", "Columna"], ["row", "Fila"]]) },
    { path: "layout.align", label: "Alinear", control: "select", options: opt([AUTO, ["start", "Inicio"], ["center", "Centro"], ["end", "Fin"], ["stretch", "Estirar"]]) },
    { path: "layout.justify", label: "Distribuir", control: "select", options: opt([AUTO, ["start", "Inicio"], ["center", "Centro"], ["end", "Fin"], ["between", "Entre"], ["around", "Alrededor"]]) },
    { path: "layout.gap", label: "Separación", control: "number" },
    { path: "layout.wrap", label: "Varias líneas", control: "checkbox" },
  ] },
  { capability: "size", label: "Tamaño", fields: (node) => [
    { path: "box.width.mode", label: "Ancho", control: "select", options: opt([["", "Automático"], ["fill", "Llenar"], ["hug", "Ajustar al contenido"], ["fixed", "Fijo"]]) },
    ...(node.box?.width?.mode === "fixed" ? [{ path: "box.width.value", label: "Ancho (px)", control: "number" }] : []),
    { path: "box.height.mode", label: "Alto", control: "select", options: opt([["", "Automático"], ["hug", "Ajustar al contenido"], ["fill", "Llenar"], ["fixed", "Fijo"]]) },
    ...(node.box?.height?.mode === "fixed" ? [{ path: "box.height.value", label: "Alto (px)", control: "number" }] : []),
    { path: "box.maxWidth", label: "Ancho máximo", control: "number" },
  ] },
  { capability: "spacing", label: "Espaciado", fields: () => [
    { path: "box.padding", label: "Relleno", control: "sides" },
    { path: "box.margin", label: "Margen", control: "sides" },
  ] },
  { capability: "background", label: "Fondo", fields: () => [
    { path: "style.background", label: "Fondo", control: "color" },
  ] },
  { capability: "border", label: "Borde", fields: () => [
    { path: "style.borderWidth", label: "Grosor", control: "number" },
    { path: "style.borderColor", label: "Color", control: "color" },
    { path: "style.radius", label: "Redondeo", control: "number" },
  ] },
  { capability: "typography", label: "Tipografía", fields: () => [
    { path: "style.fontSize", label: "Tamaño", control: "number" },
    { path: "style.fontWeight", label: "Peso", control: "select", options: opt([AUTO, [400, "Normal"], [600, "Semi"], [700, "Negrita"], [800, "Extra"], [900, "Black"]]) },
    { path: "style.fontFamily", label: "Fuente", control: "select", options: opt([AUTO, ["display", "Syne"], ["body", "DM Sans"]]) },
    { path: "style.textAlign", label: "Alinear texto", control: "select", options: opt([AUTO, ["left", "Izquierda"], ["center", "Centro"], ["right", "Derecha"]]) },
    { path: "style.color", label: "Color", control: "color" },
    { path: "style.lineHeight", label: "Interlineado", control: "number", step: 0.1 },
    { path: "style.letterSpacing", label: "Espaciado letras", control: "number", step: 0.1 },
  ] },
  // Texto literal; si el dato viene de un binding, sólo lo que va antes y después.
  { capability: "text", label: "Texto", fields: (node, def, ctx) => ctx.bindingKey
    ? [{ path: "props.prefix", label: "Antes del dato", control: "text" }, { path: "props.suffix", label: "Después del dato", control: "text" },
       { path: "props.fallback", label: "Si no hay dato", control: "text" }]
    : [{ path: "props.text", label: "Texto", control: "textarea" }] },
  // Botón: etiqueta literal, o antes/después si muestra un dato; con hijos, el contenido son sus capas.
  { capability: "label", label: "Etiqueta", fields: (node, def, ctx) => node.children?.length ? []
    : ctx.bindingKey
      ? [{ path: "props.prefix", label: "Antes del dato", control: "text" }, { path: "props.suffix", label: "Después del dato", control: "text" }]
      : [{ path: "props.label", label: "Etiqueta", control: "text" }] },
  { capability: "image", label: "Imagen", fields: () => [
    { path: "props.fit", label: "Ajuste", control: "select", options: opt([AUTO, ["cover", "Cubrir"], ["contain", "Contener"], ["fill", "Estirar"]]) },
  ] },
  { capability: "props", label: "Opciones", fields: (node, def) =>
    (def.propFields ?? []).map((f) => ({ path: `props.${f.key}`, label: f.label, control: f.control, options: f.options && opt(f.options.map((o) => [o, o])) })) },
];
