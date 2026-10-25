import { ESTILO_BASE } from "./estilosTexto";
import { EFECTOS_IMAGEN, EFECTOS_TEXTO } from "./efectos";

/**
 * Modelo del editor de pantallas (lienzo). Sin React ni Supabase.
 *
 * Una pantalla es un lienzo de px lógicos que se escala al tamaño real:
 *   TV      → 1920 × 1080, entra entera en la pantalla.
 *   celular → 390 × 640, ocupa el ancho de la sección de la app (ver FORMATOS).
 *   { fondo, elementos: [elemento] }
 *
 * fondo = { tipo: "ninguno" | "radial" | "lineal" | "color" | "imagen", colores: [c1, c2],
 *           angulo, color, imagen, ajuste: "cover" | "contain", oscurecer (0..0.85),
 *           orbs, orbsColores: [c1, c2, c3], confeti, marco: color | null }
 *
 * elemento = { id, tipo: "texto" | "imagen" | "dato" | "forma", nombre, x, y, w, h (px),
 *              rot (grados), opacidad (0..1), visible, efecto,
 *              texto + estilo                  (texto)
 *              src + ajuste                    (imagen)
 *              relleno{color,degradado} + borde{color,ancho} + radio (forma:
 *                rectángulo para tarjetas, botones dibujados y separadores)
 *              dato + estilo + ficha{fondo,borde,acento} + texto (dato: lo llena
 *                el juego; `texto` es la leyenda del QR y `leyenda` dónde va:
 *                "arriba" | "abajo" | "oculta") }
 *
 * `normalizar*` corrige lo que venga de la base: el editor y la TV nunca
 * reciben un valor que no sepan dibujar.
 */

export const ANCHO = 1920;
export const ALTO = 1080;

/**
 * Tamaño lógico de cada formato. `transparente`: «Sin fondo» deja ver lo de
 * atrás (en el celular, el fondo de la app); en la TV es negro, porque debajo
 * de un juego está el DJ.
 */
export const FORMATOS = {
  tv:      { id: "tv",      ancho: ANCHO, alto: ALTO, transparente: false },
  celular: { id: "celular", ancho: 390,   alto: 640,  transparente: true },
  // Banner arriba de la app (Mensaje / Promo de Lanzar al celular).
  banner:  { id: "banner",  ancho: 390,   alto: 110,  transparente: true },
};
export const MAX_ELEMENTOS = 40;
const TEXTO_MAX = 300;

const num = (v, min, max, def) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Number(v))) : def);
const str = (v, def = "") => (typeof v === "string" ? v : def);
const color = (v, def) => (typeof v === "string" && v.length <= 60 && v.trim() ? v : def);

/**
 * Fondo por defecto de toda pantalla: vacío (negro, sin luces). Los fondos de
 * fábrica de los juegos están en la biblioteca de imágenes, categoría «Fondos».
 */
export const FONDO_BASE = Object.freeze({
  tipo: "ninguno", colores: ["rgba(168,85,247,.14)", "#08040F"], angulo: 160, color: "#08040F",
  imagen: null, ajuste: "cover", oscurecer: 0, orbs: false,
  orbsColores: ["rgba(168,85,247,.18)", "rgba(255,45,120,.1)", "rgba(0,229,255,.06)"],
  confeti: false, marco: null,
});

export function normalizarFondo(f) {
  const tipo = ["ninguno", "radial", "lineal", "color", "imagen"].includes(f?.tipo) ? f.tipo : FONDO_BASE.tipo;
  const imagen = typeof f?.imagen === "string" && f.imagen ? f.imagen : null;
  return {
    tipo: tipo === "imagen" && !imagen ? "ninguno" : tipo,
    colores: [color(f?.colores?.[0], FONDO_BASE.colores[0]), color(f?.colores?.[1], FONDO_BASE.colores[1])],
    angulo: num(f?.angulo, 0, 360, FONDO_BASE.angulo),
    color: color(f?.color, FONDO_BASE.color),
    imagen,
    ajuste: f?.ajuste === "contain" ? "contain" : "cover",
    oscurecer: num(f?.oscurecer, 0, 0.85, 0),
    orbs: typeof f?.orbs === "boolean" ? f.orbs : FONDO_BASE.orbs,
    orbsColores: [0, 1, 2].map((i) => color(f?.orbsColores?.[i], FONDO_BASE.orbsColores[i])),
    confeti: !!f?.confeti,
    marco: color(f?.marco, null),
  };
}

function normalizarEstilo(e) {
  const b = ESTILO_BASE;
  const sub = (o, campos) => (o && typeof o === "object" ? campos(o) : null);
  return {
    fuente: str(e?.fuente, b.fuente) || b.fuente,
    tamano: num(e?.tamano, 8, 600, b.tamano),
    peso: num(e?.peso, 100, 900, b.peso),
    cursiva: !!e?.cursiva, subrayado: !!e?.subrayado, mayus: !!e?.mayus,
    alinear: ["left", "center", "right"].includes(e?.alinear) ? e.alinear : b.alinear,
    interlineado: num(e?.interlineado, 0.6, 3, b.interlineado),
    espaciado: num(e?.espaciado, -0.2, 1, b.espaciado),
    color: color(e?.color, b.color),
    degradado: sub(e?.degradado, (d) => {
      const colores = (Array.isArray(d.colores) ? d.colores : []).slice(0, 6).map((c) => color(c, null)).filter(Boolean);
      return colores.length >= 2 ? { colores, angulo: num(d.angulo, 0, 360, 180) } : null;
    }),
    contorno: sub(e?.contorno, (c) => ({ color: color(c.color, "#000"), ancho: num(c.ancho, 0, 30, 2) })),
    sombra: sub(e?.sombra, (s) => ({ color: color(s.color, "#000"), x: num(s.x, -60, 60, 4), y: num(s.y, -60, 60, 4), blur: num(s.blur, 0, 120, 0) })),
    brillo: sub(e?.brillo, (g) => ({ color: color(g.color, "#FF2D78"), fuerza: num(g.fuerza, 2, 80, 20) })),
  };
}

