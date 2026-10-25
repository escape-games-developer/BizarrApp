import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cssDeTexto } from "./estilosTexto";
import { TEAMS } from "../constants/theme";
import { segundosRestantes } from "../lib/cierreVotacion";

/**
 * Elementos «dato» de la pantalla del DJ Democracy (fila `lienzo_dj`).
 *
 * Dos son ÁREAS: marcan dónde va algo que la TV dibuja por su cuenta y en el
 * editor se ven como una caja de muestra. La TV no los dibuja como elementos:
 *   djVideo      → los dos reproductores de YouTube. Viven fuera del lienzo
 *                  (desmontarlos corta la música): sólo toman de acá la
 *                  posición, el tamaño y la capa.
 *   djTransicion → dónde aparece el GIF entre canciones; oculto = el área del video.
 *
 * El «Contador Sacar tema» es las dos cosas, según el modo de Sacar tema: en
 * Clásico y Tomatazo se dibuja acá («👎 SACAR TEMA · 3/5» con su barra); en
 * Amor y Odio y Guns & Roses su caja es el área del medidor de KickDualOverlay.
 *
 * El resto (sonando ahora, próximas, evento, código, progreso, estado, aviso de
 * votación cerrada, equipos y GIF del premio) se dibuja en vivo.
 */

export const AREAS_DJ = new Set(["djVideo", "djTransicion"]);

const JUST = { left: "flex-start", center: "center", right: "flex-end" };
const sinDegradado = (color) => ({ color, WebkitTextFillColor: color, backgroundImage: "none" });

const SONANDO_EJEMPLO = { title: "Bohemian Rhapsody", artist: "Queen", cover_url: "https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg" };
const PROXIMAS_EJEMPLO = [
  { id: "1", title: "Mr. Brightside", artist: "The Killers", score: 12 },
  { id: "2", title: "Lamento boliviano", artist: "Enanitos Verdes", score: 8 },
  { id: "3", title: "Seven Nation Army", artist: "The White Stripes", score: 3 },
  { id: "4", title: "Cumbia de los trapos", artist: "Damas Gratis", score: 0 },
  { id: "5", title: "Despacito", artist: "Luis Fonsi", score: -2 },
  { id: "6", title: "Persiana americana", artist: "Soda Stereo", score: -3 },
  { id: "7", title: "La bamba", artist: "Los Lobos", score: -5 },
  { id: "8", title: "Matador", artist: "Los Fabulosos Cadillacs", score: -6 },
];

/** Caja de muestra de un área (sólo en el editor). */
const area = (icono, texto, fondo, borde) => function Area() {
  return (
    <div style={{ width: "100%", height: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center",
      gap: 16, background: fondo, border: `4px dashed ${borde}`, color: "rgba(240,232,255,.75)", overflow: "hidden",
      fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 30, textAlign: "center", padding: 12 }}>
      <span style={{ fontSize: 44 }}>{icono}</span>{texto}
    </div>
  );
};

/**
 * Factor de tamaño para «Ajustar al contenedor»: cuánto hay que achicar el
 * texto (medido a su tamaño de base en `medidaRef`, sin cortes) para que entre;
 * nunca lo agranda: el tamaño elegido es el máximo. La caja es `espacioRef`
 * (ancho) y `cajaRef` menos `relleno` (alto).
 */
function useFactorAjuste(activo, claves, relleno) {
  const cajaRef = useRef(null), espacioRef = useRef(null), medidaRef = useRef(null);
  const [factor, setFactor] = useState(1);
  useLayoutEffect(() => {
    if (!activo) { setFactor(1); return undefined; }
    const medir = () => {
      const caja = cajaRef.current, espacio = espacioRef.current, medida = medidaRef.current;
      if (!caja || !espacio || !medida || !medida.scrollWidth || !medida.scrollHeight) return;
      const f = Math.min(espacio.clientWidth / medida.scrollWidth, (caja.clientHeight - relleno * 2) / medida.scrollHeight);
      setFactor(Math.max(0.05, Math.min(1, Math.floor(f * 1000) / 1000)));
    };
    // Sin caja (el elemento no tiene nada que mostrar: no hay canción, no hay
    // votación) no hay nada que medir. Sin esta guarda, ResizeObserver tiraba
    // abajo la pantalla entera.
    if (!cajaRef.current) return undefined;
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(cajaRef.current);
    return () => ro.disconnect();
  }, [activo, relleno, ...claves]); // eslint-disable-line react-hooks/exhaustive-deps
  return { cajaRef, espacioRef, medidaRef, factor };
}

