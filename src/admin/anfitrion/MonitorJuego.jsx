import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRaffle } from "../../hooks/useRaffle";
import { useReyBorrador } from "../../hooks/realtime/useReyBorrador";
import { useSumateRound } from "../../hooks/realtime/useSumateRound";
import { useArmaPalabraRound } from "../../hooks/realtime/useArmaPalabraRound";
import { useTriviaBorrador } from "../../hooks/realtime/useTriviaBorrador";
import { useTriviaAccumulated, useTriviaVotes } from "../../hooks/realtime/useTriviaVotes";
import { useFtlEnergia, useFtlPelea } from "../../hooks/realtime/useFtlEnergia";
import { useFollowLeaderVotes } from "../../hooks/realtime/useFollowLeaderVotes";
import { useVotacionEscenario } from "../../hooks/useVotacionEscenario";
import FtlBarometro from "../../components/FtlBarometro";
import { ESCENARIO_JUEGOS } from "../../constants/escenarioJuegos";
import { TEAMS } from "../../constants/theme";
import { useDueloRound } from "../../hooks/realtime/useDueloRound";
import { useDueloPostulaciones } from "../../hooks/realtime/useDueloPostulaciones";
import { useDueloBorrador } from "../../hooks/realtime/useDueloBorrador";
import {
  FRASES_DUELO, FRASES_ESCENARIO, FRASE_CADA_MS, estadoDuelista, estadoBarometro, fraseDe,
} from "../../constants/frasesAnfitrion";
import { faseDuelo, duelistasDeRonda, porcentajesDuelo, segundosRestantes, formatoReloj, modoDeRonda } from "../../services/duelo";

/**
 * Lo que ve el Anfitrión de cada juego. SÓLO LECTURA: el Anfitrión guía al
 * público y Producción opera (elige, anuncia, lanza y cierra). Todo sale de la
 * base —`game_state`, las rondas, los borradores— así que la tablet muestra
 * lo mismo que la TV sin escribir nada.
 *
 * Cada monitor recibe `alAire`: false cuando el juego ya salió de pantalla y
 * queda a la vista como «finalizado» hasta que Producción ponga otro.
 */

/** Qué juego del Anfitrión está en pantalla, con la prioridad de /pantalla (juego > escenario > placa). */
export function juegoEnPantalla(gameState) {
  const juego = { "rey del orto": "rey", suma: "suma", palabra: "palabra", trivia: "trivia" }[gameState?.active_game];
  if (juego) return juego;
  if (gameState?.active_game) return null;
  const esc = gameState?.active_escenario;
  if (esc === "ftl" || esc === "pt" || esc === "duelo") return esc;
  if (esc) return null;
  return { game_rey: "rey", game_suma: "suma", game_palabra: "palabra", game_trivia: "trivia",
    escenario_ftl: "ftl", escenario_pt: "pt", duelo: "duelo" }[gameState?.active_placa] || null;
}

export default function MonitorJuego({ id, alAire, gameState, sessionId }) {
  const props = { alAire, gameState, sessionId };
  switch (id) {
    case "rey":     return <MonitorRey {...props}/>;
    case "suma":    return <MonitorRonda {...props} tipo="suma"/>;
    case "palabra": return <MonitorRonda {...props} tipo="palabra"/>;
    case "trivia":  return <MonitorTrivia {...props}/>;
    case "ftl":
    case "pt":      return <MonitorEscenario {...props} type={id}/>;
    case "duelo":   return <MonitorDuelo {...props}/>;
    default:        return null;
  }
}

// ── Piezas comunes ─────────────────────────────────────────────────────────

// Logo oficial de cada juego: el mismo de su placa en la TV.
const LOGOS = {
  rey:     "/placas/Rey_del_orto-removebg-preview.png",
  suma:    "/placas/Sumate_que_sumamos-removebg-preview.png",
  palabra: "/placas/Arma_la_palabra-removebg-preview.png",
  trivia:  "/placas/Desafio_demente-removebg-preview.png",
  ftl:     "/placas/Follow_de_leader-removebg-preview.png",
  pt:      "/placas/Personal_Trainer-removebg-preview.png",
  duelo:   "/placas/Duelo_de_talento-removebg-preview.png",
};

function Logo({ juego }) {
  return <img className="mon-logo" src={LOGOS[juego]} alt=""/>;
}

/** Etapas del juego en una fila: las pasadas tildadas, la actual encendida. */
function Pasos({ pasos, actual, col }) {
  const idx = pasos.findIndex((p) => p.id === actual);
  return (
    <ol className="mon-pasos" style={{ "--mc": col }}>
      {pasos.map((p, i) => (
        <li key={p.id} className={i === idx ? "on" : i < idx ? "ok" : ""}>
          <span>{i < idx ? "✓" : i + 1}</span>{p.label}
        </li>
      ))}
    </ol>
  );
}