const IDS_EF_IMG = EFECTOS_IMAGEN.map((e) => e.id);
const IDS_EF_TXT = EFECTOS_TEXTO.map((e) => e.id);

export function normalizarElemento(el, i = 0) {
  const tipo = ["texto", "imagen", "dato", "forma"].includes(el?.tipo) ? el.tipo : null;
  if (!tipo) return null;
  const base = {
    id: str(el.id) || `el-${i}-${Math.random().toString(36).slice(2, 7)}`,
    tipo, nombre: str(el.nombre).slice(0, 40),
    x: Math.round(num(el.x, -ANCHO, ANCHO * 2, 0)), y: Math.round(num(el.y, -ALTO, ALTO * 2, 0)),
    w: Math.round(num(el.w, 1, ANCHO * 3, 400)), h: Math.round(num(el.h, 1, ALTO * 3, 120)),
    rot: num(el.rot, -180, 180, 0), opacidad: num(el.opacidad, 0, 1, 1),
    visible: el.visible !== false,
  };
  if (tipo === "texto") return { ...base, texto: str(el.texto).slice(0, TEXTO_MAX), estilo: normalizarEstilo(el.estilo),
    efecto: IDS_EF_TXT.includes(el.efecto) ? el.efecto : "ninguno" };
  if (tipo === "forma") {
    const d = el.relleno?.degradado;
    const colores = (Array.isArray(d?.colores) ? d.colores : []).slice(0, 4).map((c) => color(c, null)).filter(Boolean);
    return { ...base,
      relleno: { color: color(el.relleno?.color, "rgba(168,85,247,.12)"),
        degradado: colores.length >= 2 ? { colores, angulo: num(d.angulo, 0, 360, 135) } : null },
      borde: { color: color(el.borde?.color, "rgba(168,85,247,.4)"), ancho: num(el.borde?.ancho, 0, 40, 1) },
      radio: num(el.radio, 0, 999, 16), efecto: "ninguno" };
  }
  if (tipo === "imagen") {
    if (typeof el.src !== "string" || !el.src) return null;
    return { ...base, src: el.src, ajuste: el.ajuste === "cover" ? "cover" : "contain",
      efecto: IDS_EF_IMG.includes(el.efecto) ? el.efecto : "ninguno" };
  }
  // `portada`: se ve la imagen del dato (la tapa de la canción). `ajusteTexto`:
  // qué hace el texto que no entra en la caja — "cortar" (…), "lineas" (baja de
  // renglón) o "ajustar" (el tamaño se acomoda a la caja). `proporcion`: el
  // texto secundario (el artista) respecto del principal. `cantidad`: cuántos
  // renglones muestra una lista (las próximas canciones).
  return { ...base, dato: str(el.dato), estilo: normalizarEstilo(el.estilo), texto: str(el.texto).slice(0, TEXTO_MAX),
    portada: el.portada !== false,
    ajusteTexto: ["cortar", "lineas", "ajustar"].includes(el.ajusteTexto) ? el.ajusteTexto : "cortar",
    proporcion: num(el.proporcion, 0.3, 1.5, 0.65),
    cantidad: Math.round(num(el.cantidad, 1, 8, 8)),
    // Formato propio del texto secundario (el artista): sin él, se deriva del
    // principal con `proporcion` y el color «Artista» (ver datosDj.jsx).
    estilo2: el.estilo2 && typeof el.estilo2 === "object" ? normalizarEstilo(el.estilo2) : null,
    leyenda: ["arriba", "abajo", "oculta"].includes(el.leyenda) ? el.leyenda : "arriba",
    ficha: { fondo: color(el.ficha?.fondo, "rgba(168,85,247,.12)"), borde: color(el.ficha?.borde, "rgba(168,85,247,.5)"),
      acento: color(el.ficha?.acento, "#00F5A0") },
    efecto: IDS_EF_TXT.includes(el.efecto) ? el.efecto : "ninguno" };
}

export function normalizarPantalla(p) {
  if (!p || typeof p !== "object") return null;
  const elementos = (Array.isArray(p.elementos) ? p.elementos : [])
    .slice(0, MAX_ELEMENTOS).map(normalizarElemento).filter(Boolean);
  return { fondo: normalizarFondo(p.fondo), elementos };
}

/** `{ <estado>: pantalla }` — descarta los estados que no se puedan dibujar. */
export function normalizarPantallas(v) {
  const out = {};
  for (const [k, p] of Object.entries(v?.pantallas && typeof v.pantallas === "object" ? v.pantallas : {})) {
    if (!/^[a-z][a-z0-9-]{1,30}$/.test(k)) continue;
    const n = normalizarPantalla(p);
    if (n) out[k] = n;
  }
  return out;
}

export const nuevoId = () => `el-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
