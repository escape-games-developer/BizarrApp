import { useEffect, useRef } from "react";
import { cssDeTexto } from "./estilosTexto";
import FtlBarometro from "../components/FtlBarometro";
import { efectoDuelo, escalaDeZoom, EFECTOS_CSS } from "../constants/efectosPantalla";
import { ColumnaDuelo, EfectosDuelo } from "../bigscreen/dueloColumna";

/**
 * Elementos «dato» del Duelo de Talentos (fila `lienzo_duelo`), TV y celular.
 *
 * ÁREAS de la TV durante la votación (las dibuja DueloBigscreen en su caja,
 * fuera del escenario escalado): el video de la ronda y los «Efectos del
 * duelista» (partículas, brillo y la lluvia de 👍 que vuela hasta su cara).
 * Lo demás de cada duelista son piezas sueltas: el fondo (una imagen webp
 * común), la cara, el nombre, el 👍 % y el barómetro.
 *
 * `duColumna1/2` es la columna entera de antes (fondo + todo); la siguen
 * dibujando los diseños guardados que no pasaron por el editor nuevo
 * (ver separarColumnas en juegos/duelo.js).
 *
 * El logo del centro sigue saliendo de «Pantalla del duelo» (texto o imagen,
 * efecto y zoom). En el celular, los botones para votar / tocar llegan
 * armados (`datos.panel`): se ubican, se agrandan y se ocultan.
 *
 * datos = { d1, d2, pct: {p1, p2}, seg, centro (config de pantalla), result,
 *           ganador, panel (nodo), postular, cargando, estado, saldo, consigna }
 */

export const AREAS_DUELO = new Set(["duVideo", "duColumna1", "duColumna2", "duEfectos1", "duEfectos2"]);

const JUST = { left: "flex-start", center: "center", right: "flex-end" };
export const COLOR_P1 = "#ff1688";
export const COLOR_P2 = "#ff8a00";
const D1 = { name: "Vale", avatar_emoji: "💃" };
const D2 = { name: "Nico", avatar_emoji: "🎸" };
const sinDegradado = (color) => ({ color, WebkitTextFillColor: color, backgroundImage: "none" });

const area = (icono, texto, color) => function Area() {
  return (
    <div style={{ width: "100%", height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", gap: 14, background: `${color}22`, border: `4px dashed ${color}`, color: "rgba(240,232,255,.8)",
      fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 28, textAlign: "center", padding: 12, overflow: "hidden" }}>
      <span style={{ fontSize: 56 }}>{icono}</span>{texto}
    </div>
  );
};

/** Columna de un duelista, la de la TV (barómetro y 👍 % de «Pantalla del duelo»). */
const columna = (slot) => function Columna({ datos }) {
  return <ColumnaDuelo slot={slot} config={datos?.centro}/>;
};

/** «Efectos del duelista» en el editor: los de la TV, de muestra. */
const efectos = (slot) => function Efectos() {
  return <EfectosDuelo slot={slot}/>;
};

/**
 * Cara de un duelista (foto o avatar) en su aro, del color de su lado. Con
 * `slot`, en la votación en vivo (`datos.duelo`): es el blanco de la lluvia
 * de 👍, late con cada voto y lleva la 👑 si va ganando.
 */
