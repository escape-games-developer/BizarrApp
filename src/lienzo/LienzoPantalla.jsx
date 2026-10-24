import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { FORMATOS } from "./modelo";
import { FUENTES_CSS, cssDeTexto } from "./estilosTexto";
import { EFECTOS_LIENZO_CSS, efectoLienzo } from "./efectos";
import { marcarLienzo } from "./lienzoActivo";
import { DATOS_JUEGOS, DATOS_JUEGOS_CSS } from "./datosJuegos";

/**
 * Dibuja una pantalla del editor (ver modelo.js). El fondo ocupa todo el
 * contenedor; los elementos viven en un escenario del tamaño lógico del
 * formato. TV: 1920 × 1080 escalado para entrar entero, centrado. Celular:
 * 390 × 640 escalado al ancho de la sección (el alto acompaña). Lo usan la TV,
 * la app del cliente, la vista previa y el editor (que suma la selección).
 *
 * `datos` son los valores en vivo de los elementos «dato» (la palabra, el
 * grupo ganador, la URL del QR); sin ellos se dibuja un ejemplo.
 */

const JUST = { left: "flex-start", center: "center", right: "flex-end" };
const COLORES_CONFETI = ["#FF2D78", "#FFD600", "#9B2FFF", "#00E5FF", "#FF9500", "#00F5A0"];

function Confeti() {
  // Fijo por montaje: las piezas no saltan en cada render.
  const piezas = useMemo(() => Array.from({ length: 80 }, (_, i) => ({
    x: Math.random() * 100, color: COLORES_CONFETI[i % COLORES_CONFETI.length],
    delay: Math.random() * 4, dur: 3 + Math.random() * 3, size: 6 + Math.random() * 8,
  })), []);
  return piezas.map((p, i) => (
    <div key={i} style={{ position: "absolute", top: 0, left: `${p.x}%`, width: p.size, height: p.size * 0.6,
      background: p.color, borderRadius: 2, animation: `lzConfeti ${p.dur}s linear ${p.delay}s infinite` }}/>
  ));
}