const CORTE = {
  cortar:  { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  lineas:  { overflow: "hidden", whiteSpace: "normal", overflowWrap: "anywhere" },
  ajustar: { whiteSpace: "nowrap" },
};

/**
 * Portada, título y artista de la canción al aire. Título = formato del texto;
 * artista = color «Artista» y `proporcion` del tamaño del título. `portada`
 * la muestra u oculta; `ajusteTexto` decide qué hace el texto que no entra.
 */
function Sonando({ el, datos }) {
  const s = datos?.sonando || (datos?.vivo ? null : SONANDO_EJEMPLO);
  const t = el.estilo.tamano;
  const prop = el.proporcion;
  const ajustar = el.ajusteTexto === "ajustar";
  const relleno = t * 0.5;
  const { cajaRef, espacioRef, medidaRef, factor } = useFactorAjuste(ajustar,
    [s?.title, s?.artist, t, prop, el.portada, el.estilo.fuente, el.estilo.peso, el.estilo.espaciado, el.w, el.h], relleno);
  if (!s) return null;
  const css = cssDeTexto(el.estilo);
  const portada = el.portada && (s.cover_url || (s.youtube_id ? `https://i.ytimg.com/vi/${s.youtube_id}/hqdefault.jpg` : null));
  const corte = CORTE[el.ajusteTexto] || CORTE.cortar;
  const artista = { ...css, ...sinDegradado(el.ficha.acento), fontWeight: 400, textShadow: "none" };
  const lineas = (f) => (<>
    <div style={{ ...css, fontSize: t * f, ...corte }}>{s.title}</div>
    {s.artist && <div style={{ ...artista, fontSize: t * prop * f, marginTop: t * 0.15 * f, ...corte }}>{s.artist}</div>}
  </>);
  return (
    <div ref={cajaRef} style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: JUST[el.estilo.alinear],
      gap: t * 0.6, padding: relleno, boxSizing: "border-box", borderRadius: t * 0.4, background: el.ficha.fondo, border: `1px solid ${el.ficha.borde}`, overflow: "hidden" }}>
      {portada && <img src={portada} alt="" style={{ height: "78%", aspectRatio: "1", borderRadius: t * 0.3, objectFit: "cover", flexShrink: 0 }}/>}
      <div ref={espacioRef} style={{ minWidth: 0, textAlign: el.estilo.alinear, ...(ajustar || el.ajusteTexto === "lineas" ? { flex: 1 } : {}) }}>
        {lineas(ajustar ? factor : 1)}
      </div>
      {/* Medida del texto a su tamaño de base, sin cortes (sólo «Ajustar»). */}
      {ajustar && (
        <div ref={medidaRef} aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, visibility: "hidden", pointerEvents: "none",
          width: "max-content", whiteSpace: "nowrap" }}>{lineas(1)}</div>
      )}
    </div>
  );
}

/**
 * Las próximas canciones con su puntaje. `texto` es el título de la lista (en
 * el color «Título»). TODO el texto usa el formato del elemento — título,
 * números, canciones y puntajes —; sólo cambian los colores. `proporcion` es
 * el tamaño del artista, `cantidad` cuántas canciones y `ajusteTexto` qué hace
 * el texto que no entra (como en «Sonando ahora»).
 */
