import { cssDeTexto } from "./estilosTexto";
import { TEAMS } from "../constants/theme";

/**
 * Elementos «dato» de Rey del Orto, Sumate que sumamos y Desafío Demente (los
 * de Arma la palabra y el QR están en LienzoPantalla). Cada juego los llena en
 * vivo con `datos`; sin ellos (el editor) se dibuja un ejemplo.
 *
 * Los «valor» son un texto que trae el juego (la cuenta regresiva, el objetivo,
 * el premio…). Su `texto` es una plantilla: «Premio: {}» se ve «Premio: 2×1».
 * Sin plantilla se ve el valor solo.
 *
 * En vivo, el juego manda `datos.vivo = true`: un valor que falta queda vacío
 * (un premio sin cargar no muestra el del ejemplo).
 *
 * Metadatos: `plantilla` (tiene texto propio con {}), `sinFichas` (no tiene
 * colores de fichas), `sinTexto` (no tiene formato de texto), `acento` (las
 * fichas tienen un tercer color).
 */

const JUST = { left: "flex-start", center: "center", right: "flex-end" };

/** Texto del valor con la plantilla del elemento. */
export const conPlantilla = (plantilla, valor) =>
  (plantilla && plantilla.includes("{}") ? plantilla.split("{}").join(valor) : plantilla || valor);

const valor = (nombre, ayuda, leer, ejemplo) => ({
  nombre, ayuda, plantilla: true, sinFichas: true,
  Componente: ({ el, datos }) => {
    const v = datos ? leer(datos) : null;
    const texto = v ?? (datos?.vivo ? "" : ejemplo);
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: JUST[el.estilo.alinear] }}>
        <div style={{ ...cssDeTexto(el.estilo), width: "100%" }}>{conPlantilla(el.texto, String(texto))}</div>
      </div>
    );
  },
});

// ── Estroboscópico (Rey del Orto) ─────────────────────────────────────────
// La misma secuencia que la TV de siempre: negro y un color, cada 110 ms.
const ESTROBO = ["#000", "#FFD600", "#000", "#00E5FF", "#000", "#00F5A0", "#000", "#FFFFFF"];
export const DATOS_JUEGOS_CSS = `
  @keyframes lzEstrobo{${ESTROBO.map((c, i) => `${(i * 100) / ESTROBO.length}%{background:${c}}`).join("")}}
`;
function Estrobo() {
  return <div style={{ width: "100%", height: "100%", background: "#000",
    animation: `lzEstrobo ${ESTROBO.length * 0.11}s step-end infinite` }}/>;
}

// ── Desafío Demente ───────────────────────────────────────────────────────
const PREGUNTA_EJEMPLO = { text: "¿Cuál es la capital de Australia?", options: ["Sídney", "Canberra", "Melbourne", "Perth"], correct: 1 };
const LETRA = (i) => String.fromCharCode(65 + i);
const pregunta = (datos) => datos?.pregunta || PREGUNTA_EJEMPLO;

