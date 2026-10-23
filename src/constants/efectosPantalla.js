/**
 * Efectos animados y zoom de los carteles de la TV (logo del Duelo, cartel
 * «listo» de FTL / PT). Sin imports a propósito: lo usa también la vista
 * previa del Diseño de juegos, que no puede cargar el cliente de Supabase
 * (ver src/main.jsx).
 *
 * Efectos: migración 20261021230000. `anim` es la regla `animation` de CSS;
 * los keyframes viven en EFECTOS_CSS. `origen` es el transform-origin (la
 * campana pivota desde arriba).
 */
export const EFECTOS_DUELO = [
  { id: "ninguno", nombre: "Sin efecto",     icono: "⏹",  anim: "none" },
  { id: "latido",  nombre: "Latido",         icono: "💓", anim: "dpLatido 1.3s ease-in-out infinite" },
  { id: "campana", nombre: "Campana",        icono: "🔔", anim: "dpCampana 2.4s ease-in-out infinite", origen: "50% 0" },
  { id: "flotar",  nombre: "Flotar",         icono: "🎈", anim: "dpFlotar 3s ease-in-out infinite" },
  { id: "neon",    nombre: "Neón titilante", icono: "💡", anim: "dpNeon 2.8s linear infinite" },
  { id: "glitch",  nombre: "Glitch",         icono: "📺", anim: "dpGlitch 2.2s steps(1,end) infinite" },
  { id: "giro",    nombre: "Giro 3D",        icono: "🔄", anim: "dpGiro 4s ease-in-out infinite" },
  { id: "rebote",  nombre: "Rebote",         icono: "🏀", anim: "dpRebote 1.6s cubic-bezier(.3,0,.4,1) infinite" },
];

export const EFECTOS_CSS = `
  @keyframes dpLatido{0%,100%{transform:scale(1)}14%{transform:scale(1.12)}28%{transform:scale(1)}42%{transform:scale(1.08)}70%{transform:scale(1)}}
  @keyframes dpCampana{0%{transform:rotate(0)}10%{transform:rotate(12deg)}22%{transform:rotate(-10deg)}34%{transform:rotate(7deg)}46%{transform:rotate(-5deg)}58%{transform:rotate(2.5deg)}70%{transform:rotate(-1deg)}80%,100%{transform:rotate(0)}}
  @keyframes dpFlotar{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-4.5%) rotate(1deg)}}
  @keyframes dpNeon{0%,18%,22%,25%,53%,57%,100%{opacity:1;filter:brightness(1.15)}20%,24%,55%{opacity:.35;filter:brightness(.6)}}
  @keyframes dpGlitch{0%,86%,100%{transform:translate(0);filter:none}88%{transform:translate(-1.5%,.6%) skewX(-6deg);filter:drop-shadow(-6px 0 #00E5FF) drop-shadow(6px 0 #FF2D78)}91%{transform:translate(1.5%,-.6%) skewX(5deg);filter:drop-shadow(6px 0 #00E5FF) drop-shadow(-6px 0 #FF2D78)}94%{transform:translate(-.6%,0);filter:none}}
  @keyframes dpGiro{0%,35%{transform:perspective(900px) rotateY(0)}65%,100%{transform:perspective(900px) rotateY(360deg)}}
  @keyframes dpRebote{0%,100%{transform:translateY(0) scale(1,1)}10%{transform:translateY(0) scale(1.08,.92)}35%{transform:translateY(-9%) scale(.96,1.04)}55%{transform:translateY(0) scale(1.05,.95)}65%{transform:translateY(-2.5%)}75%{transform:translateY(0)}}
`;

export const efectoDuelo = (id) => EFECTOS_DUELO.find((e) => e.id === id) || EFECTOS_DUELO[0];

/**
 * Zoom (-100..100, migración 20261022010000) → escala.
 * 0 = tamaño normal; 100 = el doble; -100 = un quinto.
 */
export const ZOOM_MIN = -100;
export const ZOOM_MAX = 100;
export const escalaDeZoom = (zoom) => (zoom >= 0 ? 1 + zoom / 100 : 1 + (zoom / 100) * 0.8);