function Proximas({ el, datos }) {
  const lista = (datos?.proximas || (datos?.vivo ? [] : PROXIMAS_EJEMPLO)).slice(0, el.cantidad);
  const t = el.estilo.tamano;
  const ajustar = el.ajusteTexto === "ajustar";
  const relleno = t * 0.7;
  const { cajaRef, espacioRef, medidaRef, factor } = useFactorAjuste(ajustar,
    [lista.map((x) => `${x.id}${x.title}${x.artist}${x.score}`).join("|"), el.texto, t, el.proporcion, el.cantidad,
      el.estilo.fuente, el.estilo.peso, el.estilo.espaciado, el.w, el.h], relleno);
  const css = cssDeTexto(el.estilo);
  const corte = CORTE[el.ajusteTexto] || CORTE.cortar;
  const color = (c) => ({ ...css, ...sinDegradado(c), fontVariantNumeric: "tabular-nums" });
  const contenido = (f) => (<>
    {el.texto && <div style={{ ...color(el.ficha.acento), fontSize: t * 1.05 * f, lineHeight: 1.1, flexShrink: 0,
      ...(el.ajusteTexto === "cortar" ? {} : corte) }}>{el.texto}</div>}
    {!lista.length && <div style={{ ...css, fontSize: t * f, opacity: 0.4, ...corte }}>Esperando que el DJ cargue la lista…</div>}
    {lista.map((item, i) => (
      <div key={item.id} style={{ display: "flex", alignItems: "center", gap: t * 0.6 * f, padding: `${t * 0.35 * f}px ${t * 0.45 * f}px`, flexShrink: 0,
        borderRadius: t * 0.4 * f, background: i === 0 ? "rgba(255,214,0,.09)" : el.ficha.fondo,
        border: `1px solid ${i === 0 ? "rgba(255,214,0,.28)" : el.ficha.borde}` }}>
        <span style={{ ...color(i === 0 ? "#FFD600" : "rgba(240,232,255,.28)"), fontSize: t * f, minWidth: t * 1.2 * f, textAlign: "center", flexShrink: 0 }}>{i + 1}</span>
        <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <div style={{ ...css, fontSize: t * f, ...corte }}>{item.title}</div>
          <div style={{ ...color("rgba(240,232,255,.35)"), fontSize: t * el.proporcion * f, fontWeight: 400, ...corte }}>{item.artist || "—"}</div>
        </div>
        <span style={{ ...color(item.score > 0 ? "#00F5A0" : item.score < 0 ? "#FF2D78" : "rgba(240,232,255,.25)"), fontSize: t * f,
          flexShrink: 0 }}>{item.score > 0 ? `+${item.score}` : item.score}</span>
      </div>
    ))}
  </>);
  const columna = (f) => ({ display: "flex", flexDirection: "column", gap: t * 0.45 * f });
  return (
    <div ref={cajaRef} style={{ position: "relative", width: "100%", height: "100%", boxSizing: "border-box", padding: relleno, overflow: "hidden" }}>
      <div ref={espacioRef} style={{ ...columna(ajustar ? factor : 1), width: "100%" }}>{contenido(ajustar ? factor : 1)}</div>
      {/* Medida de la lista a su tamaño de base, sin cortes (sólo «Ajustar»). */}
      {ajustar && (
        <div ref={medidaRef} aria-hidden="true" style={{ ...columna(1), position: "absolute", left: 0, top: 0, visibility: "hidden",
          pointerEvents: "none", width: "max-content", whiteSpace: "nowrap" }}>{contenido(1)}</div>
      )}
    </div>
  );
}

const textoEnVivo = (leer, ejemplo) => function Texto({ el, datos }) {
  const v = datos ? leer(datos) : null;
  const texto = v ?? (datos?.vivo ? "" : ejemplo);
  const valor = el.texto && el.texto.includes("{}") ? el.texto.split("{}").join(texto) : el.texto || texto;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: JUST[el.estilo.alinear] }}>
      <div style={{ ...cssDeTexto(el.estilo), width: "100%" }}>{valor}</div>
    </div>
  );
};

// ── Barra de progreso ──────────────────────────────────────────────────────
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * Cuánto lleva la canción. La TV reporta su tiempo cada pocos segundos
 * (`datos.progreso = { actual, total, al, sonando }`, `al` = cuándo llegó): entre
 * reporte y reporte se adelanta sola. Pista = «Fondo», relleno = «Relleno»,
 * borde = «Borde». `texto` muestra los tiempos: «{}» → «1:23 / 3:45».
 */