/** Grilla de opciones de la TV: la correcta se marca al revelar (color de la letra = acento). */
function Opciones({ el, datos }) {
  const q = pregunta(datos);
  const revelada = datos ? !!datos.revelada : false;
  const t = el.estilo.tamano;
  const css = cssDeTexto(el.estilo);
  const n = q.options?.length || 0;
  return (
    <div style={{ width: "100%", height: "100%", display: "grid", alignContent: "center", gap: t * 0.5,
      gridTemplateColumns: n === 3 ? "repeat(3,1fr)" : "1fr 1fr" }}>
      {(q.options || []).map((op, i) => {
        const ok = revelada && q.correct === i;
        return (
          <div key={i} style={{ padding: `${t * 0.55}px ${t * 0.7}px`, borderRadius: t * 0.5, boxSizing: "border-box",
            border: `${Math.max(2, t * 0.07)}px solid ${ok ? el.ficha.acento : el.ficha.borde}`,
            background: ok ? `color-mix(in srgb, ${el.ficha.acento} 15%, transparent)` : el.ficha.fondo }}>
            <span style={{ ...css, display: "block", textAlign: "left" }}>{LETRA(i)}. {op}{ok && " ✓"}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Cómo respondieron: una barra por opción (sólo tiene sentido al revelar). */
function Distribucion({ el, datos }) {
  const q = pregunta(datos);
  const pcts = datos?.pcts?.opts || [12, 61, 18, 9];
  const t = el.estilo.tamano;
  const css = cssDeTexto(el.estilo);
  const n = q.options?.length || 0;
  return (
    <div style={{ width: "100%", height: "100%", display: "grid", alignContent: "center", gap: `${t * 0.5}px ${t}px`,
      gridTemplateColumns: n === 3 ? "repeat(3,1fr)" : "1fr 1fr" }}>
      {(q.options || []).map((_, i) => {
        const pct = pcts[i] ?? 0;
        const ok = q.correct === i;
        const col = ok ? el.ficha.acento : undefined;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: t * 0.6 }}>
            <span style={{ ...css, width: t * 1.3, flexShrink: 0, ...(col ? { color: col, WebkitTextFillColor: col, backgroundImage: "none" } : {}) }}>{LETRA(i)}</span>
            <div style={{ flex: 1, height: t * 0.75, borderRadius: 999, background: el.ficha.fondo, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: col || el.ficha.borde, transition: "width .6s ease" }}/>
            </div>
            <span style={{ ...css, minWidth: t * 2.6, textAlign: "right", flexShrink: 0, ...(col ? { color: col, WebkitTextFillColor: col, backgroundImage: "none" } : {}) }}>{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

const EQUIPOS_TV = [
  { id: "batata",    nombre: "Team Batata 🍠",    col: "#FF9500", grad: "linear-gradient(90deg,#FF9500,#FFD600)", bg: "rgba(255,149,0,.08)", bdr: "rgba(255,149,0,.25)" },
  { id: "membrillo", nombre: "Team Membrillo 🍋", col: "#FFD600", grad: "linear-gradient(90deg,#FFD600,#FF9500)", bg: "rgba(255,214,0,.08)", bdr: "rgba(255,214,0,.25)" },
];

/** Participación por equipo: las dos tarjetas con su porcentaje y su barra. */
function Equipos({ el, datos }) {
  const pcts = datos?.pcts || { batata: 55, membrillo: 45 };
  const t = el.estilo.tamano;
  const css = cssDeTexto(el.estilo);
  return (
    <div style={{ width: "100%", height: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: t, alignItems: "center" }}>
      {EQUIPOS_TV.map((e) => {
        const pct = pcts[e.id] ?? 50;
        const col = { color: e.col, WebkitTextFillColor: e.col, backgroundImage: "none" };
        return (
          <div key={e.id} style={{ padding: `${t * 0.8}px ${t}px`, borderRadius: t * 0.7, background: e.bg, border: `2px solid ${e.bdr}`,
            display: "grid", gap: t * 0.35, boxSizing: "border-box" }}>
            <div style={{ ...css, ...col }}>{e.nombre}</div>
            <div style={{ ...css, ...col, fontSize: t * 2.4, lineHeight: 1 }}>{pct}%</div>
            <div style={{ height: t * 0.5, borderRadius: 999, background: "rgba(240,232,255,.08)", overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: e.grad, transition: "width .6s ease" }}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Equipo de este cliente (celular), o el aviso de que no eligió. */
function MiEquipo({ el, datos }) {
  const equipo = TEAMS[datos?.equipo] || (datos?.vivo ? null : TEAMS.batata);
  const t = el.estilo.tamano;
  const css = cssDeTexto(el.estilo);
  if (!equipo) return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box",
      padding: t * 0.6, borderRadius: t * 0.7, background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)" }}>
      <div style={{ ...css, color: "#FCA5A5", WebkitTextFillColor: "#FCA5A5", backgroundImage: "none", fontSize: t * 0.8 }}>
        ⚠️ No elegiste equipo. Andá a tu perfil y elegí Team Batata o Team Membrillo.
      </div>
    </div>
  );
  const col = { color: equipo.color, WebkitTextFillColor: equipo.color, backgroundImage: "none" };
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: JUST[el.estilo.alinear],
      gap: t * 0.5, padding: `0 ${t * 0.8}px`, boxSizing: "border-box", borderRadius: t * 0.7, background: equipo.bg, border: `1px solid ${equipo.border}` }}>
      <span style={{ fontSize: t * 1.5, lineHeight: 1 }}>{equipo.emoji}</span>
      <span style={{ ...css, ...col }}>{equipo.name}</span>
    </div>
  );
}

/**
 * Opciones para votar desde el celular. `datos.votar(i)` vota (sin él, como en
 * el editor, los botones no hacen nada); `datos.miVoto` marca el elegido y,
 * al revelar, la correcta (acento) y el error.
 */
function Votar({ el, datos }) {
  const q = pregunta(datos);
  const revelada = !!datos?.revelada;
  const miVoto = datos ? datos.miVoto ?? null : null;
  const puede = !!datos?.puedeVotar;
  const t = el.estilo.tamano;
  const css = cssDeTexto(el.estilo);
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: t * 0.6 }}>
      {(q.options || []).map((op, i) => {
        const mio = miVoto === i;
        const ok = revelada && q.correct === i;
        const mal = revelada && mio && q.correct !== i;
        const borde = ok ? el.ficha.acento : mal ? "#EF4444" : mio ? "#9B2FFF" : el.ficha.borde;
        const fondo = ok ? `color-mix(in srgb, ${el.ficha.acento} 15%, transparent)` : mal ? "rgba(239,68,68,.1)"
          : mio ? "rgba(155,47,255,.15)" : el.ficha.fondo;
        return (
          <button key={i} type="button" disabled={!puede} onClick={() => datos?.votar?.(i)}
            style={{ ...css, display: "block", width: "100%", textAlign: "left", padding: `${t * 0.9}px ${t}px`, borderRadius: t * 0.75,
              border: `1px solid ${borde}`, background: fondo, cursor: puede ? "pointer" : "default", transition: "all .2s" }}>
            <span style={{ opacity: .5, marginRight: t * 0.6 }}>{LETRA(i)}.</span>
            {op}
            {ok && <span style={{ marginLeft: t * 0.6, color: el.ficha.acento }}>✓</span>}
            {mal && <span style={{ marginLeft: t * 0.6, color: "#EF4444" }}>✗</span>}
          </button>
        );
      })}
    </div>
  );
}

const ganadorTrivia = (d) => (d.ganador ? `${d.ganador === "batata" ? "🍠 Team Batata" : "🍋 Team Membrillo"} ganó` : "🤝 Empate");
const cuentaSuma = (d) => (d.ganadores?.length ? `${d.ganadores.map((g) => g.assigned_number).join(" + ")} = ${d.objetivo ?? "—"}` : null);

export const DATOS_JUEGOS = {
  // Rey del Orto
  estrobo:      { nombre: "Estroboscópico", Componente: Estrobo, sinFichas: true, sinTexto: true,
                  ayuda: "Los colores del sorteo. Estiralo a toda la pantalla o usalo de franja." },
  reyCuenta:    valor("Cuenta regresiva", "Los segundos que faltan para el resultado.", (d) => d.cuenta, 7),
  reyAvatar:    valor("Avatar del ganador", "El avatar de quien ganó el sorteo.", (d) => d.ganador?.avatar, "💃"),
  reyNombre:    valor("Nombre del ganador", "El nombre de quien ganó el sorteo.", (d) => d.ganador?.name, "Vale"),
  reyPremio:    valor("Premio", "El premio del sorteo.", (d) => d.ganador?.prize ?? d.premio, "Un trago gratis"),
  reyMotivo:    valor("Motivo de la cancelación", "Por qué se canceló, en una frase para el bar.", (d) => d.motivo,
                  "No llegamos a la cantidad mínima de participantes."),
  // Sumate que sumamos
  objetivo:     valor("Objetivo", "El número que hay que sumar.", (d) => d.objetivo, 21),
  sumaCuenta:   valor("La cuenta", "Los números del grupo ganador sumados: 5 + 7 + 9 = 21.", cuentaSuma, "5 + 7 + 9 = 21"),
  miNumero:     valor("Tu número", "El número que le tocó a este cliente.", (d) => d.miNumero, 7),
  // Desafío Demente
  triviaNumero:   valor("Número de pregunta", "En qué pregunta va la partida.", (d) => d.numero, 1),
  triviaPregunta: valor("Pregunta", "El enunciado de la pregunta en juego.", (d) => d.pregunta?.text, PREGUNTA_EJEMPLO.text),
  triviaOpciones: { nombre: "Opciones", Componente: Opciones, acento: true, acentoNombre: "Correcta",
                    ayuda: "Las opciones de la pregunta; al revelar, la correcta se pinta con el color «Correcta»." },
  triviaDistribucion: { nombre: "Cómo respondieron", Componente: Distribucion, acento: true, acentoNombre: "Correcta",
                    ayuda: "Una barra por opción con el porcentaje de votos (se muestra al revelar)." },
  triviaEquipos:  { nombre: "Participación por equipo", Componente: Equipos, sinFichas: true,
                    ayuda: "Qué parte de los votos puso cada equipo (no son aciertos)." },
  triviaGanador:  valor("Equipo ganador", "El equipo que ganó la partida, o Empate.", ganadorTrivia, "🍠 Team Batata ganó"),
  triviaAciertos: valor("Aciertos", "Los aciertos de cada equipo: Batata · Membrillo.",
                    (d) => (d.aciertos ? `${d.aciertos.batata} · ${d.aciertos.membrillo}` : null), "4 · 3"),
  miEquipo:       { nombre: "Tu equipo", Componente: MiEquipo, sinFichas: true,
                    ayuda: "El equipo del cliente, con sus colores. Si no eligió, el aviso para que lo elija." },
  triviaVotar:    { nombre: "Botones para votar", Componente: Votar, acento: true, acentoNombre: "Correcta",
                    ayuda: "Las opciones para tocar y votar. Marcan el voto propio y, al revelar, la correcta." },
};
