/**
 * Tipografías y biblioteca de estilos de texto del editor de pantallas.
 * Sin imports: lo usan la TV, la vista previa y el Admin.
 *
 * Un `estilo` de texto es:
 *   { fuente, tamano (px sobre 1920 × 1080), peso, cursiva, subrayado, mayus,
 *     alinear, interlineado, espaciado (em), color,
 *     degradado: { colores: [...], angulo } | null,
 *     contorno:  { color, ancho } | null,
 *     sombra:    { color, x, y, blur } | null,
 *     brillo:    { color, fuerza } | null }
 * ESTILOS_TEXTO son estilos prearmados: se aplican sobre el texto y después
 * se ajustan a mano como en un procesador de texto.
 */

export const FUENTES = [
  { id: "syne",        nombre: "Syne",             css: "'Syne',sans-serif",              g: "Syne:wght@400;700;800;900" },
  { id: "grotesk",     nombre: "Space Grotesk",    css: "'Space Grotesk',sans-serif",     g: "Space+Grotesk:wght@400;600;700" },
  { id: "dmsans",      nombre: "DM Sans",          css: "'DM Sans',sans-serif",           g: "DM+Sans:ital,wght@0,400;0,700;1,400;1,700" },
  { id: "montserrat",  nombre: "Montserrat",       css: "'Montserrat',sans-serif",        g: "Montserrat:ital,wght@0,400;0,700;0,900;1,700;1,900" },
  { id: "poppins",     nombre: "Poppins",          css: "'Poppins',sans-serif",           g: "Poppins:ital,wght@0,400;0,700;0,900;1,700" },
  { id: "anton",       nombre: "Anton",            css: "'Anton',sans-serif",             g: "Anton" },
  { id: "bebas",       nombre: "Bebas Neue",       css: "'Bebas Neue',sans-serif",        g: "Bebas+Neue" },
  { id: "oswald",      nombre: "Oswald",           css: "'Oswald',sans-serif",            g: "Oswald:wght@400;700" },
  { id: "archivo",     nombre: "Archivo Black",    css: "'Archivo Black',sans-serif",     g: "Archivo+Black" },
  { id: "teko",        nombre: "Teko",             css: "'Teko',sans-serif",              g: "Teko:wght@400;700" },
  { id: "bungee",      nombre: "Bungee",           css: "'Bungee',sans-serif",            g: "Bungee" },
  { id: "bungeeshade", nombre: "Bungee Shade",     css: "'Bungee Shade',sans-serif",      g: "Bungee+Shade" },
  { id: "righteous",   nombre: "Righteous",        css: "'Righteous',sans-serif",         g: "Righteous" },
  { id: "monoton",     nombre: "Monoton",          css: "'Monoton',sans-serif",           g: "Monoton" },
  { id: "orbitron",    nombre: "Orbitron",         css: "'Orbitron',sans-serif",          g: "Orbitron:wght@400;700;900" },
  { id: "audiowide",   nombre: "Audiowide",        css: "'Audiowide',sans-serif",         g: "Audiowide" },
  { id: "russo",       nombre: "Russo One",        css: "'Russo One',sans-serif",         g: "Russo+One" },
  { id: "rubikmono",   nombre: "Rubik Mono One",   css: "'Rubik Mono One',sans-serif",    g: "Rubik+Mono+One" },
  { id: "blackops",    nombre: "Black Ops One",    css: "'Black Ops One',sans-serif",     g: "Black+Ops+One" },
  { id: "pixel",       nombre: "Press Start 2P",   css: "'Press Start 2P',monospace",     g: "Press+Start+2P" },
  { id: "bangers",     nombre: "Bangers",          css: "'Bangers',sans-serif",           g: "Bangers" },
  { id: "luckiest",    nombre: "Luckiest Guy",     css: "'Luckiest Guy',sans-serif",      g: "Luckiest+Guy" },
  { id: "titan",       nombre: "Titan One",        css: "'Titan One',sans-serif",         g: "Titan+One" },
  { id: "sigmar",      nombre: "Sigmar One",       css: "'Sigmar One',sans-serif",        g: "Sigmar+One" },
  { id: "fredoka",     nombre: "Fredoka",          css: "'Fredoka',sans-serif",           g: "Fredoka:wght@400;700" },
  { id: "shrikhand",   nombre: "Shrikhand",        css: "'Shrikhand',serif",              g: "Shrikhand" },
  { id: "faster",      nombre: "Faster One",       css: "'Faster One',sans-serif",        g: "Faster+One" },
  { id: "creepster",   nombre: "Creepster",        css: "'Creepster',sans-serif",         g: "Creepster" },
  { id: "marker",      nombre: "Permanent Marker", css: "'Permanent Marker',cursive",     g: "Permanent+Marker" },
  { id: "caveat",      nombre: "Caveat",           css: "'Caveat',cursive",               g: "Caveat:wght@400;700" },
  { id: "pacifico",    nombre: "Pacifico",         css: "'Pacifico',cursive",             g: "Pacifico" },
  { id: "lobster",     nombre: "Lobster",          css: "'Lobster',cursive",              g: "Lobster" },
  { id: "satisfy",     nombre: "Satisfy",          css: "'Satisfy',cursive",              g: "Satisfy" },
  { id: "playfair",    nombre: "Playfair Display", css: "'Playfair Display',serif",       g: "Playfair+Display:ital,wght@0,700;0,900;1,700;1,900" },
  { id: "abril",       nombre: "Abril Fatface",    css: "'Abril Fatface',serif",          g: "Abril+Fatface" },
];