function Progreso({ el, datos }) {
  const p = datos?.progreso || (datos?.vivo ? null : { actual: 95, total: 225, al: 0, sonando: false });
  const [ahora, setAhora] = useState(() => Date.now());
  const avanza = !!(p?.sonando && p.total > 0);
  useEffect(() => {
    if (!avanza) return undefined;
    const id = setInterval(() => setAhora(Date.now()), 500);
    return () => clearInterval(id);
  }, [avanza]);
  if (!p || !(p.total > 0)) return null;
  const actual = Math.min(p.total, p.actual + (avanza ? Math.max(0, ahora - p.al) / 1000 : 0));
  const pct = (actual / p.total) * 100;
  const t = el.estilo.tamano;
  const tiempos = el.texto ? conPlantillaDj(el.texto, `${mmss(actual)} / ${mmss(p.total)}`) : null;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: t * 0.6 }}>
      <div style={{ flex: 1, height: "100%", minHeight: 2, borderRadius: 999, overflow: "hidden", boxSizing: "border-box",
        background: el.ficha.fondo, border: `1px solid ${el.ficha.borde}` }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: el.ficha.acento, transition: "width .5s linear" }}/>
      </div>
      {tiempos && <span style={{ ...cssDeTexto(el.estilo), whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{tiempos}</span>}
    </div>
  );
}

const conPlantillaDj = (plantilla, valor) => (plantilla.includes("{}") ? plantilla.split("{}").join(valor) : plantilla);

// ── Estado de la votación ─────────────────────────────────────────────────
/**
 * Cómo está la votación ahora: "apagada" (el DJ la apagó), "cerrada" (los
 * últimos segundos de la canción: se cerró sola, ver lib/cierreVotacion.js),
 * "congelada" (BLOQUEAR del DJ: el ranking visible quieto, los votos siguen) o
 * "abierta", con los segundos que faltan. En vivo se recalcula cada 250 ms a
 * partir de la fila del evento (`datos.cierreEvento`); en el editor manda
 * `datos.votacion` (o el ejemplo).
 */
function useEstadoVotacion(datos, ejemplo) {
  const ev = datos?.vivo ? datos.cierreEvento || null : null;
  const [ahora, setAhora] = useState(() => Date.now());
  const conReloj = !!ev && (Number(ev.vote_close_seconds) || 0) > 0 && !!ev.current_item_id;
  useEffect(() => {
    if (!conReloj) return undefined;
    const id = setInterval(() => setAhora(Date.now()), 250);
    return () => clearInterval(id);
  }, [conReloj]);
  if (!ev) return { estado: datos?.votacion || ejemplo, restante: datos?.vivo ? null : 3 };
  if (ev.voting_disabled) return { estado: "apagada", restante: null };
  const restante = conReloj ? segundosRestantes(ev, ahora) : null;
  if (restante !== null && restante <= Number(ev.vote_close_seconds)) return { estado: "cerrada", restante };
  return { estado: ev.voting_frozen ? "congelada" : "abierta", restante };
}

// ── Pastillas de estado ───────────────────────────────────────────────────
const VOTACION = {
  abierta:   { texto: "VOTACIÓN ABIERTA", punto: "#00F5A0" },
  cerrada:   { texto: "VOTACIÓN CERRADA", punto: "#00E5FF" },
  congelada: { texto: "RANKING CONGELADO", punto: "#00E5FF" },
  apagada:   { texto: "VOTACIÓN APAGADA", punto: "rgba(240,232,255,.35)" },
};

/** «● EN VIVO» y el estado de la votación, cada uno en su pastilla (Fondo / Borde). */
function Estado({ el, datos }) {
  const enVivo = datos?.vivo ? !!datos.enVivo : datos?.enVivo ?? true;
  const v = VOTACION[useEstadoVotacion(datos, "abierta").estado] || VOTACION.abierta;
  const t = el.estilo.tamano;
  const css = cssDeTexto(el.estilo);
  const pastilla = (punto, texto) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: t * 0.45, padding: `${t * 0.35}px ${t * 0.7}px`, borderRadius: 999,
      background: el.ficha.fondo, border: `1px solid ${el.ficha.borde}`, whiteSpace: "nowrap" }}>
      <span style={{ width: t * 0.55, height: t * 0.55, borderRadius: "50%", background: punto, boxShadow: `0 0 ${t * 0.5}px ${punto}`, flexShrink: 0 }}/>
      <span style={css}>{texto}</span>
    </span>
  );
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexWrap: "wrap", alignItems: "center", alignContent: "center",
      justifyContent: JUST[el.estilo.alinear], gap: t * 0.5 }}>
      {pastilla(enVivo ? "#FF2D78" : "rgba(240,232,255,.35)", enVivo ? "EN VIVO" : "FUERA DE VIVO")}
      {pastilla(v.punto, v.texto)}
    </div>
  );
}