function Cabecera({ juego, titulo, col, estado, vivo }) {
  return (
    <div className="mon-cab" style={{ "--mc": col }}>
      <img className="mon-cab-logo" src={LOGOS[juego]} alt={titulo}/>
      {estado && <span className={`mon-chip${vivo ? " vivo" : ""}`}>{vivo && <i/>}{estado}</span>}
    </div>
  );
}

/** Tarjeta central: siempre del mismo alto para que la tablet no salte entre etapas. */
function Escena({ col, children }) {
  return <div className="mon-escena" style={{ "--mc": col }}>{children}</div>;
}

function Leyenda({ children }) {
  return <div className="mon-leyenda">{children}</div>;
}

// ── 👑 Rey del Orto ────────────────────────────────────────────────────────
// Anuncio → premio elegido → sorteo (cuenta regresiva) → ganador.

const PASOS_REY = [
  { id: "anuncio", label: "Anuncio" }, { id: "premio", label: "Premio" },
  { id: "sorteo", label: "Sorteo" }, { id: "ganador", label: "Ganador" },
];

function MonitorRey({ alAire, gameState, sessionId }) {
  const COL = "#FFD600";
  const { premio: preparado } = useReyBorrador(sessionId);
  const { state, cd, color, winner } = useRaffle(gameState);
  const enJuego = gameState?.active_game === "rey del orto";
  const anunciando = !enJuego && gameState?.active_placa === "game_rey";
  const fase = !alAire ? "fin" : !enJuego ? "anuncio" : state === "launched" ? "sorteo"
    : state === "winner" ? "ganador" : state === "cancelled" ? "cancelado" : "premio";
  // En sorteo y con ganador manda el premio de la ronda; antes, el que eligió Producción.
  const premio = (fase === "sorteo" || fase === "ganador") ? gameState?.raffle_prize : preparado?.nombre;
  const detalle = (fase === "sorteo" || fase === "ganador") ? null : preparado?.detalle;

  // Al finalizar, `game_state` se limpia: el último ganador queda acá a la vista.
  const [ultimo, setUltimo] = useState(null);
  useEffect(() => { if (winner) setUltimo(winner); }, [winner?.id, winner?.prize]);

  const estado = { fin: "Finalizado", anuncio: "Anuncio en pantalla", premio: "Al aire", sorteo: "Sorteando",
    ganador: "Ganador", cancelado: "Sorteo cancelado" }[fase];

  return (<>
    <Cabecera juego="rey" titulo="Rey del Orto" col={COL} estado={estado} vivo={fase === "sorteo"}/>
    <Pasos pasos={PASOS_REY} col={COL}
      actual={fase === "anuncio" ? (premio ? "premio" : "anuncio") : fase === "cancelado" ? "sorteo" : fase === "fin" ? "ganador" : fase}/>
    <Escena col={fase === "sorteo" ? color : COL}>
      {fase === "sorteo" ? (<>
        <div className="mon-k">Sorteando</div>
        <div className="mon-num" style={{ color: COL }}>{cd > 0 ? cd : "…"}</div>
        <div className="mon-sub">Premio: <b style={{ color: COL }}>{premio || "—"}</b></div>
      </>) : fase === "ganador" ? (<>
        <div className="mon-k">🏆 Ganador</div>
        <div className="mon-grande" style={{ color: "#00F5A0" }}>{winner?.name || "—"}</div>
        <div className="mon-sub">Se lleva <b style={{ color: COL }}>{winner?.prize || premio || "—"}</b></div>
      </>) : fase === "cancelado" ? (<>
        <div className="mon-k">Sorteo cancelado</div>
        <div className="mon-grande" style={{ color: COL }}>Sin ganador</div>
        <div className="mon-sub">Producción lo revisa y vuelve a sortear.</div>
      </>) : fase === "fin" ? (<>
        <div className="mon-k">Juego finalizado</div>
        {ultimo ? (<>
          <div className="mon-grande" style={{ color: "#00F5A0" }}>{ultimo.name}</div>
          <div className="mon-sub">Último ganador · <b style={{ color: COL }}>{ultimo.prize}</b></div>
        </>) : <Logo juego="rey"/>}
      </>) : (<>
        <div className="mon-k">{premio ? "Premio a sortear" : anunciando ? "Anuncio en pantalla" : "Al aire"}</div>
        {premio ? <div className="mon-grande" style={{ color: COL }}>{premio}</div> : <Logo juego="rey"/>}
        {detalle && <div className="mon-sub">{detalle}</div>}
        {!premio && <div className="mon-sub">Producción está eligiendo el premio.</div>}
      </>)}
    </Escena>
  </>);
}