const cara = (leer, colorDe, slot = null) => function Cara({ el, datos }) {
  const vivo = slot && datos?.duelo;
  const flash = useRef(null);
  const aro = useRef(null);
  const pulso = vivo ? datos.duelo.pulsos[slot] : null;
  useEffect(() => {
    if (!pulso?.key) return;
    const ref = datos.duelo.avatarRefs[slot];
    ref.current?.animate([{ transform: "scale(1)" }, { transform: `scale(${pulso.big ? 1.1 : 1.06})` }, { transform: "scale(1)" }],
      { duration: 380, easing: "ease-out" });
    flash.current?.animate([{ transform: "scale(.6)", opacity: pulso.big ? 0.85 : 0.6 },
      { transform: `scale(${pulso.big ? 2.4 : 1.8})`, opacity: 0 }], { duration: 460, easing: "ease-out" });
  }, [pulso?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const s = datos?.vivo ? leer(datos) : leer({ d1: D1, d2: D2, ganador: D1, result: "p1" });
  if (!s) return null;
  const lado = Math.min(el.w, el.h);
  const a = el.avatar || AVATAR_BASE;
  const col = a.color || colorDe(datos?.vivo ? datos : { result: "p1" }) || el.ficha.borde;
  const radio = { circulo: "50%", redondeado: "22%", cuadrado: "0" }[a.forma] || "50%";
  const lider = vivo && datos.duelo.lider === slot;
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {slot && <div ref={flash} style={{ position: "absolute", width: lado, height: lado, borderRadius: radio, opacity: 0,
        background: `radial-gradient(circle, ${col}cc, transparent 70%)`, transform: "scale(0)", pointerEvents: "none" }}/>}
      {slot && lider && (
        <div style={{ position: "absolute", top: `calc(50% - ${lado * 0.5 + lado * 0.36}px)`, left: "50%", fontSize: lado * 0.36,
          lineHeight: 1, transform: "translateX(-50%) rotate(-8deg)", filter: `drop-shadow(0 0 8px ${col})` }}>👑</div>
      )}
      <div ref={vivo ? datos.duelo.avatarRefs[slot] : aro} style={{ position: "relative", width: lado, height: lado, flexShrink: 0 }}>
        <div style={{ width: "100%", height: "100%", borderRadius: radio, boxSizing: "border-box", overflow: "hidden", display: "flex",
          alignItems: "center", justifyContent: "center", fontSize: lado * 0.46, background: a.fondo,
          border: a.grosor > 0 ? `${Math.max(1, lado * a.grosor / 100)}px solid ${col}` : "none",
          boxShadow: a.brillo > 0 ? `0 0 ${lado * a.brillo / 100}px ${col}66` : "none" }}>
          {s.photo_url ? <img src={s.photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/> : s.avatar_emoji || "🎤"}
        </div>
        {a.marco && <img src={a.marco} alt="" draggable={false}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" }}/>}
      </div>
      {vivo && datos.duelo.popups.filter((p) => p.slot === slot).map((p) => (
        <div key={p.id} style={{ position: "absolute", top: `calc(50% - ${lado * 0.55}px)`, [slot === 1 ? "right" : "left"]: 0,
          fontFamily: "Syne, sans-serif", fontWeight: 800, color: col, fontSize: lado * (p.big ? 0.3 : 0.22),
          textShadow: `0 2px 8px ${col}`, animation: "dueloVotePopup .8s ease-out forwards" }}>{p.text}</div>
      ))}
    </div>
  );
};

const AVATAR_BASE = { forma: "circulo", color: null, grosor: 3, brillo: 25, fondo: "rgba(20,8,30,.6)", marco: null };

/** Barómetro vertical del duelista (el de Follow the Leader, sin decaer). */
const barometro = (slot) => function Barometro({ datos }) {
  const pct = datos?.vivo ? datos.pct?.[`p${slot}`] ?? 0 : slot === 1 ? 58 : 42;
  return <FtlBarometro pct={pct} tamano="tv" decae={false}/>;
};

/** «👍 58 %» del duelista; se apaga con «Porcentajes» de Pantalla del duelo. */
const porcentaje = (slot) => (d) => (!d.d1 ? undefined : d.centro?.porcentajes === false ? "" : `👍 ${d.pct?.[`p${slot}`] ?? 0}%`);

const texto = (leer, ejemplo, { colorDe } = {}) => function Texto({ el, datos }) {
  const v = datos ? leer(datos) : null;
  const t = v ?? (datos?.vivo ? "" : ejemplo);
  if (t === "" || t === null || t === undefined) return null;
  const final = el.texto && el.texto.includes("{}") ? el.texto.split("{}").join(t) : el.texto || t;
  const col = colorDe ? colorDe(datos?.vivo ? datos : { result: "p1" }) : null;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: JUST[el.estilo.alinear] }}>
      <div style={{ ...cssDeTexto(el.estilo), ...(col ? sinDegradado(col) : {}), width: "100%" }}>{final}</div>
    </div>
  );
};

/** El logo del centro de «Pantalla del duelo»: texto o imagen, con efecto y zoom. */
function Centro({ el, datos }) {
  const c = datos?.centro;
  if (!c) return null;
  const ef = efectoDuelo(c.efecto);
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", overflow: "visible" }}>
      <style>{EFECTOS_CSS}</style>
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
        transform: `scale(${escalaDeZoom(c.zoom)})`, transition: "transform .3s ease" }}>
        <div style={{ animation: ef.anim, transformOrigin: ef.origen || "50% 50%", width: "100%", height: "100%",
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          {c.centro === "imagen" && c.imagen ? (
            <img src={c.imagen} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain",
              filter: `drop-shadow(0 0 24px ${COLOR_P1}88) drop-shadow(0 0 40px ${COLOR_P2}66)` }}/>
          ) : (
            <div style={{ ...cssDeTexto(el.estilo), textShadow: `0 0 30px ${COLOR_P1}, 0 0 60px ${COLOR_P2}` }}>{c.texto}</div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Reloj de la votación (⏱ 0:42 / ¡TIEMPO!). En los últimos 10 s, color «Últimos segundos». */
function Reloj({ el, datos }) {
  const seg = datos?.vivo ? datos.seg : 42;
  if (seg === null || seg === undefined) return null;
  const urgente = seg <= 10;
  const t = el.estilo.tamano;
  const m = Math.floor(Math.max(0, seg) / 60), s = Math.max(0, seg) % 60;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...cssDeTexto(el.estilo), ...(urgente ? sinDegradado(el.ficha.acento) : {}), padding: `${t * 0.1}px ${t * 0.7}px`,
        borderRadius: 999, background: el.ficha.fondo, border: `2px solid ${urgente ? el.ficha.acento : el.ficha.borde}`, whiteSpace: "nowrap" }}>
        {seg > 0 ? `⏱ ${m}:${String(s).padStart(2, "0")}` : "¡TIEMPO!"}
      </div>
    </div>
  );
}