// ── Aviso de votación cerrada ─────────────────────────────────────────────
/**
 * Como el DJ Democracy original: en los últimos segundos de cada canción la
 * votación se cierra sola y aparece este cartel — el título (`texto`, de
 * fábrica «❄ VOTACIÓN CERRADA — PREPARANDO PRÓXIMA») y la cuenta regresiva
 * grande debajo. También si el DJ apaga la votación (sin cuenta). Abierta o con
 * el ranking congelado, no se ve. En el editor se ve con «3s» de ejemplo.
 */
function VotacionCerrada({ el, datos }) {
  const enVivo = useEstadoVotacion(datos, "cerrada");
  // En el editor se ve siempre (con «3s» de ejemplo) para poder diseñarlo; el ⚠
  // del editor dice cuándo aparece de verdad.
  const { estado, restante } = datos?.vivo ? enVivo
    : { estado: datos?.votacion === "apagada" ? "apagada" : "cerrada", restante: 3 };
  if (estado !== "cerrada" && estado !== "apagada") return null;
  const t = el.estilo.tamano;
  const css = cssDeTexto(el.estilo);
  const titulo = estado === "apagada" ? "VOTACIÓN APAGADA" : el.texto || "❄ VOTACIÓN CERRADA — PREPARANDO PRÓXIMA";
  const cuenta = estado === "cerrada" && restante !== null ? `${Math.max(0, Math.ceil(restante))}s` : null;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "center",
      gap: t * 0.15, boxSizing: "border-box", padding: `0 ${t * 0.6}px`, borderRadius: t * 0.4, background: el.ficha.fondo,
      border: `2px solid ${el.ficha.borde}`, overflow: "hidden" }}>
      <div style={{ ...css, fontSize: cuenta ? t * 0.45 : t, letterSpacing: cuenta ? "0.25em" : css.letterSpacing,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{titulo}</div>
      {cuenta && <div style={{ ...css, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{cuenta}</div>}
    </div>
  );
}

// ── Marcador de equipos ───────────────────────────────────────────────────
// Los equipos de la app (profiles.team): los mismos del Desafío Demente.
const EQUIPOS_EJEMPLO = [
  { id: "batata",    name: TEAMS.batata.name,    icon: TEAMS.batata.emoji,    color: TEAMS.batata.color,    points: 128 },
  { id: "membrillo", name: TEAMS.membrillo.name, icon: TEAMS.membrillo.emoji, color: TEAMS.membrillo.color, points: 97 },
];

/**
 * Team Batata y Team Membrillo (`datos.equipos`, del marcador del motor): una
 * tarjeta por equipo (Fondo / Borde) con su ícono, su nombre en el color del
 * equipo y sus puntos (color «Puntos», que también marca al que va ganando).
 * Con equipos apagados no se ve.
 */
function Equipos({ el, datos }) {
  const equipos = datos?.equipos || (datos?.vivo ? [] : EQUIPOS_EJEMPLO);
  if (!equipos.length) return null;
  const t = el.estilo.tamano;
  const css = cssDeTexto(el.estilo);
  const lider = Math.max(...equipos.map((e) => e.points || 0));
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center",
      gap: t * 0.5 }}>
      {equipos.map((e) => (
        <div key={e.id} style={{ minWidth: 0, display: "flex", alignItems: "center", gap: t * 0.4, padding: `${t * 0.4}px ${t * 0.6}px`,
          borderRadius: t * 0.5, boxSizing: "border-box", background: el.ficha.fondo,
          border: `${e.points === lider && lider > 0 ? 2 : 1}px solid ${e.points === lider && lider > 0 ? el.ficha.acento : el.ficha.borde}` }}>
          {e.icon && <span style={{ fontSize: t * 1.2, lineHeight: 1, flexShrink: 0 }}>{e.icon}</span>}
          <span style={{ ...css, ...(e.color ? sinDegradado(e.color) : {}), flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis",
            whiteSpace: "nowrap", textAlign: "left" }}>{e.name}</span>
          <span style={{ ...css, ...sinDegradado(el.ficha.acento), fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{e.points ?? 0}</span>
        </div>
      ))}
    </div>
  );
}

// ── GIF a pantalla (premio) ───────────────────────────────────────────────
/**
 * El GIF que manda a la TV quien ganó el premio «GIF a pantalla», con su
 * nombre debajo (`datos.gifPremio = { url, nombre }`). Sin premio al aire no
 * se ve. `texto` es la leyenda: «{}» → el nombre.
 */
function GifPremio({ el, datos }) {
  const g = datos?.gifPremio || (datos?.vivo ? null : { url: datos?.gifEjemplo || null, nombre: "Vale" });
  if (!g) return null;
  const t = el.estilo.tamano;
  const leyenda = conPlantillaDj(el.texto || "{}", g.nombre || "");
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: t * 0.4, boxSizing: "border-box",
      padding: t * 0.4, borderRadius: t * 0.6, background: el.ficha.fondo, border: `1px solid ${el.ficha.borde}` }}>
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: t * 0.4 }}>
        {g.url ? <img src={g.url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }}/>
          : <span style={{ fontSize: t * 3 }}>🎞</span>}
      </div>
      {leyenda && <div style={{ ...cssDeTexto(el.estilo), flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{leyenda}</div>}
    </div>
  );
}

