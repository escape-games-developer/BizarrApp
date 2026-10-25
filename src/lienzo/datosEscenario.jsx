import { cssDeTexto } from "./estilosTexto";
import FtlBarometro from "../components/FtlBarometro";
import { fuenteListo } from "../constants/escenarioListo";
import { efectoDuelo, escalaDeZoom, EFECTOS_CSS } from "../constants/efectosPantalla";

/**
 * Elementos «dato» de los juegos de Escenario — Follow the Leader y Personal
 * Trainer (filas `lienzo_ftl` / `lienzo_pt`) — en la TV y en el celular.
 *
 * Lo que ya tenía editor propio lo sigue usando: el cartel «LISTO PARA …»
 * sale de «Pantalla del participante listo» (texto o imagen, efecto, zoom,
 * fuente y color) y el barómetro es el de siempre. Las piezas interactivas del
 * celular son las de siempre (la votación del público llega armada en
 * `datos.votacion`); acá se ubican, se agrandan y se ocultan.
 *
 * datos = { participante, pct, decae, listo, juego, votacion (nodo), postular,
 *           salir, cargando, desafio }
 */

const JUST = { left: "flex-start", center: "center", right: "flex-end" };
const PARTICIPANTE_EJEMPLO = { name: "Valentina", avatar_emoji: "💃" };
const sinDegradado = (color) => ({ color, WebkitTextFillColor: color, backgroundImage: "none" });

/** Avatar del participante en su aro (Borde = color del aro, con brillo). */
function Avatar({ el, datos }) {
  const p = datos?.participante || (datos?.vivo ? null : PARTICIPANTE_EJEMPLO);
  if (!p) return null;
  const lado = Math.min(el.w, el.h);
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: lado, height: lado, borderRadius: "50%", boxSizing: "border-box", display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: lado * 0.5, lineHeight: 1, background: el.ficha.fondo,
        border: `${Math.max(2, lado * 0.02)}px solid ${el.ficha.borde}`, boxShadow: `0 0 ${lado * 0.35}px ${el.ficha.borde}66` }}>
        {p.avatar_emoji || "🎤"}
      </div>
    </div>
  );
}

function Nombre({ el, datos }) {
  const p = datos?.participante || (datos?.vivo ? null : PARTICIPANTE_EJEMPLO);
  if (!p) return null;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: JUST[el.estilo.alinear] }}>
      <div style={{ ...cssDeTexto(el.estilo), width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {p.name || "Participante"}
      </div>
    </div>
  );
}

/**
 * El cartel «LISTO PARA …» de «Pantalla del participante listo» (texto o
 * imagen, con su efecto, zoom, fuente y color). Llena la caja del elemento.
 */
function Listo({ el, datos }) {
  const listo = datos?.listo;
  if (!listo) return null;
  const ef = efectoDuelo(listo.efecto);
  const fuente = fuenteListo(listo.fuente);
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{EFECTOS_CSS}</style>
      <div style={{ transform: `scale(${escalaDeZoom(listo.zoom)})`, transition: "transform .3s ease" }}>
        <div style={{ animation: ef.anim, transformOrigin: ef.origen || "50% 50%" }}>
          {listo.centro === "imagen" && listo.imagen ? (
            <img src={listo.imagen} alt="" style={{ display: "block", height: el.h, maxWidth: el.w, objectFit: "contain",
              filter: "drop-shadow(0 6px 24px rgba(0,0,0,.6))" }}/>
          ) : (
            <div style={{ fontFamily: fuente.css, fontWeight: fuente.peso, fontSize: el.estilo.tamano, letterSpacing: ".16em",
              color: listo.color, textAlign: "center", textShadow: "0 3px 16px rgba(0,0,0,.7)" }}>{listo.texto}</div>
          )}
        </div>
      </div>
    </div>
  );
}

/** El barómetro de la performance (energía / % de 👍 / pelea), el de siempre. */
function Barometro({ datos }) {
  const pct = datos?.vivo ? datos.pct : 62;
  if (pct === null || pct === undefined) return null;
  return <div style={{ width: "100%", height: "100%" }}><FtlBarometro pct={pct} tamano="tv" decae={datos?.decae ?? true}/></div>;
}

/** Botón del celular: Fondo = relleno, Borde = borde; el texto es el del elemento. */
const boton = (accion, porDefecto, enCurso) => function Boton({ el, datos }) {
  const hacer = datos?.[accion];
  const cargando = !!datos?.cargando;
  const t = el.estilo.tamano;
  return (
    <button type="button" disabled={cargando} onClick={() => hacer?.()}
      style={{ ...cssDeTexto(el.estilo), width: "100%", height: "100%", boxSizing: "border-box", borderRadius: t * 0.8,
        background: el.ficha.fondo, border: `1px solid ${el.ficha.borde}`, cursor: hacer ? "pointer" : "default",
        opacity: cargando ? 0.6 : 1 }}>
      {cargando && enCurso ? enCurso : el.texto || porDefecto}
    </button>
  );
};

