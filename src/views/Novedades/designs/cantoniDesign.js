import { CANTONI_TOKENS as T, CANTONI_TV_STRIPE } from "../../Pantalla/themes/cantoniTheme";

/**
 * Diseño Cantoni — Novedades (Cliente).
 *
 * Estética Talento Bizarren, la misma que el Diseño Cantoni de Pantalla y con
 * sus mismos tokens (CANTONI_TOKENS): noche azul/violeta, cards oscuras de
 * borde fino, Bungee para títulos, Bricolage Grotesque para texto/UI, la
 * franja de señal de TV arriba y un color de señal por tipo de novedad.
 *
 * Los estilos de las cards usan valores literales (no var(--c-*)) para que el
 * preview del formulario del Admin, que no tiene lienzo, se vea igual.
 */
const TYPE_COLOR = {
  PROMO:        T.pink,
  DESTACADO:    T.yellow,
  EVENTO:       T.cyan,
  PROXIMAMENTE: T.green,
};

/** "#RRGGBB" → "rgba(r,g,b,a)". */
const alpha = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

// Va en un <style> propio: @import tiene que ser la primera regla de la hoja.
const fontsCss = `@import url('https://fonts.googleapis.com/css2?family=Bungee&family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&display=swap');`;

// Lienzo: cubre el padding de .app-content (14 16 16), como en Pantalla.
const css = `
  .nov-cantoni{margin:-14px -16px -16px;padding:14px 16px 16px;min-height:calc(100% + 30px);
    background:${T.bg};color:${T.text};font-family:${T.ui};}
  .nov-cantoni .nov-tv-franja{display:flex;height:6px;margin:-14px -16px 14px;}
  .nov-cantoni .nov-tv-franja span{flex:1;}
`;

export const CANTONI_NOVEDADES_DESIGN = Object.freeze({
  id:        "cantoni",
  className: "nov-cantoni",
  fontsCss,
  css,
  tvStripe:  CANTONI_TV_STRIPE.map((k) => T[k]),

  frame: {
    borderRadius: 16,
    background:   T.surface,
    border:       `1px solid ${T.border}`,
  },
  imageBg:    "rgba(248,245,255,.04)",
  fallbackBg: `linear-gradient(135deg, ${alpha(T.tv, .45)}, ${alpha(T.pink, .18)})`,

  title: () => ({ fontFamily: T.ui, fontWeight: 800, fontSize: 16, color: T.text }),
  badge: (type) => {
    const c = TYPE_COLOR[type] ?? T.yellow;
    return {
      background: alpha(c, .14), border: `1px solid ${alpha(c, .55)}`,
      fontFamily: T.display, fontWeight: 400, fontSize: 9.5, letterSpacing: ".6px", color: c,
    };
  },
  excerpt: { fontFamily: T.ui, fontSize: 13, color: T.text2 },
  cta: {
    background: T.yellow, border: `1px solid ${T.yellow}`,
    color: T.bg, fontFamily: T.ui, fontSize: 13, fontWeight: 800,
  },
  date: { fontFamily: T.ui, fontSize: 11, color: T.text2 },

  header: {
    fontFamily: T.display, fontWeight: 400, fontSize: 15, letterSpacing: ".4px", color: T.yellow,
  },

  empty: {
    icon:  { opacity: .35 },
    title: { fontFamily: T.display, fontWeight: 400, fontSize: 14, color: T.yellow },
    text:  { fontFamily: T.ui, fontSize: 12.5, color: T.text2 },
  },
});