// ── Contador Sacar tema ───────────────────────────────────────────────────
/**
 * Clásico y Tomatazo: «👎 SACAR TEMA · 3/5» (plantilla, «{}» = votos/necesarios)
 * y una barra (Relleno = «Barra», pista = Borde) sobre el Fondo
 * (`datos.kick = { modo: "porcentaje" | "dual", votos, necesarios, visible }`).
 * En Amor y Odio / Guns & Roses no dibuja nada: su caja la usa el medidor de
 * KickDualOverlay. Sin votación o con poca gente conectada, no se ve.
 */
function Contador({ el, datos }) {
  const k = datos?.kick || (datos?.vivo ? null : { modo: "porcentaje", votos: 3, necesarios: 5, visible: true });
  // El texto va en un renglón y nunca se pasa de la caja: el tamaño elegido es
  // el máximo (un contador guardado cuando era sólo un área trae el genérico).
  const t = Math.min(el.estilo.tamano, el.h * 0.42);
  const texto = k ? conPlantillaDj(el.texto || "👎 SACAR TEMA · {}", `${k.votos}/${k.necesarios}`) : "";
  const { cajaRef, espacioRef, medidaRef, factor } = useFactorAjuste(true,
    [texto, t, el.estilo.fuente, el.estilo.peso, el.estilo.espaciado, el.w, el.h], t * 0.3);
  if (!k || k.modo !== "porcentaje" || !k.visible) return null;
  const pct = Math.min(100, (k.votos / Math.max(1, k.necesarios)) * 100);
  const css = { ...cssDeTexto({ ...el.estilo, tamano: t }), fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
  return (
    <div ref={cajaRef} style={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center",
      gap: t * 0.3, padding: `${t * 0.3}px ${t * 0.7}px`, boxSizing: "border-box", borderRadius: t * 0.5, background: el.ficha.fondo, overflow: "hidden" }}>
      <div ref={espacioRef} style={{ ...css, fontSize: t * factor }}>{texto}</div>
      <div style={{ height: Math.max(4, t * 0.28), borderRadius: 999, background: el.ficha.borde, overflow: "hidden", flexShrink: 0 }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: el.ficha.acento, transition: "width .4s ease" }}/>
      </div>
      <div ref={medidaRef} aria-hidden="true" style={{ ...css, position: "absolute", left: 0, top: 0, visibility: "hidden", width: "max-content" }}>{texto}</div>
    </div>
  );
}