// ── 🔢 Sumate que sumamos / 🔤 Arma la palabra ─────────────────────────────
// Anuncio → objetivo (número o palabra) en juego → finalización. Ninguno de los
// dos tiene cronómetro todavía: cuando lo tengan, va en `Escena` debajo del objetivo.

const RONDA = {
  suma:    { col: "#FF9500", titulo: "Sumate que sumamos", objetivo: "Número a formar",
             valor: (r) => r?.target_number, hook: useSumateRound, placa: "game_suma" },
  palabra: { col: "#A855F7", titulo: "Arma la palabra", objetivo: "Palabra a formar",
             valor: (r) => r?.target_word, hook: useArmaPalabraRound, placa: "game_palabra" },
};
const PASOS_RONDA = [{ id: "anuncio", label: "Anuncio" }, { id: "juego", label: "En juego" }, { id: "fin", label: "Finalización" }];

function MonitorRonda({ tipo, alAire, gameState, sessionId }) {
  const cfg = RONDA[tipo];
  const { round, assignments } = cfg.hook(sessionId, { admin: true });
  const enElAire = gameState?.active_game === tipo;
  const enJuego = enElAire && round?.status === "playing";
  const fase = !alAire ? "fin" : enJuego ? "juego" : enElAire ? "fin" : "anuncio";
  const valor = cfg.valor(round);

  return (<>
    <Cabecera juego={tipo} titulo={cfg.titulo} col={cfg.col} vivo={fase === "juego"}
      estado={{ anuncio: "Anuncio en pantalla", juego: "En juego", fin: "Finalizado" }[fase]}/>
    <Pasos pasos={PASOS_RONDA} actual={fase} col={cfg.col}/>
    <Escena col={cfg.col}>
      {fase === "anuncio" ? (<>
        <div className="mon-k">Anuncio en pantalla</div>
        <Logo juego={tipo}/>
        <div className="mon-sub">Cuando Producción lance, acá aparece el objetivo.</div>
      </>) : (<>
        <div className="mon-k">{fase === "juego" ? cfg.objetivo : "Juego finalizado"}</div>
        {valor != null && <div className={tipo === "suma" ? "mon-num" : "mon-palabra"} style={{ color: cfg.col }}>{valor}</div>}
        {fase === "juego" && <div className="mon-sub">{assignments.length} {assignments.length === 1 ? "persona jugando" : "personas jugando"}</div>}
        {fase === "fin" && valor != null && <div className="mon-sub">Era el objetivo de la última ronda.</div>}
      </>)}
    </Escena>
  </>);
}

// ── 🧠 Desafío Demente ─────────────────────────────────────────────────────
// Anuncio → preguntas por etapa, con su respuesta → equipo ganador.

const PASOS_TRIVIA = [{ id: "anuncio", label: "Anuncio" }, { id: "preguntas", label: "Preguntas" }, { id: "ganador", label: "Ganador" }];