/** «VESTUARIO ESPECIAL REQUERIDO» con la lista del juego (título = color «Título»). */
function Vestuario({ el, datos }) {
  const items = datos?.juego?.vestuario || ["🧢 Gorra de béisbol", "🕺 Chaleco brillante", "🥿 Sneakers blancos"];
  const t = el.estilo.tamano;
  const css = cssDeTexto(el.estilo);
  return (
    <div style={{ width: "100%", height: "100%", boxSizing: "border-box", padding: `${t * 0.8}px ${t}px`, borderRadius: t,
      background: el.ficha.fondo, border: `1px solid ${el.ficha.borde}`, overflow: "hidden" }}>
      <div style={{ ...css, ...sinDegradado(el.ficha.acento), fontSize: t * 0.85, fontWeight: 700, letterSpacing: ".08em", marginBottom: t * 0.5 }}>
        {el.texto || "VESTUARIO ESPECIAL REQUERIDO"}
      </div>
      {items.map((c, i) => <div key={i} style={{ ...css, marginBottom: t * 0.15 }}>{c}</div>)}
    </div>
  );
}

const valor = (leer, ejemplo) => function Valor({ el, datos }) {
  const v = datos ? leer(datos) : null;
  const texto = v ?? (datos?.vivo ? "" : ejemplo);
  if (!texto) return null;
  const final = el.texto && el.texto.includes("{}") ? el.texto.split("{}").join(texto) : el.texto || texto;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: JUST[el.estilo.alinear] }}>
      <div style={{ ...cssDeTexto(el.estilo), width: "100%" }}>{final}</div>
    </div>
  );
};

/** La votación del público durante el turno, tal cual (toques, 👍/👎 o pelea). */
function Votacion({ el, datos }) {
  if (datos?.vivo) return datos.votacion ? <div style={{ width: "100%", height: "100%", overflow: "auto" }}>{datos.votacion}</div> : null;
  return (
    <div style={{ width: "100%", height: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center",
      textAlign: "center", padding: 10, borderRadius: 12, border: "2px dashed rgba(236,72,153,.55)", background: "rgba(236,72,153,.08)",
      ...cssDeTexto({ ...el.estilo, tamano: 13 }) }}>
      🗳️ Votación del público<br/>(toques, 👍/👎 o pelea, según el modo del juego)
    </div>
  );
}

export const DATOS_ESCENARIO = {
  escAvatar:    { nombre: "Avatar del participante", Componente: Avatar, sinTexto: true,
                  ayuda: "El avatar de quien está en el escenario, en su aro. «Borde» es el color del aro." },
  escNombre:    { nombre: "Nombre del participante", Componente: Nombre, sinFichas: true,
                  ayuda: "El nombre de quien está en el escenario." },
  escListo:     { nombre: "Cartel «Listo para…»", Componente: Listo, sinFichas: true, sinEfecto: true,
                  ayuda: "El cartel de «Pantalla del participante listo» (texto o imagen, efecto, zoom, fuente y color se eligen ahí, arriba). Acá se ubica y se agranda; «Tamaño» es el del texto." },
  escBarometro: { nombre: "Barómetro", Componente: Barometro, sinFichas: true, sinTexto: true, sinEfecto: true,
                  ayuda: "La energía del público durante el video (toques, % de 👍 o pelea). Sin votación en el juego, no se ve." },
  escPostular:  { nombre: "Botón «Quiero participar»", Componente: boton("postular", "QUIERO PARTICIPAR", "Enviando…"), titulo: true,
                  ayuda: "Anota al cliente en la cola del juego. El título es lo que dice el botón." },
  escSalir:     { nombre: "Botón «Salir de la cola»", Componente: boton("salir", "Salir de la cola"), titulo: true,
                  ayuda: "Saca al cliente de la cola. El título es lo que dice el botón." },
  escVestuario: { nombre: "Vestuario", Componente: Vestuario, acento: true, acentoNombre: "Título", titulo: true,
                  ayuda: "El vestuario especial del juego. Se muestra u oculta también con el interruptor de vestuario (arriba)." },
  escDesafio:   { nombre: "Canción del desafío", Componente: valor((d) => d.desafio, "Bailando — Enrique Iglesias"), plantilla: true, sinFichas: true,
                  ayuda: "El video que eligió el operador para el turno («Canción: {}»)." },
  escVotacion:  { nombre: "Votación del público", Componente: Votacion, sinFichas: true, sinTexto: true, sinEfecto: true,
                  ayuda: "Los botones para votar al participante, según el modo del juego (toques, 👍/👎 o pelea)." },
};