export const DATOS_DJ = {
  djVideo:      { nombre: "Video del DJ", Componente: area("🎬", "Video del DJ", "linear-gradient(135deg,#1a1030,#0b0716)", "rgba(0,229,255,.55)"),
                  sinFichas: true, sinTexto: true, sinEfecto: true,
                  ayuda: "Dónde se ve el video que suena. Con FTL, PT o una tanda de YouTube pasa a pantalla completa." },
  djContador:   { nombre: "Contador Sacar tema", Componente: Contador, plantilla: true, acento: true, acentoNombre: "Barra",
                  ayuda: "Clásico y Tomatazo: los votos para sacar el tema y cuántos hacen falta («{}» se ve «3/5»), con su barra. "
                    + "Amor y Odio y Guns & Roses: en esta caja aparece su medidor. Sin votación de Sacar tema, no se ve." },
  djTransicion: { nombre: "Transición entre canciones", Componente: area("✨", "Transición entre canciones", "rgba(155,47,255,.15)", "rgba(155,47,255,.7)"),
                  sinFichas: true, sinTexto: true, sinEfecto: true,
                  ayuda: "Dónde aparece el GIF entre canciones. Si está oculta, el GIF cubre el área del video." },
  djSonando:    { nombre: "Sonando ahora", Componente: Sonando, acento: true, acentoNombre: "Artista", portada: true, ajusteTexto: true,
                  secundario: "Tamaño del artista", formato: "Formato del texto",
                  ayuda: "Portada, título y artista de la canción al aire. El formato es el del título." },
  djProximas:   { nombre: "Próximas canciones", Componente: Proximas, acento: true, acentoNombre: "Título", titulo: true,
                  ajusteTexto: true, secundario: "Tamaño del artista", formato: "Formato del texto", cantidad: true,
                  ayuda: "Las próximas canciones de la lista con su puntaje (hasta 8). Todo el texto usa el formato del elemento." },
  djEvento:     { nombre: "Nombre del evento", Componente: textoEnVivo((d) => (d.evento ? `${d.evento.nombre} · ${d.evento.codigo}` : null),
                  "Pantalla Bizarren · LDR4X3"), plantilla: true, sinFichas: true, ayuda: "El nombre y el código del evento." },
  djCodigo:     { nombre: "Código del evento", Componente: textoEnVivo((d) => d.evento?.codigo, "LDR4X3"), plantilla: true, sinFichas: true,
                  ayuda: "El código para entrar a votar sin escanear el QR." },
  djProgreso:   { nombre: "Barra de progreso", Componente: Progreso, plantilla: true, acento: true, acentoNombre: "Relleno",
                  ayuda: "Cuánto lleva la canción al aire. El texto muestra los tiempos: «{}» se ve «1:23 / 3:45»; vacío = sólo la barra." },
  djEstado:     { nombre: "Pastillas de estado", Componente: Estado,
                  ayuda: "«● EN VIVO» y si la votación está abierta, cerrada o apagada." },
  djVotacionCerrada: { nombre: "Aviso de votación cerrada", Componente: VotacionCerrada, titulo: true,
                  ayuda: "En los últimos segundos de cada canción la votación se cierra sola (DJ Democracy → Editor → Votación): aparece con la cuenta regresiva. También si el DJ apaga la votación. El título es lo que dice arriba de la cuenta." },
  djEquipos:    { nombre: "Marcador de equipos", Componente: Equipos, acento: true, acentoNombre: "Puntos",
                  ayuda: "Team Batata y Team Membrillo (los del perfil, como en el Desafío Demente) con los puntos que suman en el DJ. El que va ganando se marca con el color «Puntos». Con equipos apagados no se ve." },
  djGifPremio:  { nombre: "GIF a pantalla (premio)", Componente: GifPremio, plantilla: true,
                  ayuda: "El GIF de la galería del DJ que elige quien usa el premio «GIF a pantalla», con su nombre («{}»). Se ve el tiempo que dice el Admin; sin premio al aire, no se ve." },
};
