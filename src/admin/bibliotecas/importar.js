import { normalizarPalabra, motivoPalabraInvalida } from "../../hooks/realtime/useArmaPalabraRound";

/**
 * Importación de bibliotecas desde .txt / .csv (Arma la Palabra y Desafío).
 *
 * Sólo lee y valida: devuelve qué se puede cargar, qué ya estaba y qué tiene
 * errores (con su línea). El INSERT lo hace el hook de cada biblioteca.
 *
 * Formatos — ver FORMATO_PALABRAS / FORMATO_PREGUNTAS (los muestra el modal).
 * Secciones: en .txt, una línea `# Nombre` (o `[Nombre]`) abre una sección
 * para todo lo que sigue; en .csv, la columna `seccion`.
 */

export const SECCION_MAX = 40;

/** Recorta, colapsa espacios y corta en 40. Vacía → null («Sin sección»). */
export function normalizarSeccion(s) {
  const t = String(s ?? "").replace(/\s+/g, " ").trim().slice(0, SECCION_MAX).trim();
  return t || null;
}

/**
 * Misma sección escrita distinto («animales» / «Animales») = la que ya existe.
 * Así un archivo no parte una sección en dos por una mayúscula.
 */
export function unificarSeccion(s, existentes) {
  const n = normalizarSeccion(s);
  if (!n) return null;
  const clave = n.toLocaleLowerCase("es");
  return existentes.find((e) => e && e.toLocaleLowerCase("es") === clave) || n;
}

/** Secciones presentes en una lista de filas, ordenadas alfabéticamente. */
export function seccionesDe(filas) {
  const set = new Map();
  filas.forEach((f) => { if (f.seccion) set.set(f.seccion, (set.get(f.seccion) || 0) + 1); });
  return [...set.entries()].sort((a, b) => a[0].localeCompare(b[0], "es"))
    .map(([nombre, cuantos]) => ({ nombre, cuantos }));
}

/**
 * Lee el archivo como texto. Excel en castellano suele guardar el CSV en
 * Windows-1252: si UTF-8 deja caracteres rotos (U+FFFD), se relee en ese formato.
 */
export async function leerArchivo(file) {
  const buf = await file.arrayBuffer();
  let txt = new TextDecoder("utf-8").decode(buf);
  if (txt.includes(String.fromCharCode(0xFFFD))) txt = new TextDecoder("windows-1252").decode(buf);
  return txt.replace(new RegExp("^" + String.fromCharCode(0xFEFF)), "").replace(/\r\n?/g, "\n");
}

export const esCsv = (file) => /\.csv$/i.test(file?.name || "");

// ── CSV ────────────────────────────────────────────────────────────────────
// Separador: el que más aparece en las primeras líneas entre ; , | y tab
// (Excel en castellano usa «;»). Respeta comillas dobles y "" escapadas.
function detectarSeparador(texto) {
  const muestra = texto.split("\n").filter((l) => l.trim() && !esTituloSeccion(l)).slice(0, 10).join("\n");
  const candidatos = [";", ",", "\t", "|"];
  return candidatos
    .map((c) => ({ c, n: muestra.split(c).length - 1 }))
    .sort((a, b) => b.n - a.n)[0].c;
}

function parsearCsv(texto, sep) {
  const filas = [];
  let fila = [], celda = "", comillas = false, linea = 1, lineaFila = 1;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (comillas) {
      if (ch === '"' && texto[i + 1] === '"') { celda += '"'; i++; }
      else if (ch === '"') comillas = false;
      else { if (ch === "\n") linea++; celda += ch; }
    } else if (ch === '"') comillas = true;
    else if (ch === sep) { fila.push(celda); celda = ""; }
    else if (ch === "\n") {
      fila.push(celda); filas.push({ celdas: fila, linea: lineaFila });
      fila = []; celda = ""; linea++; lineaFila = linea;
    } else celda += ch;
  }
  if (celda || fila.length) { fila.push(celda); filas.push({ celdas: fila, linea: lineaFila }); }
  return filas
    .map((f) => ({ ...f, celdas: f.celdas.map((c) => c.trim()) }))
    .filter((f) => f.celdas.some((c) => c));
}