function MonitorTrivia({ alAire, gameState, sessionId }) {
  const COL = "#9B2FFF";
  const enElAire = gameState?.active_game === "trivia";
  const phase = enElAire ? gameState?.trivia_state || "idle" : "idle";
  const curQ = gameState?.trivia_question ?? 0;
  const roundId = gameState?.trivia_round_id ?? null;
  const enJuego = phase === "active" || phase === "revealed";

  // Antes de lanzar, la ronda que arma Producción; lanzada, la que quedó guardada.
  const { preguntas: borrador } = useTriviaBorrador(sessionId);
  const [lanzadas, setLanzadas] = useState(null);
  useEffect(() => {
    setLanzadas(null);
    if (!sessionId || !roundId) return;
    let vivo = true;
    supabase.from("trivia_questions").select("question_idx,question_text,options,correct_option")
      .eq("session_id", sessionId).eq("round_id", roundId).order("question_idx")
      .then(({ data }) => {
        if (vivo && data?.length) setLanzadas(data.map((q) => ({ text: q.question_text, opts: q.options, correct: q.correct_option })));
      });
    return () => { vivo = false; };
  }, [sessionId, roundId]);
  const qs = lanzadas || borrador;

  const { pcts } = useTriviaVotes(sessionId, roundId, curQ, phase);
  const { accumulated, leader } = useTriviaAccumulated(sessionId, roundId, phase);
  const ganador = gameState?.trivia_winner_team ?? leader;
  // Al finalizar, `game_state` se limpia: el resultado queda a la vista.
  const [ultimo, setUltimo] = useState(null);
  useEffect(() => { if (phase === "finished") setUltimo({ ganador, accumulated }); }, [phase, ganador, accumulated.batata, accumulated.membrillo]);

  const fase = !alAire ? "fin" : phase === "finished" ? "ganador" : enJuego ? "preguntas" : "anuncio";
  const resultado = fase === "ganador" ? { ganador, accumulated } : fase === "fin" ? ultimo : null;

  return (<>
    <Cabecera juego="trivia" titulo="Desafío Demente" col={COL} vivo={enJuego}
      estado={{ anuncio: enElAire ? "Al aire, por empezar" : "Anuncio en pantalla",
        preguntas: `Pregunta ${curQ + 1} de ${qs.length || "—"}`, ganador: "Ganador", fin: "Finalizado" }[fase]}/>
    <Pasos pasos={PASOS_TRIVIA} actual={fase === "fin" ? "ganador" : fase} col={COL}/>

    {resultado ? (
      <Escena col={COL}>
        <div className="mon-k">{fase === "fin" ? "Desafío finalizado" : "🏆 Ganador"}</div>
        <div className="mon-grande" style={{ color: resultado.ganador ? TEAMS[resultado.ganador].color : COL }}>
          {resultado.ganador ? `${TEAMS[resultado.ganador].emoji} ${TEAMS[resultado.ganador].name}` : "🤝 Empate"}
        </div>
        <div className="mon-sub">Aciertos · 🍠 Batata {resultado.accumulated.batata} · 🍋 Membrillo {resultado.accumulated.membrillo}</div>
      </Escena>
    ) : fase === "fin" ? (
      <Escena col={COL}><div className="mon-k">Desafío finalizado</div><Logo juego="trivia"/></Escena>
    ) : null}

    {enJuego && (
      <div className="mon-equipos">
        {["batata", "membrillo"].map((t) => (
          <div key={t} style={{ "--mc": TEAMS[t].color }}>
            <span>{TEAMS[t].emoji} {TEAMS[t].name.replace("Team ", "")}</span>
            <b>{pcts?.[t] ?? 50}%</b>
            <small>{accumulated[t]} aciertos</small>
          </div>
        ))}
      </div>
    )}

    {fase !== "fin" && fase !== "ganador" && (
      !qs.length ? (
        <Escena col={COL}>
          <div className="mon-k">{enElAire ? "Al aire" : "Anuncio en pantalla"}</div>
          <Logo juego="trivia"/>
          <div className="mon-sub">Producción está armando las preguntas.</div>
        </Escena>
      ) : (
        <div className="mon-preguntas">
          {qs.map((q, i) => {
            const etapa = !enJuego ? "prox" : i < curQ ? "ok" : i === curQ ? "on" : "prox";
            return (
              <div key={i} className={`mon-q ${etapa}`} style={{ "--mc": COL }}>
                <div className="mon-q-t">
                  <span>{etapa === "ok" ? "✓" : i + 1}</span>{q.text}
                  {etapa === "on" && phase === "revealed" && <em>Respuesta revelada</em>}
                </div>
                <div className="mon-q-ops">
                  {q.opts.map((o, oi) => (
                    <div key={oi} className={oi === q.correct ? "ok" : ""}>
                      <b>{String.fromCharCode(65 + oi)}</b>{o}
                      {etapa === "on" && pcts?.opts && <i>{pcts.opts[oi]}%</i>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )
    )}
  </>);
}

// ── 💃 Follow the Leader / 🏋️ Personal Trainer ─────────────────────────────
// Anuncio (convocatoria) → persona en el escenario + video → barómetro en vivo
// → porcentaje con que terminó.

const PASOS_ESCENARIO = [{ id: "anuncio", label: "Anuncio" }, { id: "preparado", label: "Participante" },
  { id: "vivo", label: "En vivo" }, { id: "resultado", label: "Resultado" }];

function MonitorEscenario({ type, alAire, gameState }) {
  const juego = ESCENARIO_JUEGOS[type];
  const COL = juego.colorAdmin;
  const enElAire = gameState?.active_escenario === type;
  const proyectado = enElAire ? gameState?.escenario_participant || null : null;
  const enVivo = !!proyectado?.playing;
  const video = enElAire ? gameState?.escenario_video || null : null;
  const tieneVideo = !!(video?.ytId || video?.url);

  // Misma fuente que /tv y el celular, según el modo de votación del juego.
  const modo = useVotacionEscenario()[type] || "off";
  const turno = enVivo ? proyectado?.turn_id || null : null;
  const energia = useFtlEnergia(modo === "toques" ? turno : null);
  const pelea = useFtlPelea(modo === "pelea" ? turno : null);
  const { totals: votos } = useFollowLeaderVotes(modo === "votos" ? turno : null, null, { soloTotales: true });
  const pct = modo === "toques" ? energia : modo === "pelea" ? pelea.pct : modo === "votos" ? votos.up_pct ?? 0 : null;
  const ciclo = useCicloFrases(enVivo && pct != null);

  // El % con que terminó: la última lectura mientras sonaba el video. Queda
  // hasta que suba otra persona.
  const [resultado, setResultado] = useState(null);
  const vivoRef = useRef(null);
  useEffect(() => {
    if (enVivo) {
      vivoRef.current = { turno: proyectado?.turn_id, nombre: proyectado?.name, avatar: proyectado?.avatar_emoji, pct, video };
      return;
    }
    if (vivoRef.current) { setResultado(vivoRef.current); vivoRef.current = null; }
  }, [enVivo, pct]);
  useEffect(() => {
    if (proyectado?.turn_id && resultado && proyectado.turn_id !== resultado.turno) setResultado(null);
  }, [proyectado?.turn_id]);

  const fase = enVivo ? "vivo" : proyectado ? "preparado" : resultado ? "resultado" : alAire ? "anuncio" : "fin";

  return (<>
    <Cabecera juego={type} titulo={juego.label} col={COL} vivo={enVivo}
      estado={{ anuncio: "Convocatoria abierta", preparado: tieneVideo ? "Listo para arrancar" : "Eligiendo el video",
        vivo: "En vivo", resultado: alAire ? "Terminó el turno" : "Finalizado", fin: "Finalizado" }[fase]}/>
    <Pasos pasos={PASOS_ESCENARIO} actual={fase === "fin" ? "resultado" : fase} col={COL}/>

    {fase === "anuncio" || fase === "fin" ? (
      <Escena col={COL}>
        <div className="mon-k">{fase === "fin" ? "Juego finalizado" : "Convocatoria abierta"}</div>
        <Logo juego={type}/>
        {fase === "anuncio" && <div className="mon-sub">El público se anota desde el celular. Producción elige quién sube.</div>}
      </Escena>
    ) : fase === "resultado" ? (
      <Escena col={COL}>
        <div className="mon-k">Terminó con</div>
        <div className="mon-persona"><span>{resultado.avatar || "👤"}</span>{resultado.nombre}</div>
        {resultado.pct != null ? (<>
          <div className="mon-num" style={{ color: COL }}>{Math.round(resultado.pct)}%</div>
          <div className="mon-barra"><FtlBarometro pct={resultado.pct} decae={false}/></div>
        </>) : <div className="mon-sub">Sin votación del público en este juego.</div>}
      </Escena>
    ) : (
      <Escena col={enVivo ? "#EF4444" : COL}>
        <div className="mon-persona"><span>{proyectado.avatar_emoji || "👤"}</span>{proyectado.name}</div>
        <VideoAsignado video={tieneVideo ? video : null}/>
        {enVivo && pct != null && (
          <div className="mon-barra">
            <div className="mon-k">{{ toques: "🔥 Energía del público", pelea: "⚔️ Pelea 👍 / 👎", votos: "👍 Votos positivos" }[modo]}</div>
            <FtlBarometro pct={pct} decae={modo === "toques"}/>
            <Frase estado={{ alto: "ganando", medio: "parejo", bajo: "perdiendo" }[estadoBarometro(pct)]}
              texto={fraseDe(FRASES_ESCENARIO[estadoBarometro(pct)], proyectado.name, ciclo)}/>
          </div>
        )}
        {!enVivo && <Leyenda>{tieneVideo ? "Producción arranca el video." : "Producción está eligiendo el video."}</Leyenda>}
      </Escena>
    )}
  </>);
}

/** Lo que el Anfitrión le dice al participante: verde si va ganando, rojo si va perdiendo. */
function Frase({ estado, texto }) {
  if (!texto) return null;
  return <div key={texto} className={`mon-frase ${estado}`}>🎙️ {texto}</div>;
}

/** Ciclo de las frases: avanza cada FRASE_CADA_MS (el Duelo ya tiene su reloj). */
function useCicloFrases(activo) {
  const [ciclo, setCiclo] = useState(0);
  useEffect(() => {
    if (!activo) return undefined;
    const id = setInterval(() => setCiclo((c) => c + 1), FRASE_CADA_MS);
    return () => clearInterval(id);
  }, [activo]);
  return ciclo;
}

function VideoAsignado({ video }) {
  if (!video) return <div className="mon-video vacio">🎬 Sin video todavía</div>;
  return (
    <div className="mon-video">
      {video.ytId ? <img src={`https://i.ytimg.com/vi/${video.ytId}/mqdefault.jpg`} alt=""/> : <span>🎞️</span>}
      <div>{video.ytTitle || video.nombre || "Video"}</div>
    </div>
  );
}

// ── 🎤 Duelo de Talentos ───────────────────────────────────────────────────
// Anuncio (convocatoria, con los postulantes) → los dos duelistas votándose,
// con el cronómetro si la ronda lo tiene → ganador. El ganador lo decide el
// servidor (`round.result`); acá sólo se lee.

const DUELO_COL = ["#FF2D78", "#FF9500"];
const PASOS_DUELO = [{ id: "anuncio", label: "Anuncio" }, { id: "llamado", label: "Llamado" },
  { id: "voting", label: "Duelo" }, { id: "result", label: "Ganador" }];

function MonitorDuelo({ alAire, gameState, sessionId }) {
  const COL = DUELO_COL[0];
  const { round, counts, now } = useDueloRound(sessionId);
  const { postulaciones } = useDueloPostulaciones(sessionId, null);
  // Los que Producción eligió para enfrentarse, antes de lanzar la votación.
  const { selP1, selP2 } = useDueloBorrador(sessionId);
  const llamados = [selP1, selP2].map((id) => postulaciones.find((p) => p.id === id) || null);
  const faseRonda = faseDuelo(gameState, round);
  const duelistas = duelistasDeRonda(round);
  const pct = porcentajesDuelo(counts);
  const unidad = modoDeRonda(round) === "votos" ? "votos" : "toques";
  const seg = faseRonda === "voting" ? segundosRestantes(round, now) : null;
  const esperando = postulaciones.filter((p) => p.status === "waiting" && !llamados.some((l) => l?.id === p.id));
  // Fuera del aire queda el resultado de la última ronda, si terminó. Con un
  // resultado en pantalla, elegir a los próximos ya es el siguiente llamado.
  const hayLlamados = llamados.some(Boolean);
  const fase = !alAire ? (round?.status === "finished" ? "result" : "fin")
    : faseRonda === "voting" ? "voting"
    : hayLlamados ? "llamado"
    : faseRonda === "result" ? "result" : "anuncio";
  const resultado = round?.result; // 'p1' | 'p2' | 'tie'

  return (<>
    <Cabecera juego="duelo" titulo="Duelo de Talentos" col={COL} vivo={fase === "voting"}
      estado={{ anuncio: "Convocatoria abierta", llamado: "Llamá a los duelistas",
        voting: seg == null ? "Votando" : seg > 0 ? `⏱ ${formatoReloj(seg)}` : "Tiempo cumplido",
        result: alAire ? "Resultado" : "Finalizado", fin: "Finalizado" }[fase]}/>
    <Pasos pasos={PASOS_DUELO} actual={fase === "fin" ? "result" : fase} col={COL}/>

    {fase === "llamado" ? (<>
      <Escena col={COL}>
        <div className="mon-k">Que suban al escenario</div>
        <div className="mon-duelo mon-llamados">
          {llamados.map((p, i) => (
            <div key={i} style={{ "--mc": DUELO_COL[i] }}>
              {p ? (<><Avatar p={p} grande/><b>{p.user_name}</b></>)
                : (<><i className="mon-av grande">❔</i><small>Producción está eligiendo</small></>)}
            </div>
          ))}
        </div>
        <div className="mon-sub">La votación arranca cuando Producción lance el duelo.</div>
      </Escena>
    </>) : fase === "anuncio" || fase === "fin" ? (<>
      <Escena col={COL}>
        <div className="mon-k">{fase === "fin" ? "Duelo finalizado" : "Convocatoria abierta"}</div>
        <Logo juego="duelo"/>
        {fase === "anuncio" && <div className="mon-sub">Producción elige quiénes se enfrentan.</div>}
      </Escena>
      {fase === "anuncio" && (
        <div className="mon-postulantes">
          <div className="mon-k">{esperando.length ? `${esperando.length} ${esperando.length === 1 ? "postulante" : "postulantes"}` : "Todavía no hay postulantes"}</div>
          <div>
            {esperando.map((p) => (
              <span key={p.id}><Avatar p={p}/>{p.user_name}</span>
            ))}
          </div>
        </div>
      )}
    </>) : (<>
      {fase === "result" && (
        <Escena col="#00F5A0">
          <div className="mon-k">🏆 {resultado === "tie" ? "Resultado" : "Ganador"}</div>
          <div className="mon-grande" style={{ color: resultado === "tie" ? "#FFD600" : "#00F5A0" }}>
            {resultado === "tie" ? "🤝 Empate" : resultado === "p1" ? duelistas[0]?.name : resultado === "p2" ? duelistas[1]?.name : "Calculando…"}
          </div>
        </Escena>
      )}
      <div className="mon-duelo">
        {duelistas.map((d, i) => d && (
          <div key={i} className={fase === "result" && resultado === `p${i + 1}` ? "gana" : ""} style={{ "--mc": DUELO_COL[i] }}>
            <Avatar p={d} grande/>
            <b>{d.name}</b>
            <strong>{pct[`p${i + 1}`]}%</strong>
            <small>{counts[`p${i + 1}`]} {unidad}</small>
            {fase === "voting" && (() => {
              const estado = estadoDuelista(pct[`p${i + 1}`], pct.p1 + pct.p2 > 0);
              return <Frase estado={estado} texto={fraseDe(FRASES_DUELO[estado], d.name, Math.floor(now / FRASE_CADA_MS), i)}/>;
            })()}
          </div>
        ))}
      </div>
      <div className="mon-duelo-barra">
        <div style={{ width: `${pct.p1 + pct.p2 === 0 ? 50 : pct.p1}%` }}/>
      </div>
    </>)}
  </>);
}

function Avatar({ p, grande = false }) {
  const cls = `mon-av${grande ? " grande" : ""}`;
  return p.photo_url ? <img className={cls} src={p.photo_url} alt=""/> : <i className={cls}>{p.avatar_emoji || "👤"}</i>;
}

export const CSS_MONITOR = `
  .mon{max-width:880px;margin:0 auto;padding:14px 0 8px;}
  .mon-cab{display:flex;align-items:center;gap:12px;margin-bottom:14px;}
  .mon-cab-logo{height:72px;max-width:260px;object-fit:contain;margin-right:auto;}
  .mon-logo{width:min(70%,360px);max-height:190px;object-fit:contain;}
  .mon-chip{display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;font-size:14px;font-weight:800;
    color:rgba(240,232,255,.75);background:rgba(240,232,255,.06);border:1px solid rgba(240,232,255,.14);}
  .mon-chip.vivo{color:#FF2D78;background:rgba(255,45,120,.1);border-color:rgba(255,45,120,.45);}
  .mon-chip i{width:9px;height:9px;border-radius:50%;background:currentColor;animation:pulse 1.2s infinite;}

  .mon-pasos{display:flex;gap:6px;list-style:none;margin:0 0 14px;padding:0;}
  .mon-pasos li{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 6px;border-radius:12px;
    font-size:14px;font-weight:800;color:rgba(240,232,255,.35);background:rgba(240,232,255,.04);border:1.5px solid rgba(240,232,255,.08);}
  .mon-pasos li span{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;
    font-size:12px;background:rgba(240,232,255,.08);}
  .mon-pasos li.ok{color:rgba(240,232,255,.6);}
  .mon-pasos li.on{color:#08040F;background:var(--mc);border-color:var(--mc);}
  .mon-pasos li.on span{background:rgba(8,4,15,.18);}

  .mon-escena{min-height:300px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;
    padding:24px 20px;margin-bottom:14px;border-radius:20px;background:rgba(240,232,255,.03);
    border:2px solid var(--mc);transition:border-color .1s;}
  .mon-k{font-size:13px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:rgba(240,232,255,.5);}
  .mon-grande{font-weight:800;font-size:clamp(30px,6vw,52px);line-height:1.1;word-break:break-word;}
  .mon-num{font-weight:800;font-size:clamp(80px,16vw,150px);line-height:1;}
  .mon-palabra{font-weight:800;font-size:clamp(56px,12vw,110px);line-height:1;letter-spacing:.12em;}
  .mon-sub{font-size:17px;color:rgba(240,232,255,.6);line-height:1.45;}
  .mon-leyenda{font-size:15px;color:rgba(240,232,255,.45);}
  .mon-persona{display:flex;align-items:center;gap:12px;font-weight:800;font-size:clamp(26px,5vw,40px);}
  .mon-persona span{font-size:1.2em;}
  .mon-barra{width:100%;max-width:560px;display:flex;flex-direction:column;gap:8px;}
  .mon-video{display:flex;align-items:center;gap:12px;max-width:560px;padding:10px 14px;border-radius:14px;text-align:left;
    font-size:17px;font-weight:700;background:rgba(240,232,255,.05);border:1px solid rgba(240,232,255,.1);}
  .mon-video img{width:112px;height:63px;object-fit:cover;border-radius:8px;flex-shrink:0;}
  .mon-video span{font-size:30px;}
  .mon-video.vacio{color:rgba(240,232,255,.45);}

  .mon-equipos{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;}
  .mon-equipos > div{display:flex;flex-direction:column;align-items:center;gap:2px;padding:12px;border-radius:16px;
    background:rgba(240,232,255,.03);border:1.5px solid var(--mc);}
  .mon-equipos span{font-size:15px;font-weight:800;color:var(--mc);}
  .mon-equipos b{font-size:34px;color:var(--mc);line-height:1.1;}
  .mon-equipos small{font-size:13px;color:rgba(240,232,255,.5);}

  .mon-preguntas{display:flex;flex-direction:column;gap:10px;}
  .mon-q{padding:14px 16px;border-radius:16px;background:rgba(240,232,255,.03);border:1.5px solid rgba(240,232,255,.08);}
  .mon-q.on{border-color:var(--mc);box-shadow:0 0 18px rgba(155,47,255,.25);}
  .mon-q.ok{opacity:.45;}
  .mon-q-t{display:flex;align-items:baseline;flex-wrap:wrap;gap:10px;font-size:18px;font-weight:800;line-height:1.35;margin-bottom:10px;}
  .mon-q-t span{flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;
    font-size:13px;background:rgba(240,232,255,.08);}
  .mon-q.on .mon-q-t span{background:var(--mc);color:#08040F;}
  .mon-q-t em{font-style:normal;font-size:12px;padding:3px 9px;border-radius:999px;color:#00F5A0;background:rgba(0,245,160,.1);}
  .mon-q-ops{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
  .mon-q-ops > div{display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:11px;font-size:16px;
    color:rgba(240,232,255,.7);background:rgba(240,232,255,.04);border:1px solid rgba(240,232,255,.08);}
  .mon-q-ops > div.ok{color:#00F5A0;background:rgba(0,245,160,.1);border-color:rgba(0,245,160,.45);font-weight:800;}
  .mon-q-ops b{opacity:.6;}
  .mon-q-ops i{margin-left:auto;font-style:normal;font-size:13px;opacity:.7;}

  .mon-postulantes{padding:16px;border-radius:18px;background:rgba(240,232,255,.03);border:1.5px solid rgba(240,232,255,.08);}
  .mon-postulantes > div{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;}
  .mon-postulantes span{display:flex;align-items:center;gap:8px;padding:8px 14px 8px 8px;border-radius:999px;font-size:16px;font-weight:700;
    background:rgba(240,232,255,.05);border:1px solid rgba(240,232,255,.1);}
  .mon-av{width:32px;height:32px;border-radius:50%;object-fit:cover;display:inline-flex;align-items:center;justify-content:center;
    font-style:normal;font-size:20px;background:rgba(240,232,255,.06);flex-shrink:0;}
  .mon-av.grande{width:96px;height:96px;font-size:56px;border:3px solid var(--mc);}
  .mon-duelo{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:10px;}
  .mon-duelo > div{display:flex;flex-direction:column;align-items:center;gap:6px;padding:18px 12px;border-radius:20px;text-align:center;
    background:rgba(240,232,255,.03);border:2px solid var(--mc);}
  .mon-duelo > div.gana{box-shadow:0 0 28px var(--mc);}
  .mon-duelo b{font-size:22px;word-break:break-word;}
  .mon-duelo strong{font-size:54px;line-height:1;color:var(--mc);}
  .mon-duelo small{font-size:14px;color:rgba(240,232,255,.5);}
  .mon-llamados{width:100%;max-width:620px;margin:6px 0 0;}
  .mon-frase{width:100%;margin-top:6px;padding:10px 12px;border-radius:14px;font-size:17px;font-weight:700;line-height:1.35;
    text-align:center;color:#F0E8FF;background:rgba(240,232,255,.06);border:1.5px solid rgba(240,232,255,.15);animation:fadeIn .4s;}
  .mon-frase.ganando{color:#00F5A0;background:rgba(0,245,160,.08);border-color:rgba(0,245,160,.4);}
  .mon-frase.perdiendo{color:#FF6B8A;background:rgba(255,45,120,.08);border-color:rgba(255,45,120,.4);}
  .mon-frase.parejo{color:#FFD600;background:rgba(255,214,0,.07);border-color:rgba(255,214,0,.35);}
  .mon-duelo-barra{height:14px;border-radius:7px;overflow:hidden;background:#FF9500;margin-bottom:14px;}
  .mon-duelo-barra div{height:100%;background:#FF2D78;transition:width .5s;}
  .mon-espera{min-height:60vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;}
  .mon-espera div{font-size:56px;opacity:.5;}
  .mon-espera b{font-size:22px;}
  .mon-espera span{font-size:16px;color:rgba(240,232,255,.5);max-width:420px;line-height:1.5;}
  @media (max-width:560px){
    .mon-pasos li{font-size:0;gap:0;} .mon-pasos li span{font-size:12px;}
    .mon-q-ops{grid-template-columns:1fr;}
  }
`;