const FUENTE_POR_ID = new Map(FUENTES.map((f) => [f.id, f]));

/** Una sola hoja de Google Fonts con todas las tipografías del editor. */
export const FUENTES_CSS =
  `@import url('https://fonts.googleapis.com/css2?${FUENTES.map((f) => `family=${f.g}`).join("&")}&display=swap');`;

export const ESTILO_BASE = Object.freeze({
  fuente: "syne", tamano: 72, peso: 800, cursiva: false, subrayado: false, mayus: false,
  alinear: "center", interlineado: 1.1, espaciado: 0, color: "#F0E8FF",
  degradado: null, contorno: null, sombra: null, brillo: null,
});

const g = (colores, angulo = 180) => ({ colores, angulo });
const c = (color, ancho) => ({ color, ancho });
const s = (color, x, y, blur) => ({ color, x, y, blur });
const b = (color, fuerza = 20) => ({ color, fuerza });

/** Biblioteca de estilos prearmados (más de 50). `estilo` pisa a ESTILO_BASE. */
export const ESTILOS_TEXTO = [
  { id: "neon-rosa",      nombre: "Neón rosa",        estilo: { fuente: "syne", peso: 900, color: "#FFE3F1", brillo: b("#FF2D78") } },
  { id: "neon-cian",      nombre: "Neón cian",        estilo: { fuente: "orbitron", peso: 900, color: "#E0FDFF", brillo: b("#00E5FF") } },
  { id: "neon-verde",     nombre: "Neón verde",       estilo: { fuente: "audiowide", peso: 400, color: "#E8FFF5", brillo: b("#00F5A0") } },
  { id: "neon-violeta",   nombre: "Neón violeta",     estilo: { fuente: "monoton", peso: 400, color: "#F3E5FF", brillo: b("#9B2FFF") } },
  { id: "neon-amarillo",  nombre: "Neón amarillo",    estilo: { fuente: "righteous", peso: 400, color: "#FFFBE0", brillo: b("#FFD600") } },
  { id: "bizarren",       nombre: "Bizarren",         estilo: { fuente: "syne", peso: 900, degradado: g(["#FFD600", "#FF9500"], 135) } },
  { id: "fuego",          nombre: "Fuego",            estilo: { fuente: "bangers", peso: 400, degradado: g(["#FFD600", "#FF2D00"]), contorno: c("#3A0A00", 4) } },
  { id: "oro",            nombre: "Oro",              estilo: { fuente: "abril", peso: 400, degradado: g(["#FFF3B0", "#C9961A"]), sombra: s("#000", 0, 6, 12) } },
  { id: "cromo",          nombre: "Plata cromada",    estilo: { fuente: "russo", peso: 400, degradado: g(["#FFFFFF", "#8A8FA0"]), contorno: c("#2A2D36", 2) } },
  { id: "atardecer",      nombre: "Atardecer",        estilo: { fuente: "anton", peso: 400, mayus: true, degradado: g(["#FF2D78", "#FFD600"], 90) } },
  { id: "oceano",         nombre: "Océano",           estilo: { fuente: "montserrat", peso: 900, degradado: g(["#00E5FF", "#3D6BFF"], 135) } },
  { id: "galaxia",        nombre: "Galaxia",          estilo: { fuente: "orbitron", peso: 900, degradado: g(["#9B2FFF", "#00E5FF"], 135), brillo: b("#9B2FFF", 10) } },
  { id: "arcoiris",       nombre: "Arcoíris",         estilo: { fuente: "fredoka", peso: 700, degradado: g(["#FF2D78", "#FFD600", "#00F5A0", "#00E5FF", "#9B2FFF"], 90) } },
  { id: "retro80",        nombre: "Retro 80s",        estilo: { fuente: "audiowide", peso: 400, degradado: g(["#FF2D78", "#FFD600"]), sombra: s("#00E5FF", 6, 6, 0) } },
  { id: "arcade",         nombre: "Arcade",           estilo: { fuente: "pixel", peso: 400, tamano: 48, interlineado: 1.4, color: "#FFD600", sombra: s("#FF2D78", 4, 4, 0) } },
  { id: "comic",          nombre: "Cómic",            estilo: { fuente: "bangers", peso: 400, espaciado: 0.03, color: "#FFD600", contorno: c("#000", 5), sombra: s("#000", 6, 6, 0) } },
  { id: "comic-rojo",     nombre: "Cómic rojo",       estilo: { fuente: "luckiest", peso: 400, color: "#FF2D00", contorno: c("#FFFFFF", 4), sombra: s("#000", 6, 6, 0) } },
  { id: "cine",           nombre: "Cartel de cine",   estilo: { fuente: "bebas", peso: 400, espaciado: 0.08, color: "#FFFFFF", sombra: s("#000", 0, 8, 20) } },
  { id: "titular",        nombre: "Titular",          estilo: { fuente: "anton", peso: 400, mayus: true, color: "#FFFFFF" } },
  { id: "elegante",       nombre: "Elegante",         estilo: { fuente: "playfair", peso: 900, cursiva: true, color: "#F5E6C0" } },
  { id: "clasico-dorado", nombre: "Clásico dorado",   estilo: { fuente: "playfair", peso: 700, color: "#E8C468", sombra: s("#000", 0, 4, 10) } },
  { id: "firma",          nombre: "Firma",            estilo: { fuente: "satisfy", peso: 400, color: "#FFFFFF", brillo: b("#FF2D78", 8) } },
  { id: "pizarra",        nombre: "Pizarra",          estilo: { fuente: "caveat", peso: 700, color: "#F0F0E8" } },
  { id: "graffiti",       nombre: "Graffiti",         estilo: { fuente: "marker", peso: 400, color: "#00F5A0", contorno: c("#000", 3), sombra: s("#FF2D78", 5, 5, 0) } },
  { id: "graffiti-vio",   nombre: "Graffiti violeta", estilo: { fuente: "marker", peso: 400, color: "#C77DFF", sombra: s("#000", 4, 4, 0) } },
  { id: "militar",        nombre: "Militar",          estilo: { fuente: "blackops", peso: 400, color: "#C5D86D", sombra: s("#000", 4, 4, 0) } },
  { id: "futurista",      nombre: "Futurista",        estilo: { fuente: "orbitron", peso: 700, mayus: true, espaciado: 0.15, color: "#00E5FF" } },
  { id: "robot",          nombre: "Robot",            estilo: { fuente: "rubikmono", peso: 400, color: "#FFFFFF", contorno: c("#00E5FF", 2) } },
  { id: "terror",         nombre: "Terror",           estilo: { fuente: "creepster", peso: 400, color: "#7CFF4F", brillo: b("#2BFF00", 14) } },
  { id: "sangre",         nombre: "Sangre",           estilo: { fuente: "creepster", peso: 400, color: "#E10600", sombra: s("#000", 0, 4, 8) } },
  { id: "caramelo",       nombre: "Caramelo",         estilo: { fuente: "titan", peso: 400, degradado: g(["#FF9AD5", "#FF2D78"]), contorno: c("#FFFFFF", 4) } },
  { id: "burbuja",        nombre: "Burbuja",          estilo: { fuente: "fredoka", peso: 700, color: "#FFFFFF", contorno: c("#9B2FFF", 5) } },
  { id: "chicle",         nombre: "Chicle",           estilo: { fuente: "shrikhand", peso: 400, degradado: g(["#FF6FD8", "#3813C2"], 135) } },
  { id: "surf",           nombre: "Surf",             estilo: { fuente: "pacifico", peso: 400, color: "#00E5FF", sombra: s("#003D5C", 3, 3, 0) } },
  { id: "vintage",        nombre: "Vintage",          estilo: { fuente: "lobster", peso: 400, color: "#FFD600", sombra: s("#8A2BE2", 4, 4, 0) } },
  { id: "minimal",        nombre: "Minimal blanco",   estilo: { fuente: "dmsans", peso: 700, color: "#FFFFFF" } },
  { id: "minimal-gris",   nombre: "Minimal gris",     estilo: { fuente: "grotesk", peso: 600, mayus: true, espaciado: 0.08, tamano: 40, color: "rgba(240,232,255,.6)" } },
  { id: "subtitulo",      nombre: "Subtítulo dorado", estilo: { fuente: "grotesk", peso: 700, mayus: true, espaciado: 0.12, tamano: 40, color: "#FFD600" } },
  { id: "hueco-blanco",   nombre: "Hueco blanco",     estilo: { fuente: "anton", peso: 400, color: "transparent", contorno: c("#FFFFFF", 3) } },
  { id: "hueco-amarillo", nombre: "Hueco amarillo",   estilo: { fuente: "bungee", peso: 400, color: "transparent", contorno: c("#FFD600", 3) } },
  { id: "hueco-neon",     nombre: "Hueco neón",       estilo: { fuente: "monoton", peso: 400, color: "transparent", contorno: c("#00E5FF", 2), brillo: b("#00E5FF", 12) } },
  { id: "bloque",         nombre: "Bloque 3D",        estilo: { fuente: "bungeeshade", peso: 400, color: "#FFD600" } },
  { id: "deportivo",      nombre: "Deportivo",        estilo: { fuente: "teko", peso: 700, cursiva: true, mayus: true, color: "#FFFFFF", sombra: s("#FF2D78", 4, 4, 0) } },
  { id: "velocidad",      nombre: "Velocidad",        estilo: { fuente: "faster", peso: 400, color: "#FF2D78" } },
  { id: "fiesta",         nombre: "Fiesta",           estilo: { fuente: "sigmar", peso: 400, degradado: g(["#00F5A0", "#00E5FF"]), contorno: c("#08040F", 3) } },
  { id: "sombra-larga",   nombre: "Sombra larga",     estilo: { fuente: "archivo", peso: 400, color: "#FFD600", sombra: s("#FF2D78", 10, 10, 0) } },
  { id: "doble",          nombre: "Doble trazo",      estilo: { fuente: "archivo", peso: 400, color: "#FFFFFF", sombra: s("#00E5FF", 6, 6, 0) } },
  { id: "hielo",          nombre: "Hielo",            estilo: { fuente: "fredoka", peso: 700, degradado: g(["#FFFFFF", "#9BE7FF"]), brillo: b("#9BE7FF", 12) } },
  { id: "lava",           nombre: "Lava",             estilo: { fuente: "titan", peso: 400, degradado: g(["#FF9500", "#E10600"]), brillo: b("#FF2D00", 12) } },
  { id: "medianoche",     nombre: "Medianoche",       estilo: { fuente: "poppins", peso: 900, degradado: g(["#C77DFF", "#3D1A78"]), sombra: s("#000", 0, 6, 14) } },
  { id: "brillante",      nombre: "Brillante",        estilo: { fuente: "poppins", peso: 900, color: "#FFFFFF", brillo: b("#FFD600", 16) } },
  { id: "pop",            nombre: "Pop",              estilo: { fuente: "luckiest", peso: 400, color: "#00E5FF", contorno: c("#08040F", 4), sombra: s("#FF2D78", 5, 5, 0) } },
  { id: "carteleria",     nombre: "Cartelería",       estilo: { fuente: "oswald", peso: 700, mayus: true, espaciado: 0.05, color: "#FFFFFF", sombra: s("#000", 0, 3, 0) } },
  { id: "violeta-juego",  nombre: "Violeta del juego", estilo: { fuente: "syne", peso: 900, color: "#C77DFF", brillo: b("#A855F7", 14) } },
];

