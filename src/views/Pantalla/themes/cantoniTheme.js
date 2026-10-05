/**
 * Diseño Cantoni — tema visual de Pantalla › DJ Democracy (Cliente).
 *
 * Estética Talento Bizarren: noche azul/violeta, cards oscuras de borde fino,
 * Bungee para títulos y Bricolage Grotesque para texto/UI, y la franja de
 * colores de señal de TV arriba.
 *
 * Sólo presentación: todo el CSS cuelga de `.djv-cantoni`, que envuelve la
 * vista de votación. No alcanza al header (logo) ni a la navegación inferior,
 * que viven en ClientShell, fuera de la vista. Los valores se editan en
 * CANTONI_TOKENS.
 */
export const CANTONI_TOKENS = Object.freeze({
  bg:       "#100D28",
  surface:  "#1A1638",
  border:   "rgba(179,173,201,.2)",
  yellow:   "#FFD21F",
  pink:     "#FF3FA8",
  cyan:     "#1CC8E3",
  green:    "#2ED47A",
  red:      "#FF4B3E",
  tv:       "#3A2BE0",
  text:     "#F8F5FF",
  text2:    "#B3ADC9",
  display:  "'Bungee',sans-serif",
  ui:       "'Bricolage Grotesque',sans-serif",
});

/** Orden de la franja de señal de TV. */
export const CANTONI_TV_STRIPE = ["yellow", "cyan", "green", "pink", "red", "tv"];

const vars = Object.entries(CANTONI_TOKENS).map(([k, v]) => `--c-${k}:${v};`).join("");

// Va en un <style> propio: @import tiene que ser la primera regla de la hoja.
const fontsCss = `@import url('https://fonts.googleapis.com/css2?family=Bungee&family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&display=swap');`;

