import { evalCondition } from "./dataScope";

/**
 * DesignNode → CSS inline. Modelo de flujo: flex para contenedores, modos de
 * ancho/alto relativos al contenedor padre. Sin x/y.
 */
const ALIGN   = { start: "flex-start", center: "center", end: "flex-end", stretch: "stretch" };
const JUSTIFY = { start: "flex-start", center: "center", end: "flex-end", between: "space-between", around: "space-around" };
const FONT_FAMILY = { display: "Syne,sans-serif", body: "'DM Sans', sans-serif" };

const px = (v) => (typeof v === "number" ? `${v}px` : undefined);
const sides = (a) => (Array.isArray(a) && a.length === 4 ? a.map((v) => `${v}px`).join(" ") : undefined);

function layoutCss(layout) {
  if (!layout) return {};
  return {
    display: "flex",
    flexDirection: layout.direction === "row" ? "row" : "column",
    alignItems: ALIGN[layout.align],
    justifyContent: JUSTIFY[layout.justify],
    gap: px(layout.gap),
    flexWrap: layout.wrap ? "wrap" : undefined,
  };
}

function boxCss(box, parentDirection) {
  if (!box) return {};
  const css = {};
  const inRow = parentDirection === "row";
  const w = box.width, h = box.height;
  if (w?.mode === "fill")  Object.assign(css, inRow ? { flex: "1 1 0", minWidth: 0 } : { alignSelf: "stretch" });
  if (w?.mode === "hug")   Object.assign(css, inRow ? { flex: "0 0 auto" } : { width: "fit-content" });
  if (w?.mode === "fixed") Object.assign(css, { width: px(w.value), flexShrink: 0 });
  if (h?.mode === "fill")  Object.assign(css, inRow ? { alignSelf: "stretch" } : { flex: "1 1 0", minHeight: 0 });
  if (h?.mode === "fixed") Object.assign(css, { height: px(h.value), flexShrink: 0 });
  Object.assign(css, {
    minWidth: css.minWidth ?? px(box.minWidth), maxWidth: px(box.maxWidth),
    minHeight: css.minHeight ?? px(box.minHeight), maxHeight: px(box.maxHeight),
    padding: sides(box.padding), margin: sides(box.margin),
  });
  return css;
}

function styleCss(s) {
  if (!s) return {};
  const css = {
    background: s.background, color: s.color, opacity: s.opacity,
    borderRadius: px(s.radius),
    fontSize: px(s.fontSize), fontWeight: s.fontWeight, fontFamily: FONT_FAMILY[s.fontFamily],
    textAlign: s.textAlign, lineHeight: s.lineHeight, letterSpacing: px(s.letterSpacing),
    textTransform: s.textTransform,
  };
  if (s.borderWidth != null || s.borderColor != null) {
    css.border = `${s.borderWidth ?? 1}px solid ${s.borderColor ?? "transparent"}`;
  }
  return css;
}

/** Estilo efectivo: base + variantes cuya condición se cumple. */
export function effectiveStyle(node, scope) {
  let s = node.style ?? null;
  for (const v of node.variants ?? []) if (evalCondition(v.when, scope)) s = { ...(s ?? {}), ...v.style };
  return s;
}

export function nodeCss(node, scope, parentDirection) {
  const css = { ...layoutCss(node.layout), ...boxCss(node.box, parentDirection), ...styleCss(effectiveStyle(node, scope)) };
  for (const k of Object.keys(css)) if (css[k] === undefined) delete css[k];
  return css;
}