export function estiloCompleto(estilo) {
  return { ...ESTILO_BASE, ...(estilo || {}) };
}

/** Aplica un estilo prearmado conservando tamaño y alineación del texto. */
export function aplicarEstilo(actual, idEstilo) {
  const e = ESTILOS_TEXTO.find((x) => x.id === idEstilo);
  if (!e) return actual;
  const base = estiloCompleto(actual);
  return { ...ESTILO_BASE, tamano: base.tamano, alinear: base.alinear, ...e.estilo,
    ...(e.estilo.tamano ? {} : { tamano: base.tamano }) };
}

const sombraTexto = (sh) => `${sh.x}px ${sh.y}px ${sh.blur}px ${sh.color}`;
const capasBrillo = (br) => {
  const f = Math.max(2, Number(br.fuerza) || 20);
  return [`0 0 ${f * 0.25}px ${br.color}`, `0 0 ${f}px ${br.color}`, `0 0 ${f * 2}px ${br.color}`];
};

/**
 * Estilo CSS de un texto. Con degradado el relleno es transparente (el color
 * lo pone el fondo recortado al texto), así que la sombra y el brillo van con
 * `filter: drop-shadow` en vez de `text-shadow`.
 */
export function cssDeTexto(estilo) {
  const e = estiloCompleto(estilo);
  const fuente = FUENTE_POR_ID.get(e.fuente) || FUENTE_POR_ID.get("syne");
  const css = {
    fontFamily: fuente.css, fontSize: `${e.tamano}px`, fontWeight: e.peso,
    fontStyle: e.cursiva ? "italic" : "normal",
    textDecoration: e.subrayado ? "underline" : "none",
    textTransform: e.mayus ? "uppercase" : "none",
    textAlign: e.alinear, lineHeight: e.interlineado, letterSpacing: `${e.espaciado}em`,
    color: e.color, whiteSpace: "pre-wrap", wordBreak: "break-word",
  };
  if (e.contorno?.ancho > 0) {
    css.WebkitTextStroke = `${e.contorno.ancho}px ${e.contorno.color}`;
    css.paintOrder = "stroke fill";
  }
  const capas = [...(e.sombra ? [sombraTexto(e.sombra)] : []), ...(e.brillo ? capasBrillo(e.brillo) : [])];
  if (e.degradado?.colores?.length >= 2) {
    Object.assign(css, {
      backgroundImage: `linear-gradient(${e.degradado.angulo ?? 180}deg, ${e.degradado.colores.join(", ")})`,
      WebkitBackgroundClip: "text", backgroundClip: "text",
      color: "transparent", WebkitTextFillColor: "transparent",
    });
    if (capas.length) css.filter = capas.map((x) => `drop-shadow(${x})`).join(" ");
  } else if (capas.length) {
    css.textShadow = capas.join(", ");
  }
  return css;
}