const css = `
  /* ── Lienzo: cubre el padding de .app-content (14 16 16) ─────────────── */
  .djv-cantoni{${vars}
    margin:-14px -16px -16px;padding:14px 16px 16px;height:calc(100% + 30px);
    background:var(--c-bg);color:var(--c-text);font-family:var(--c-ui);}
  .djv-cantoni button{font-family:var(--c-ui);}

  .djv-cantoni .djv-tv-franja{display:flex;height:6px;margin:-14px -16px 12px;}
  .djv-cantoni .djv-tv-franja span{flex:1;}

  /* ── Reacciones ─────────────────────────────────────────────────────── */
  .djv-cantoni .djv-reaccion{background:var(--c-surface);border-color:var(--c-border);}
  .djv-cantoni .djv-reaccion:active{background:rgba(58,43,224,.25);border-color:var(--c-tv);}
  .djv-cantoni .djv-reaccion-pop{background:rgba(255,63,168,.18);border-color:var(--c-pink);}

  /* ── Sonando ahora ──────────────────────────────────────────────────── */
  .djv-cantoni .djv-ahora{border-radius:16px;
    background:linear-gradient(135deg,rgba(255,63,168,.16),var(--c-surface) 62%);
    border:1px solid rgba(255,63,168,.5);box-shadow:none;}
  .djv-cantoni .djv-ahora-cover{flex-shrink:0;width:52px;height:52px;border-radius:10px;object-fit:cover;
    background:rgba(248,245,255,.06);}
  .djv-cantoni .djv-ahora-lbl{font-family:var(--c-display);font-weight:400;font-size:11px;letter-spacing:.6px;
    color:var(--c-pink);}
  .djv-cantoni .djv-ahora-tit{font-family:var(--c-ui);font-weight:700;color:var(--c-text);}
  .djv-cantoni .djv-ahora-art{color:var(--c-text2);}
  .djv-cantoni .djv-kick{font-weight:800;border-radius:12px;border:1.5px solid var(--c-pink);
    background:var(--c-pink);color:#fff;box-shadow:0 4px 14px rgba(255,63,168,.25);}
  .djv-cantoni .djv-kick-on{background:rgba(255,63,168,.14);color:var(--c-pink);box-shadow:none;}
  .djv-cantoni .djv-kick-barra{background:rgba(248,245,255,.1);}
  .djv-cantoni .djv-kick-fill{background:linear-gradient(90deg,var(--c-pink),var(--c-yellow));}

  /* ── Encabezado del ranking ─────────────────────────────────────────── */
  .djv-cantoni .djv-seccion-tit{font-family:var(--c-display);font-weight:400;font-size:13px;color:var(--c-yellow);}
  .djv-cantoni .djv-copa{filter:none;}

  /* ── Card de candidata ──────────────────────────────────────────────── */
  .djv-cantoni .djv-tema{background:var(--c-surface);border:1px solid var(--c-border);}
  .djv-cantoni .djv-tema-1{border-color:var(--c-yellow);}
  .djv-cantoni .djv-tema-votado{border-color:var(--c-cyan);background:#16213F;box-shadow:none;}
  .djv-cantoni .djv-tema-contra{border-color:rgba(255,75,62,.55);background:#22152F;}
  .djv-cantoni .djv-tema-grid{grid-template-columns:26px 64px minmax(0,1fr) auto;}
  .djv-cantoni .djv-tema-pos{font-family:var(--c-display);font-weight:400;font-size:20px;color:rgba(179,173,201,.45);}
  .djv-cantoni .djv-tema-1 .djv-tema-pos{color:var(--c-yellow);}
  .djv-cantoni .djv-tema-cover{background:rgba(248,245,255,.06);}
  .djv-cantoni .djv-tema-tit{font-family:var(--c-ui);color:var(--c-text);}
  .djv-cantoni .djv-tema-art{color:var(--c-text2);}
  .djv-cantoni .djv-tema-pts b{font-family:var(--c-ui);font-weight:700;}
  .djv-cantoni .djv-chip-voto{font-family:var(--c-ui);font-weight:800;font-size:9px;
    background:var(--c-cyan);color:var(--c-bg);box-shadow:none;}

  /* ── Botonera: 👍 verde · 🔥 amarillo · 👎 rojo ──────────────────────── */
  .djv-cantoni .djv-voto{height:48px;background:rgba(248,245,255,.03);}
  .djv-cantoni .djv-voto-up{border-color:var(--c-green);color:var(--c-green);}
  .djv-cantoni .djv-voto-down{border-color:var(--c-red);color:var(--c-red);}
  .djv-cantoni .djv-voto-up-on{background:rgba(46,212,122,.18);border-color:var(--c-green);box-shadow:none;}
  .djv-cantoni .djv-voto-down-on{background:rgba(255,75,62,.18);border-color:var(--c-red);}
  .djv-cantoni .djv-super{background:rgba(255,210,31,.1);border-color:var(--c-yellow);color:var(--c-yellow);}
  .djv-cantoni .djv-super-usado{background:rgba(248,245,255,.03);border-color:var(--c-border);color:var(--c-text2);}
  .djv-cantoni .djv-valor{font-family:var(--c-ui);background:var(--c-surface);}
  .djv-cantoni .djv-tema-votado .djv-valor{background:#16213F;}
  .djv-cantoni .djv-tema-contra .djv-valor{background:#22152F;}
  .djv-cantoni .djv-valor-up{color:var(--c-green);}
  .djv-cantoni .djv-valor-down{color:var(--c-red);}
  .djv-cantoni .djv-valor-super{color:var(--c-yellow);}

  /* ── Avisos, vacíos, skeletons y pie ────────────────────────────────── */
  .djv-cantoni .djv-meta{color:var(--c-text2);}
  .djv-cantoni .djv-aviso-info{background:rgba(255,210,31,.07);border-color:rgba(255,210,31,.3);color:var(--c-text2);}
  .djv-cantoni .djv-aviso-error{background:rgba(255,75,62,.1);border-color:rgba(255,75,62,.35);color:#FFB4AD;}
  .djv-cantoni .djv-aviso-ok{background:rgba(46,212,122,.1);border-color:rgba(46,212,122,.35);color:var(--c-green);}
  .djv-cantoni .djv-aviso-cta{font-family:var(--c-ui);font-weight:800;background:var(--c-yellow);
    border-color:var(--c-yellow);color:var(--c-bg);}
  .djv-cantoni .djv-vacio-tit{font-family:var(--c-display);font-weight:400;font-size:14px;color:var(--c-yellow);}
  .djv-cantoni .djv-vacio-txt,.djv-cantoni .djv-pie{color:var(--c-text2);}
  .djv-cantoni .djv-skel{background:linear-gradient(90deg,
    rgba(248,245,255,.04) 25%,rgba(248,245,255,.09) 50%,rgba(248,245,255,.04) 75%);
    background-size:200% 100%;}

  @media (max-width:360px){
    .djv-cantoni .djv-tema-grid{grid-template-columns:22px 56px minmax(0,1fr) auto;}
    .djv-cantoni .djv-ahora-cover{width:44px;height:44px;}
    .djv-cantoni .djv-seccion-tit{font-size:11px;}
  }
  @media (max-width:340px){
    .djv-cantoni .djv-seccion-tit{font-size:10px;}
  }
`;

export const CANTONI_THEME = Object.freeze({
  id:            "cantoni",
  className:     "djv-cantoni",
  fontsCss,
  css,
  tvStripe:      CANTONI_TV_STRIPE.map((k) => CANTONI_TOKENS[k]),
  nowPlayingCover: true,
});