export function FondoLienzo({ fondo, transparente = false }) {
  const f = fondo;
  let bg = f.tipo === "ninguno" ? (transparente ? "transparent" : "#000") : f.color;
  if (f.tipo === "radial") bg = `radial-gradient(ellipse at center, ${f.colores[0]}, ${f.colores[1]} 70%)`;
  else if (f.tipo === "lineal") bg = `linear-gradient(${f.angulo}deg, ${f.colores[0]}, ${f.colores[1]})`;
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", background: f.tipo === "imagen" ? "#08040F" : bg }}>
      {f.tipo === "imagen" && f.imagen && (
        <img src={f.imagen} alt="" draggable={false}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: f.ajuste }}/>
      )}
      {f.oscurecer > 0 && <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${f.oscurecer})` }}/>}
      {f.orbs && f.orbsColores.map((c, i) => (
        <div key={i} style={{
          position: "absolute", borderRadius: "50%", filter: "blur(120px)", opacity: .7, background: c,
          width: ["26%", "21%", "18%"][i], aspectRatio: "1", top: ["-10%", "60%", "30%"][i], left: ["-5%", "70%", "40%"][i],
          animation: `lzOrb ${14 + i * 4}s ease-in-out ${i * 3}s infinite`,
        }}/>
      ))}
      {f.confeti && <Confeti/>}
      {f.marco && <div style={{ position: "absolute", inset: 20, borderRadius: 24, border: `1px solid ${f.marco}` }}/>}
    </div>
  );
}

/** Fila de fichas de letras. */
function FilaFichas({ el, letras }) {
  const t = el.estilo.tamano;
  const css = cssDeTexto(el.estilo);
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexWrap: "wrap", alignItems: "center",
      justifyContent: JUST[el.estilo.alinear], alignContent: "center", gap: t * 0.15 }}>
      {letras.map((l, i) => (
        <div key={i} style={{ minWidth: t * 1.1, height: t * 1.5, padding: `0 ${t * 0.16}px`, borderRadius: t * 0.16,
          display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box",
          background: el.ficha.fondo, border: `${Math.max(2, t * 0.05)}px solid ${el.ficha.borde}` }}>
          <span style={{ ...css, lineHeight: 1 }}>{l}</span>
        </div>
      ))}
    </div>
  );
}

const GANADORES_EJEMPLO = [
  { user_id: "a", name: "Vale", avatar_emoji: "💃", assigned_letter: "B" },
  { user_id: "b", name: "Nico", avatar_emoji: "🎸", assigned_letter: "A" },
  { user_id: "c", name: "Sol", avatar_emoji: "🌞", assigned_letter: "R" },
];

/** Palabra en vivo (Arma la palabra), letra por letra. */
function Fichas({ el, datos }) {
  return <FilaFichas el={el} letras={String(datos?.palabra || "PALABRA").split("")}/>;
}

/** Letras del grupo ganador, en el orden en que armaron la palabra. */
function FichasGanadoras({ el, datos }) {
  const grupo = datos?.ganadores?.length ? datos.ganadores : GANADORES_EJEMPLO;
  return <FilaFichas el={el} letras={grupo.map((g) => g.assigned_letter)}/>;
}

/** Una tarjeta por ganador: avatar, nombre y su letra (Arma la palabra) o su número (Sumate). */
function TarjetasGanadores({ el, datos }) {
  const grupo = datos?.ganadores?.length ? datos.ganadores : GANADORES_EJEMPLO;
  const t = el.estilo.tamano;
  const css = cssDeTexto(el.estilo);
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexWrap: "wrap", alignItems: "center",
      justifyContent: JUST[el.estilo.alinear], alignContent: "center", gap: t * 0.7 }}>
      {grupo.map((g) => (
        <div key={g.user_id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: t * 0.25,
          padding: `${t * 0.55}px ${t * 0.8}px`, borderRadius: t * 0.55, background: el.ficha.fondo, border: `1px solid ${el.ficha.borde}` }}>
          <div style={{ fontSize: t * 1.4, lineHeight: 1 }}>{g.avatar_emoji || "👤"}</div>
          <div style={{ ...css, textAlign: "center" }}>{g.name}</div>
          <div style={{ ...css, color: el.ficha.acento, WebkitTextFillColor: el.ficha.acento, backgroundImage: "none",
            fontSize: t * 1.45, lineHeight: 1, textAlign: "center" }}>{g.assigned_letter ?? g.assigned_number}</div>
        </div>
      ))}
    </div>
  );
}

/** La letra de este cliente (Arma la palabra, celular). */
function MiLetra({ el, datos }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: JUST[el.estilo.alinear] }}>
      <div style={{ ...cssDeTexto(el.estilo), lineHeight: 1 }}>{datos?.miLetra ?? "V"}</div>
    </div>
  );
}

/** QR a la app con su leyenda (texto del elemento), arriba, abajo u oculta. */
function Qr({ el, datos }) {
  const url = datos?.qrUrl || `${window.location.origin}/?view=games`;
  const leyenda = el.texto && el.leyenda !== "oculta"
    ? <div style={{ ...cssDeTexto(el.estilo), width: "100%", flexShrink: 0 }}>{el.texto}</div> : null;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", gap: el.estilo.tamano * 0.45 }}>
      {leyenda && el.leyenda === "arriba" && leyenda}
      <div style={{ flex: 1, minHeight: 0, aspectRatio: "1", maxWidth: "100%", background: "#fff", padding: "7%",
        borderRadius: 14, boxShadow: "0 6px 24px rgba(0,0,0,.5)", boxSizing: "border-box", display: "flex" }}>
        <QRCode value={url} style={{ width: "100%", height: "100%" }}/>
      </div>
      {leyenda && el.leyenda === "abajo" && leyenda}
    </div>
  );
}

/** Componentes de los elementos «dato», por id. `leyenda`: tiene texto propio. */
export const DATOS = {
  fichas:            { nombre: "Fichas de la palabra",  Componente: Fichas,            ayuda: "La palabra de la ronda." },
  fichasGanadoras:   { nombre: "Letras ganadoras",      Componente: FichasGanadoras,   ayuda: "Las letras del grupo que armó la palabra." },
  tarjetasGanadores: { nombre: "Tarjetas de ganadores", Componente: TarjetasGanadores, ayuda: "Avatar, nombre y letra (o número) de cada ganador.", acento: true },
  miLetra:           { nombre: "Tu letra",              Componente: MiLetra,           ayuda: "La letra que le tocó a este cliente.", sinFichas: true },
  qr:                { nombre: "QR a la app",           Componente: Qr,                ayuda: "Lleva al celular a la app. Su texto se edita, va arriba o abajo, o se oculta.", leyenda: true, sinFichas: true },
  ...DATOS_JUEGOS,
};

function Contenido({ el, datos }) {
  if (el.tipo === "texto") {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: JUST[el.estilo.alinear] }}>
        <div style={{ ...cssDeTexto(el.estilo), width: "100%" }}>{el.texto}</div>
      </div>
    );
  }
  if (el.tipo === "forma") {
    const r = el.relleno;
    return <div style={{ width: "100%", height: "100%", boxSizing: "border-box", borderRadius: el.radio,
      background: r.degradado ? `linear-gradient(${r.degradado.angulo}deg, ${r.degradado.colores.join(", ")})` : r.color,
      border: el.borde.ancho > 0 ? `${el.borde.ancho}px solid ${el.borde.color}` : "none" }}/>;
  }
  if (el.tipo === "imagen") {
    const filtro = efectoLienzo(el.efecto).filtro;
    return <img src={el.src} alt={el.nombre || ""} draggable={false}
      style={{ width: "100%", height: "100%", objectFit: el.ajuste, display: "block", filter: filtro || undefined }}/>;
  }
  const D = DATOS[el.dato]?.Componente;
  return D ? <D el={el} datos={datos}/> : null;
}

/**
 * Un elemento en su caja. `props` y `children` son del editor: manejadores de
 * puntero y los tiradores de la selección.
 */
export function ElementoLienzo({ el, datos, props, children, z }) {
  const ef = efectoLienzo(el.efecto);
  return (
    <div {...props} style={{
      position: "absolute", left: el.x, top: el.y, width: el.w, height: el.h, zIndex: z,
      transform: el.rot ? `rotate(${el.rot}deg)` : undefined, opacity: el.opacidad,
      ...(props?.style || {}),
    }}>
      <div style={{ width: "100%", height: "100%", animation: ef.anim || undefined, transformOrigin: ef.origen }}>
        <Contenido el={el} datos={datos}/>
      </div>
      {children}
    </div>
  );
}

/**
 * Escala del escenario dentro del contenedor. `soloAncho`: escala al ancho
 * (celular); si no, entra entero (TV).
 */
export function useEscalaLienzo({ ancho, alto }, soloAncho = false) {
  const ref = useRef(null);
  const [escala, setEscala] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const medir = () => setEscala(soloAncho ? el.clientWidth / ancho : Math.min(el.clientWidth / ancho, el.clientHeight / alto));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ancho, alto, soloAncho]);
  return [ref, escala];
}

export const LIENZO_CSS = FUENTES_CSS + EFECTOS_LIENZO_CSS + DATOS_JUEGOS_CSS;

/**
 * `juego`: avisa que esa pantalla trae su propio QR (ver lienzoActivo.js).
 * `formato`: "tv" (por defecto) o "celular".
 */
export default function LienzoPantalla({ pantalla, datos, juego, formato = "tv" }) {
  const fmt = FORMATOS[formato] || FORMATOS.tv;
  const cel = fmt.id === "celular";
  const [ref, escala] = useEscalaLienzo(fmt, cel);
  useEffect(() => {
    if (!juego) return undefined;
    marcarLienzo(juego, true);
    return () => marcarLienzo(juego, false);
  }, [juego]);
  return (
    <div ref={ref} style={cel
      ? { position: "relative", width: "100%", height: fmt.alto * escala, overflow: "hidden" }
      : { position: "absolute", inset: 0, overflow: "hidden" }}>
      <style>{LIENZO_CSS}</style>
      <FondoLienzo fondo={pantalla.fondo} transparente={fmt.transparente}/>
      <div style={{ position: "absolute", width: fmt.ancho, height: fmt.alto,
        ...(cel ? { left: 0, top: 0, transformOrigin: "0 0", transform: `scale(${escala})` }
          : { left: "50%", top: "50%", transform: `translate(-50%,-50%) scale(${escala})` }),
        visibility: escala ? "visible" : "hidden" }}>
        {pantalla.elementos.map((el, i) => el.visible && <ElementoLienzo key={el.id} el={el} datos={datos} z={i + 1}/>)}
      </div>
    </div>
  );
}
