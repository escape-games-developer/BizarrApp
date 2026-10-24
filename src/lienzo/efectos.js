/**
 * Efectos animados de los elementos del lienzo. Sin imports (TV, vista previa
 * y Admin). `anim` es la regla `animation`; `filtro` es un `filter` fijo que se
 * suma al del elemento. Los keyframes viven en EFECTOS_LIENZO_CSS.
 */

/** Imágenes: seis efectos (además de «Sin efecto»); la campana es la del logo de BizarrApp. */
export const EFECTOS_IMAGEN = [
  { id: "ninguno", nombre: "Sin efecto" },
  { id: "latido",  nombre: "Latido",          anim: "lzLatido 1.4s ease-in-out infinite" },
  { id: "flotar",  nombre: "Flotar",          anim: "lzFlotar 3.2s ease-in-out infinite" },
  { id: "brillo",  nombre: "Brillo neón",     anim: "lzBrillo 2.2s ease-in-out infinite" },
  { id: "byn",     nombre: "Blanco y negro",  filtro: "grayscale(1) contrast(1.1)" },
  { id: "glitch",  nombre: "Glitch",          anim: "lzGlitch 2.4s steps(1,end) infinite" },
  { id: "campana", nombre: "Campana",         anim: "lzCampana 2.4s ease-in-out infinite", origen: "50% 0" },
];

/** Textos: los mismos movimientos más el titilar del neón y el rebote. */
export const EFECTOS_TEXTO = [
  { id: "ninguno", nombre: "Sin efecto" },
  { id: "latido",  nombre: "Latido",   anim: "lzLatido 1.4s ease-in-out infinite" },
  { id: "flotar",  nombre: "Flotar",   anim: "lzFlotar 3.2s ease-in-out infinite" },
  { id: "titilar", nombre: "Titilar",  anim: "lzTitilar 2.8s linear infinite" },
  { id: "rebote",  nombre: "Rebote",   anim: "lzRebote 1.6s cubic-bezier(.3,0,.4,1) infinite" },
  { id: "glitch",  nombre: "Glitch",   anim: "lzGlitch 2.4s steps(1,end) infinite" },
];

const TODOS = new Map([...EFECTOS_IMAGEN, ...EFECTOS_TEXTO].map((e) => [e.id, e]));
export const efectoLienzo = (id) => TODOS.get(id) || TODOS.get("ninguno");

export const EFECTOS_LIENZO_CSS = `
  @keyframes lzLatido{0%,100%{transform:scale(1)}14%{transform:scale(1.08)}28%{transform:scale(1)}42%{transform:scale(1.05)}70%{transform:scale(1)}}
  @keyframes lzFlotar{0%,100%{transform:translateY(0) rotate(-.6deg)}50%{transform:translateY(-3.5%) rotate(.6deg)}}
  @keyframes lzBrillo{0%,100%{filter:drop-shadow(0 0 6px rgba(199,125,255,.45))}50%{filter:drop-shadow(0 0 28px rgba(199,125,255,.95)) brightness(1.15)}}
  @keyframes lzTitilar{0%,18%,22%,25%,53%,57%,100%{opacity:1}20%,24%,55%{opacity:.35}}
  @keyframes lzRebote{0%,100%{transform:translateY(0) scale(1,1)}10%{transform:translateY(0) scale(1.06,.94)}35%{transform:translateY(-8%) scale(.97,1.03)}55%{transform:translateY(0) scale(1.04,.96)}65%{transform:translateY(-2%)}75%{transform:translateY(0)}}
  @keyframes lzGlitch{0%,86%,100%{transform:translate(0);filter:none}88%{transform:translate(-1.2%,.5%) skewX(-5deg);filter:drop-shadow(-6px 0 #00E5FF) drop-shadow(6px 0 #FF2D78)}91%{transform:translate(1.2%,-.5%) skewX(4deg);filter:drop-shadow(6px 0 #00E5FF) drop-shadow(-6px 0 #FF2D78)}94%{transform:translate(-.5%,0);filter:none}}
  @keyframes lzCampana{0%{transform:rotate(0)}10%{transform:rotate(16deg)}22%{transform:rotate(-13deg)}34%{transform:rotate(9deg)}46%{transform:rotate(-6deg)}58%{transform:rotate(3deg)}70%{transform:rotate(-1deg)}80%,100%{transform:rotate(0)}}
  @keyframes lzConfeti{0%{transform:translateY(-10vh) rotate(0)}100%{transform:translateY(110vh) rotate(720deg)}}
  @keyframes lzOrb{0%{transform:translate(0,0)}50%{transform:translate(40px,-30px)}100%{transform:translate(0,0)}}
`;