const sinAcentos = (s) => String(s || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

// `# Animales`, `[Animales]` o `=== ANIMALES ===` en una línea sola.
function esTituloSeccion(linea) {
  const l = linea.trim();
  return /^#/.test(l) || /^\[.+\]$/.test(l) || /^={2,}.+?={2,}$/.test(l);
}
const nombreTitulo = (linea) => linea.trim()
  .replace(/^#+/, "").replace(/^\[(.*)\]$/, "$1").replace(/^=+(.*?)=+$/, "$1").trim();

// ── Palabras ───────────────────────────────────────────────────────────────

export const FORMATO_PALABRAS = {
  txt: "Una o varias palabras por línea (separadas por espacio o coma). Una línea «# Animales» abre la sección Animales para las palabras que siguen.",
  csv: "Columnas: palabra ; seccion (la sección es opcional). La primera fila puede ser el encabezado.",
  ejemploTxt: "# Animales\nGATO\nPUMA, TIGRE\n\n# Comidas\nTACO\nQUESO\n",
  ejemploCsv: "palabra;seccion\nGATO;Animales\nPUMA;Animales\nTACO;Comidas\n",
};

/**
 * → { items:[{word, seccion}], repetidas:[{linea, texto}], errores:[{linea, texto, motivo}] }
 * `existe(word)` dice si ya está en la biblioteca.
 */
export function parsearPalabras(texto, { csv, seccionPorDefecto, secciones, existe }) {
  const crudas = [];   // {texto, seccion, linea}
  if (csv) {
    const sep = detectarSeparador(texto);
    let filas = parsearCsv(texto, sep);
    let iPal = 0, iSec = 1;
    const enc = filas[0]?.celdas.map(sinAcentos) || [];
    if (enc.some((c) => ["palabra", "palabras", "word"].includes(c))) {
      iPal = enc.findIndex((c) => ["palabra", "palabras", "word"].includes(c));
      iSec = enc.findIndex((c) => ["seccion", "secciones", "categoria"].includes(c));
      filas = filas.slice(1);
    }
    filas.forEach(({ celdas, linea }) =>
      crudas.push({ texto: celdas[iPal] || "", seccion: iSec >= 0 ? celdas[iSec] : null, linea }));
  } else {
    let seccion = null;
    texto.split("\n").forEach((l, i) => {
      if (!l.trim()) return;
      if (esTituloSeccion(l)) { seccion = nombreTitulo(l); return; }
      l.split(/[\s,;|]+/).filter(Boolean).forEach((t) => crudas.push({ texto: t, seccion, linea: i + 1 }));
    });
  }

  const items = [], repetidas = [], errores = [];
  const vistas = new Set();
  crudas.forEach(({ texto: t, seccion, linea }) => {
    const word = normalizarPalabra(t);
    const motivo = motivoPalabraInvalida(word);
    if (motivo) { errores.push({ linea, texto: t, motivo }); return; }
    if (vistas.has(word) || existe(word)) { repetidas.push({ linea, texto: word }); return; }
    vistas.add(word);
    items.push({ word, seccion: unificarSeccion(seccion, secciones) ?? seccionPorDefecto ?? null });
  });
  return { items, repetidas, errores };
}

// ── Preguntas ──────────────────────────────────────────────────────────────

export const FORMATO_PREGUNTAS = {
  txt: "Una pregunta por bloque, separados por una línea en blanco: primero la pregunta y abajo de 2 a 4 respuestas, con «*» adelante de la correcta y «-» adelante de las otras. Una línea «=== FÚTBOL ===» (o «# Fútbol») abre esa sección.",
  csv: "Columnas: pregunta ; opcion_a ; opcion_b ; opcion_c ; opcion_d ; correcta ; seccion. C y D pueden ir vacías. Correcta: A, B, C, D o el número 1 a 4.",
  ejemploTxt: "=== FÚTBOL ===\n\n¿Quién ganó el Mundial 2022?\n* Argentina\n- Francia\n- Brasil\n\n¿Cuántos jugadores tiene un equipo?\n- Diez\n* Once\n\n=== MÚSICA ===\n\n¿Quién canta «Persiana americana»?\n* Soda Stereo\n- Los Redondos\n",
  ejemploCsv: "pregunta;opcion_a;opcion_b;opcion_c;opcion_d;correcta;seccion\n¿Quién ganó el Mundial 2022?;Argentina;Francia;Brasil;;A;Fútbol\n¿Cuántos jugadores tiene un equipo?;Diez;Once;;;B;Fútbol\n",
};

const LETRAS = ["a", "b", "c", "d"];
// «- Francia», «• Francia», «A) Argentina», «b. Francia», «3 - Brasil» → sin el rótulo.
const sinRotulo = (o) => o
  .replace(/^\s*[-–•·]\s*/, "")
  .replace(/^\s*(?:[a-dA-D]|[1-4])\s*[).:-]\s+/, "").trim();

/** Correcta escrita como A–D, 1–4 o el texto de la opción. → índice o null. */
function indiceCorrecta(valor, opts) {
  const v = sinAcentos(valor);
  if (!v) return null;
  if (LETRAS.includes(v)) return LETRAS.indexOf(v);
  if (/^[1-4]$/.test(v)) return Number(v) - 1;
  const i = opts.findIndex((o) => sinAcentos(o) === v);
  return i >= 0 ? i : null;
}

function motivoPregunta({ text, opts, correct }) {
  if (!text) return "Falta el texto de la pregunta.";
  if (opts.length < 2) return "Necesita al menos 2 respuestas.";
  if (opts.length > 4) return "Máximo 4 respuestas.";
  if (correct === null || correct < 0 || correct >= opts.length) return "No se sabe cuál es la respuesta correcta.";
  return null;
}

/**
 * → { items:[{text, opts, correct, seccion}], repetidas, errores } (igual que palabras).
 * `clave(text)` normaliza para comparar duplicados; `existe(text)` mira la biblioteca.
 */
export function parsearPreguntas(texto, { csv, seccionPorDefecto, secciones, existe, clave }) {
  const crudas = [];   // {text, opts, correct, seccion, linea}
  if (csv) {
    const sep = detectarSeparador(texto);
    let filas = parsearCsv(texto, sep);
    let col = { pregunta: 0, opts: [1, 2, 3, 4], correcta: 5, seccion: 6 };
    const enc = filas[0]?.celdas.map(sinAcentos) || [];
    if (enc.includes("pregunta")) {
      const idx = (re) => enc.findIndex((c) => re.test(c));
      col = {
        pregunta: enc.indexOf("pregunta"),
        opts: enc.map((c, i) => (/^(opcion|respuesta)/.test(c) ? i : -1)).filter((i) => i >= 0),
        correcta: idx(/^correct/),
        seccion: idx(/^(seccion|categoria)/),
      };
      filas = filas.slice(1);
    }
    filas.forEach(({ celdas, linea }) => {
      const opts = col.opts.map((i) => sinRotulo(celdas[i] || "")).filter(Boolean);
      crudas.push({
        text: (celdas[col.pregunta] || "").replace(/\s+/g, " ").trim(),
        opts,
        correct: col.correcta >= 0 ? indiceCorrecta(celdas[col.correcta], opts) : null,
        seccion: col.seccion >= 0 ? celdas[col.seccion] : null,
        linea,
      });
    });
  } else {
    let seccion = null, bloque = null;
    const cerrar = () => {
      if (!bloque) return;
      const marcada = bloque.opts.findIndex((o) => o.correcta);
      crudas.push({
        text: bloque.text, opts: bloque.opts.map((o) => o.texto),
        correct: marcada >= 0 ? marcada : null, seccion: bloque.seccion, linea: bloque.linea,
      });
      bloque = null;
    };
    texto.split("\n").forEach((l, i) => {
      if (!l.trim()) { cerrar(); return; }
      if (esTituloSeccion(l)) { cerrar(); seccion = nombreTitulo(l); return; }
      if (!bloque) { bloque = { text: l.replace(/\s+/g, " ").trim(), opts: [], seccion, linea: i + 1 }; return; }
      const marcada = /^\s*\*/.test(l) || /\(x\)\s*$/i.test(l);
      bloque.opts.push({ texto: sinRotulo(l.replace(/^\s*\*/, "").replace(/\(x\)\s*$/i, "")), correcta: marcada });
    });
    cerrar();
  }

  const items = [], repetidas = [], errores = [];
  const vistas = new Set();
  crudas.forEach((q) => {
    const motivo = motivoPregunta(q);
    if (motivo) { errores.push({ linea: q.linea, texto: q.text || "(sin texto)", motivo }); return; }
    const k = clave(q.text);
    if (vistas.has(k) || existe(q.text)) { repetidas.push({ linea: q.linea, texto: q.text }); return; }
    vistas.add(k);
    items.push({ text: q.text, opts: q.opts, correct: q.correct,
      seccion: unificarSeccion(q.seccion, secciones) ?? seccionPorDefecto ?? null });
  });
  return { items, repetidas, errores };
}

/** Descarga un archivo de ejemplo (el formato se entiende mejor viéndolo). */
export function descargarEjemplo(nombre, contenido) {
  const url = URL.createObjectURL(new Blob([String.fromCharCode(0xFEFF) + contenido], { type: "text/plain;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: nombre });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