/** Lo que el celular arma en vivo (botones para votar / tocar, el marcador): tal cual. */
function Panel({ el, datos }) {
  if (datos?.vivo) return datos.panel ? <div style={{ width: "100%", height: "100%" }}>{datos.panel}</div> : null;
  return (
    <div style={{ width: "100%", height: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center",
      textAlign: "center", padding: 10, borderRadius: 14, border: "2px dashed rgba(255,45,149,.6)", background: "rgba(255,45,149,.08)",
      ...cssDeTexto({ ...el.estilo, tamano: 13 }) }}>
      👍 Botones de los duelistas<br/>(votar / tocar, con su % y la barra)
    </div>
  );
}

const colorGanador = (d) => (d.result === "p1" ? COLOR_P1 : d.result === "p2" ? COLOR_P2 : null);
const ganadorDe = (d) => (d.result === "p1" ? d.d1 : d.result === "p2" ? d.d2 : null);

export const DATOS_DUELO = {
  duVideo:    { nombre: "Video de la ronda", Componente: area("🎬", "Video de la ronda", "#00E5FF"), sinFichas: true, sinTexto: true, sinEfecto: true,
                ayuda: "Dónde se ve el video del duelo (o la imagen de fondo de «Pantalla del duelo»)." },
  duColumna1: { nombre: "Columna del duelista 1", Componente: columna(1), sinFichas: true, sinTexto: true, sinEfecto: true,
                ayuda: "La columna del duelista 1: avatar, barómetro, porcentaje y la lluvia de 👍. Se dibuja en esta caja." },
  duColumna2: { nombre: "Columna del duelista 2", Componente: columna(2), sinFichas: true, sinTexto: true, sinEfecto: true,
                ayuda: "La columna del duelista 2: avatar, barómetro, porcentaje y la lluvia de 👍. Se dibuja en esta caja." },
  duEfectos1: { nombre: "Efectos del duelista 1", Componente: efectos(1), sinFichas: true, sinTexto: true, sinEfecto: true,
                ayuda: "Partículas, brillo y la lluvia de 👍 del duelista 1: los 👍 nacen abajo de esta caja y vuelan hasta su cara. Transparente: el fondo es la imagen de abajo." },
  duEfectos2: { nombre: "Efectos del duelista 2", Componente: efectos(2), sinFichas: true, sinTexto: true, sinEfecto: true,
                ayuda: "Partículas, brillo y la lluvia de 👍 del duelista 2: los 👍 nacen abajo de esta caja y vuelan hasta su cara. Transparente: el fondo es la imagen de abajo." },
  duBarometro1: { nombre: "Barómetro del duelista 1", Componente: barometro(1), sinFichas: true, sinTexto: true,
                ayuda: "Sube y baja con el porcentaje del duelista 1." },
  duBarometro2: { nombre: "Barómetro del duelista 2", Componente: barometro(2), sinFichas: true, sinTexto: true,
                ayuda: "Sube y baja con el porcentaje del duelista 2." },
  duPct1:     { nombre: "👍 % del duelista 1", Componente: texto(porcentaje(1), "👍 58%"), plantilla: true, sinFichas: true,
                ayuda: "El porcentaje del duelista 1. Se apaga también con «Porcentajes» en Más ajustes." },
  duPct2:     { nombre: "👍 % del duelista 2", Componente: texto(porcentaje(2), "👍 42%"), plantilla: true, sinFichas: true,
                ayuda: "El porcentaje del duelista 2. Se apaga también con «Porcentajes» en Más ajustes." },
  // Adorno, no pieza del juego: se puede borrar (Diseño original lo devuelve).
  duCentro:   { nombre: "Logo del duelo", Componente: Centro, sinFichas: true, sinEfecto: true, borrable: true,
                ayuda: "El logo del centro de «Pantalla del duelo» (texto o imagen, efecto y zoom se eligen en «Más ajustes»). «Tamaño» es el del texto. Si no lo querés, borralo y poné tu imagen con + Imagen." },
  duReloj:    { nombre: "Reloj", Componente: Reloj, acento: true, acentoNombre: "Últimos 10 s",
                ayuda: "El tiempo que le queda a la votación. En los últimos 10 segundos cambia al color «Últimos 10 s»." },
  duAvatar1:  { nombre: "Cara del duelista 1", Componente: cara((d) => d.d1, () => COLOR_P1, 1), sinTexto: true, sinEfecto: true, sinFichas: true,
                avatar: true, colorAro: COLOR_P1,
                ayuda: "La foto o el avatar del duelista 1." },
  duAvatar2:  { nombre: "Cara del duelista 2", Componente: cara((d) => d.d2, () => COLOR_P2, 2), sinTexto: true, sinEfecto: true, sinFichas: true,
                avatar: true, colorAro: COLOR_P2,
                ayuda: "La foto o el avatar del duelista 2." },
  duNombre1:  { nombre: "Nombre del duelista 1", Componente: texto((d) => d.d1?.name, D1.name), plantilla: true, sinFichas: true,
                ayuda: "El nombre del duelista 1." },
  duNombre2:  { nombre: "Nombre del duelista 2", Componente: texto((d) => d.d2?.name, D2.name), plantilla: true, sinFichas: true,
                ayuda: "El nombre del duelista 2." },
  duGanadorAvatar: { nombre: "Cara del ganador", Componente: cara(ganadorDe, colorGanador), sinTexto: true, sinEfecto: true, sinFichas: true,
                avatar: true, colorAro: COLOR_P1,
                ayuda: "La foto o el avatar de quien ganó, en el color de su lado." },
  duGanadorNombre: { nombre: "Nombre del ganador", Componente: texto((d) => ganadorDe(d)?.name, D1.name, { colorDe: colorGanador }),
                plantilla: true, sinFichas: true, ayuda: "El nombre de quien ganó, en el color de su lado." },
  duMarcador: { nombre: "Marcador final", Componente: texto((d) => (d.d1 ? `${d.d1.name} · ${d.pct?.p1 ?? 0}%  |  ${d.pct?.p2 ?? 0}% · ${d.d2?.name}` : null),
                `${D1.name} · 58%  |  42% · ${D2.name}`), plantilla: true, sinFichas: true,
                ayuda: "Los porcentajes finales de los dos duelistas." },
  duVs:       { nombre: "Duelista VS duelista", Componente: texto((d) => (d.d1 ? `${d.d1.name} VS ${d.d2?.name}` : null), `${D1.name} VS ${D2.name}`),
                plantilla: true, sinFichas: true, ayuda: "Los dos que se enfrentan." },
  duResultado: { nombre: "Resultado", Componente: texto((d) => (d.result === "tie" ? "¡Empate!" : ganadorDe(d) ? `Ganó ${ganadorDe(d).name}` : null),
                `Ganó ${D1.name}`), plantilla: true, sinFichas: true, ayuda: "«Ganó …» o «¡Empate!»." },
  duIcono:    { nombre: "Ícono del resultado", Componente: texto((d) => (d.result === "tie" ? "🤝" : d.result ? "🏆" : null), "🏆"), plantilla: true, sinFichas: true,
                ayuda: "🏆 si hay ganador, 🤝 si empataron." },
  duSaldo:    { nombre: "Estado del voto", Componente: texto((d) => d.saldo, "Te quedan 12 toques"), plantilla: true, sinFichas: true,
                ayuda: "Cuántos toques le quedan, a quién votó, o si la votación cerró." },
  duConsigna: { nombre: "Cómo se vota", Componente: texto((d) => d.consigna, "Tocá sin parar al que más te guste: cuantos más toques, más porcentaje"),
                plantilla: true, sinFichas: true, ayuda: "La consigna del modo de la ronda (toques o votos)." },
  duEstado:   { nombre: "Estado de la postulación", Componente: texto((d) => d.estado, "Esperando que el staff elija a los participantes…"),
                plantilla: true, sinFichas: true, ayuda: "Si el staff ya lo eligió o todavía espera." },
  duPanel:    { nombre: "Botones / marcador", Componente: Panel, sinFichas: true, sinTexto: true, sinEfecto: true,
                ayuda: "Los botones de los duelistas para votar o tocar, con su % y la barra (o el marcador, para quien está en el escenario)." },
};
