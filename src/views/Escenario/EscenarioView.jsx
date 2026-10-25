import { useState } from "react";
import { BlockedView, VideoRow }           from "../../components/UI";
import { useYouTubePlaylists }             from "../../hooks/useYouTubePlaylists";
import { useEscenarioQueue }               from "../../hooks/realtime/useEscenarioQueue";
import { useFtlEnergia, useFtlToques, useFtlPelea, useFtlPeleaToques } from "../../hooks/realtime/useFtlEnergia";
import { useFollowLeaderVotes }            from "../../hooks/realtime/useFollowLeaderVotes";
import { useVotacionEscenario }            from "../../hooks/useVotacionEscenario";
import FtlBarometro                       from "../../components/FtlBarometro";
import { ESCENARIO_JUEGOS }                from "../../constants/escenarioJuegos";
import CatalogoJuegos, { ESCENARIO_CATALOGO } from "../../components/CatalogoJuegos";
import ContenedorPostulacion           from "../../components/ContenedorPostulacion";
import DueloVistaCompleta                  from "../Juegos/DueloVistaCompleta";
import LienzoPantalla from "../../lienzo/LienzoPantalla";
import { useLienzo } from "../../lienzo/useLienzo";

// ─── Standby ─────────────────────────────────────────────────────────────────
function EscenarioStandby() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "40px 16px", textAlign: "center", minHeight: 260,
    }}>
      <div style={{ fontSize: 48, marginBottom: 14, opacity: .22 }}>🎤</div>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 700, color: "rgba(255,215,0,.28)", marginBottom: 8 }}>
        Escenario Bizarren
      </div>
      <div style={{ fontSize: 12, color: "rgba(245,230,192,.22)", lineHeight: 1.6, maxWidth: 200 }}>
        El staff activará una experiencia de escenario cuando sea el momento.
      </div>
      <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
        {["⚔️","💃","🏋️","🎤"].map((ic, i) => (
          <span key={i} style={{ fontSize: 26, opacity: .12, filter: "grayscale(1)" }}>{ic}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Error visible para el cliente ───────────────────────────────────────────
// Sin esto, un INSERT rechazado (sesión caída, RLS, duplicado) dejaba el botón
// apretado y nada en pantalla.
function ErrorNota({ texto }) {
  if (!texto) return null;
  return (
    <div style={{
      marginTop: 10, padding: "9px 11px", borderRadius: 10,
      background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)",
      color: "#FCA5A5", fontSize: 11.5, lineHeight: 1.5,
    }}>{texto}</div>
  );
}

// ─── Enrolled confirmation card ──────────────────────────────────────────────
function EnrolledCard({ color, border, bg, icon, title, subtitle, video, onLeave }) {
  return (
    <div style={{
      textAlign: "center", padding: "22px 14px",
      background: bg, border: `2px solid ${border}`, borderRadius: 16,
      animation: "fadeUp .4s ease",
    }}>
      <div style={{ fontSize: 36, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 16, color, marginBottom: 4 }}>
        {title}
      </div>
      {video && (
        <div style={{ fontSize: 12, color: "rgba(245,230,192,.5)", marginBottom: 4 }}>
          Canción: {video.title}
        </div>
      )}
      <div style={{ fontSize: 11, color: "rgba(245,230,192,.35)", marginBottom: onLeave ? 14 : 0 }}>{subtitle}</div>
      {onLeave && <button
        onClick={onLeave}
        style={{
          padding: "6px 16px", background: "rgba(239,68,68,.1)",
          border: "1px solid rgba(239,68,68,.22)", borderRadius: 8,
          color: "#FCA5A5", fontSize: 10, cursor: "pointer",
          fontFamily: "'DM Sans', sans-serif", fontWeight: 700,
        }}
      >
        Salir de la cola
      </button>}
    </div>
  );
}

// ─── Costume strip ───────────────────────────────────────────────────────────
function CostumeStrip({ items, color, bg, border }) {
  return (
    <div style={{ padding: "10px 12px", background: bg, border: `1px solid ${border}`, borderRadius: 12, marginBottom: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: "1px", marginBottom: 6 }}>
        VESTUARIO ESPECIAL REQUERIDO
      </div>
      {items.map((c, i) => (
        <div key={i} style={{ fontSize: 12, color: "rgba(245,230,192,.7)", marginBottom: 2 }}>{c}</div>
      ))}
    </div>
  );
}

// ─── Mod 2: votación 👍/👎 durante un turno ───────────────────────────────────
// El voto va por el RPC cast_follow_leader_vote, que valida turno abierto,
// modo 'votos' activo en Ajustes y que no vote el protagonista. Cambiar de
// participante cambia el turno: contadores y voto propio arrancan de cero.
// `demo` en los tres modos (sólo vista previa del Diseñador): valores de
// muestra; con él no se consulta ni se vota nada.
function VotacionFtl({ turnId, userId, demo = null }) {
  const vivo = useFollowLeaderVotes(demo ? null : turnId, userId);
  const { totals, myVote, castVote, error } = demo
    ? { totals: demo.totals, myVote: demo.myVote ?? null, castVote: async () => {}, error: null }
    : vivo;
  const [enviando, setEnviando] = useState(null);

  const votar = async (voto) => {
    setEnviando(voto);
    await castVote(voto);
    setEnviando(null);
  };

  const OPCIONES = [
    { voto: "up",   icono: "👍", color: "#34D399", pct: totals.up_pct },
    { voto: "down", icono: "👎", color: "#F87171", pct: totals.down_pct },
  ];

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{
        fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 13,
        color: "rgba(255,215,0,.75)", marginBottom: 10, letterSpacing: ".04em",
      }}>¿CÓMO LO ESTÁ HACIENDO?</div>

      <div style={{ display: "flex", gap: 10 }}>
        {OPCIONES.map((o) => {
          const elegido = myVote === o.voto;
          return (
            <button key={o.voto} onClick={() => votar(o.voto)} disabled={!!enviando}
              style={{
                flex: 1, padding: "18px 8px", borderRadius: 16, cursor: enviando ? "wait" : "pointer",
                background: elegido ? `${o.color}22` : "rgba(255,255,255,.03)",
                border: `2px solid ${elegido ? o.color : "rgba(255,255,255,.08)"}`,
                transition: "all .18s", WebkitTapHighlightColor: "transparent",
              }}>
              <div style={{ fontSize: 40, marginBottom: 4, opacity: enviando === o.voto ? .5 : 1 }}>
                {o.icono}
              </div>
              <div style={{
                fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 19,
                color: elegido ? o.color : "rgba(245,230,192,.45)",
              }}>{o.pct}%</div>
              {elegido && (
                <div style={{ fontSize: 9.5, fontWeight: 700, color: o.color, marginTop: 2 }}>
                  TU VOTO
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 11, color: "rgba(245,230,192,.32)", marginTop: 9, textAlign: "center" }}>
        {totals.total === 0
          ? "Sé el primero en votar. Podés cambiar de opinión cuando quieras."
          : `${totals.total} voto${totals.total === 1 ? "" : "s"} · podés cambiar el tuyo`}
      </div>

      <ErrorNota texto={error}/>
    </div>
  );
}

// ─── Mod 3: pelea de toques 👍/👎 durante un turno ────────────────────────────
// Cada uno toca 👍 o 👎 todas las veces que quiera (RPC ftl_pelear). La barra
// arranca en el medio y queda donde la deja la pelea: no se descarga sola.
function PeleaFtl({ turnId, enVivo, demo = null }) {
  const turno = enVivo && !demo ? turnId : null;
  const { pct: pctVivo } = useFtlPelea(turno, { cadaMs: 1000 });
  const toques = useFtlPeleaToques(turno);
  const pct = demo ? demo.pct : pctVivo;
  const { tocar, mios, error } = demo ? { tocar: () => {}, mios: { pos: 0, neg: 0 }, error: null } : toques;
  const [pulso, setPulso] = useState({ pos: 0, neg: 0 });

  const alTocar = (lado) => (e) => {
    e.preventDefault();
    if (!enVivo) return;
    tocar(lado);
    setPulso((p) => ({ ...p, [lado]: p[lado] + 1 }));
    if (navigator.vibrate) navigator.vibrate(12);
  };

  const BOTONES = [
    { lado: "pos", icono: "👍", color: "#34D399", texto: "¡ARRIBA!", n: mios.pos },
    { lado: "neg", icono: "👎", color: "#F87171", texto: "¡ABAJO!",  n: mios.neg },
  ];

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{
        fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 13,
        color: "rgba(255,215,0,.75)", marginBottom: 10, letterSpacing: ".04em",
      }}>⚔️ ¡PELEÁ LA BARRA!</div>

      <FtlBarometro pct={pct} decae={false}/>

      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        {BOTONES.map((b) => (
          <button key={b.lado} type="button" onPointerDown={alTocar(b.lado)} disabled={!enVivo}
            style={{
              flex: 1, padding: "28px 8px", borderRadius: 18, touchAction: "manipulation", userSelect: "none",
              cursor: enVivo ? "pointer" : "default",
              background: enVivo ? `${b.color}1F` : "rgba(255,255,255,.03)",
              border: `2px solid ${enVivo ? b.color : "rgba(255,255,255,.08)"}`,
              color: "#F5E6C0", WebkitTapHighlightColor: "transparent",
            }}>
            <div key={pulso[b.lado]} style={{ fontSize: 46, lineHeight: 1,
              animation: pulso[b.lado] ? "ftlPulso .25s ease-out" : "none" }}>{b.icono}</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 800, fontSize: 14, marginTop: 8,
              color: enVivo ? b.color : "rgba(245,230,192,.4)" }}>{b.texto}</div>
            {b.n > 0 && <div style={{ fontSize: 10.5, color: "rgba(245,230,192,.4)", marginTop: 3 }}>{b.n} toques</div>}
          </button>
        ))}
      </div>
      <style>{"@keyframes ftlPulso{0%{transform:scale(1.35)}100%{transform:scale(1)}}"}</style>

      <div style={{ fontSize: 11, color: "rgba(245,230,192,.35)", marginTop: 9, textAlign: "center" }}>
        {enVivo ? "Tocá todas las veces que quieras: 👍 la sube, 👎 la baja" : "Esperá a que arranque el video"}
      </div>

      <ErrorNota texto={error}/>
    </div>
  );
}

// ─── Mod 1: toques del público durante un turno ──────────────────────────────
// El turno es `escenario_participant.turn_id` (= escenario_queue.id). Cada
// toque suma energía al barómetro (RPC ftl_tocar, que valida turno abierto,
// video sonando y que no toque el protagonista). La energía baja sola si el
// público deja de tocar: el % lo calcula la base (ftl_energia_pct).
function ToquesFtl({ turnId, enVivo, demo = null }) {
  const turno = enVivo && !demo ? turnId : null;
  const pctVivo = useFtlEnergia(turno, { cadaMs: 1000 });
  const toques = useFtlToques(turno);
  const pct = demo ? demo.pct : pctVivo;
  const { tocar, misToques, error } = demo ? { tocar: () => {}, misToques: 0, error: null } : toques;
  const [pulso, setPulso] = useState(0);

  const alTocar = (e) => {
    e.preventDefault();
    if (!enVivo) return;
    tocar();
    setPulso((p) => p + 1);
    if (navigator.vibrate) navigator.vibrate(12);
  };

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{
        fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 13,
        color: "rgba(255,215,0,.75)", marginBottom: 10, letterSpacing: ".04em",
      }}>🔥 ¡DALE ENERGÍA!</div>

      <FtlBarometro pct={pct}/>

      <button type="button" onPointerDown={alTocar} disabled={!enVivo}
        style={{
          width: "100%", marginTop: 14, padding: "34px 12px", borderRadius: 20,
          cursor: enVivo ? "pointer" : "default", touchAction: "manipulation", userSelect: "none",
          background: enVivo ? "radial-gradient(circle at 50% 40%, rgba(255,149,0,.35), rgba(255,45,120,.18))"
            : "rgba(255,255,255,.03)",
          border: `2px solid ${enVivo ? "#FF9500" : "rgba(255,255,255,.08)"}`,
          color: "#F5E6C0", WebkitTapHighlightColor: "transparent",
        }}>
        <div key={pulso} style={{ fontSize: 56, lineHeight: 1,
          animation: pulso ? "ftlPulso .25s ease-out" : "none" }}>👏</div>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 800, fontSize: 17, marginTop: 10 }}>
          {enVivo ? "¡TOCÁ!" : "Esperá a que arranque el video"}
        </div>
        <div style={{ fontSize: 11, color: "rgba(245,230,192,.45)", marginTop: 4 }}>
          {enVivo ? "Cuanto más tocás, más sube la barra" : "Cuando empiece, tocá acá todas las veces que quieras"}
        </div>
      </button>
      <style>{"@keyframes ftlPulso{0%{transform:scale(1.35)}100%{transform:scale(1)}}"}</style>

      {misToques > 0 && (
        <div style={{ fontSize: 11, color: "rgba(245,230,192,.35)", marginTop: 8, textAlign: "center" }}>
          Sumaste {misToques} toque{misToques === 1 ? "" : "s"}
        </div>
      )}

      <ErrorNota texto={error}/>
    </div>
  );
}

// ─── Juegos de escenario con participante único (FTL y Personal Trainer) ─────
// Mismo contrato para los dos, por eso una sola vista parametrizada: el
// cliente SÓLO se postula, el video lo elige el operador después de llamarlo.
//
// La inscripción vive en `escenario_queue`, no en un useState: por eso el hook
// recibe el user id. Un F5 acá tiene que devolver la misma pantalla, y la
// llamada al escenario tiene que llegar sola por Realtime.
// `demo` (sólo vista previa del Diseñador): { inscripto, votacion } de muestra.
function JuegoEscenarioView({ juego, user, sessionId, participante, videoElegido, mostrarVestuario = true, estiloCards = true, demo = null }) {
  const cola = useEscenarioQueue(demo ? null : sessionId, juego.type, user?.id ?? null);
  const { myEntry, isEnrolled, enroll, leave, loading, error } = demo
    ? { myEntry: null, isEnrolled: !!demo.inscripto, enroll: () => {}, leave: () => {}, loading: false, error: null }
    : cola;
  const modoVotacion = useVotacionEscenario()[juego.type] || "off";

  // El cliente NO elige video. Se postula y listo: el video del desafío lo
  // elige el operador DESPUÉS de llamarlo al escenario, y viaja en
  // `game_state.escenario_video`. Acá sólo se muestra —de sólo lectura— si ya
  // está elegido. Las columnas yt_id/yt_title de `escenario_queue` siguen
  // existiendo pero FTL dejó de usarlas: filas viejas con canción no cambian
  // nada de este flujo.
  const miDesafio = videoElegido?.ytTitle ? { title: videoElegido.ytTitle } : null;

  // Hay alguien en el escenario. Se decide con el snapshot proyectado, que es
  // la misma fuente que mira /tv: el turno que se vota es el que se ve.
  const turnId  = participante?.turn_id || null;
  const soyYo   = !!participante?.user_id && participante.user_id === user?.id;

  // La votación del público del modo del juego (la misma con o sin editor).
  const votacion = !turnId ? null
    : modoVotacion === "toques" ? <ToquesFtl turnId={turnId} enVivo={!!participante.playing} demo={demo?.votacion}/>
    : modoVotacion === "votos" ? <VotacionFtl turnId={turnId} userId={user?.id ?? null} demo={demo?.votacion}/>
    : modoVotacion === "pelea" ? <PeleaFtl turnId={turnId} enVivo={!!participante.playing} demo={demo?.votacion}/>
    : null;

  // Diseñador → Escenario → FTL / PT → Celular (editor libre, `cel-<estado>` en
  // lienzo_<juego>): la pantalla editada de cada estado, con las mismas piezas
  // vivas (botones, votación, vestuario). La app relee cada 30 s y al instante
  // cuando se guarda.
  const lienzo = useLienzo(juego.type, { cada: 30000 });
  const editada = (id) => {
    const pantalla = lienzo[id];
    if (!pantalla) return null;
    const conVestuario = mostrarVestuario ? pantalla
      : { ...pantalla, elementos: pantalla.elementos.map((e) => (e.dato === "escVestuario" ? { ...e, visible: false } : e)) };
    return (
      <div>
        {error && <ErrorNota texto={error}/>}
        <LienzoPantalla formato="celular" pantalla={conVestuario} datos={{ vivo: true, participante, juego, votacion,
          postular: () => enroll(user), salir: leave, cargando: loading, desafio: miDesafio?.title }}/>
      </div>
    );
  };

  // El staff me llamó: es la fase que importa mostrar, y llega por Realtime.
  // El protagonista no vota — el RPC lo rechazaría igual, pero ni siquiera se
  // le ofrecen los botones.
  if (soyYo || myEntry?.status === "called") return editada("cel-en-escenario") || (
    <EnrolledCard
      color="#FDBA74" border="rgba(255,149,0,.45)" bg="rgba(255,149,0,.12)"
      icon="🎤" title="🎤 Estás en el escenario" video={miDesafio}
      subtitle="Esperá las indicaciones del conductor."
      onLeave={null}
    />
  );

  // Turno de otro: el público mira, y vota si el juego tiene votación.
  if (turnId) return editada("cel-votando") || (
    <div>
      <div className="sec-hdr"><span style={{ fontSize: 20 }}>{juego.icon}</span><h3>{juego.label}</h3></div>
      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "14px 12px",
        borderRadius: 14, background: juego.bgCliente,
        border: `1px solid ${juego.bordeCliente}`,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%", flexShrink: 0, fontSize: 26,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(255,255,255,.05)", border: `2px solid ${juego.colorCliente}`,
        }}>{participante.avatar_emoji || "🎤"}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10.5, color: "rgba(245,230,192,.4)", letterSpacing: ".1em", fontWeight: 700 }}>
            EN EL ESCENARIO
          </div>
          <div style={{
            fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 17, color: juego.textoCliente,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{participante.name || "Participante"}</div>
        </div>
      </div>

      {/* Modo de votación elegido en el panel del juego (Admin, 🗳️). */}
      {votacion || (
          <div style={{ marginTop: 16, textAlign: "center", fontSize: 12,
            color: "rgba(245,230,192,.35)", lineHeight: 1.6 }}>
            ¡Seguilo desde tu lugar! 🕺
          </div>
        )}
    </div>
  );

  if (isEnrolled) return editada("cel-anotado") || (
    <>
      {error && <ErrorNota texto={error}/>}
      <EnrolledCard
        color={juego.textoCliente} border={juego.bordeCliente} bg={juego.bgCliente}
        icon="🎟️" title="🎟️ ¡Estás anotado!" video={null}
        subtitle="Esperá que el staff te llame al escenario."
        onLeave={leave}
      />
    </>
  );

  // Postulación pura: sin catálogo, sin thumbnails, sin buscador. El desafío
  // lo define el operador cuando llama al participante.
  // Ocupa toda la sección; el botón va adentro del contenedor (ContenedorPostulacion).
  return editada("cel-postulacion") || (
    <ContenedorPostulacion
      id={juego.type} logo={juego.placa} alt={juego.label} titulo={juego.titulo}
      textoBoton={juego.botonPostular} cargando={loading} onPostular={() => enroll(user)}
      estiloCards={estiloCards} error={error}
      propio={{ bg: juego.bgCliente, borde: juego.bordeCliente, texto: juego.textoCliente, boton: juego.gradCliente }}
      arriba={<>
        <div className="sec-hdr" style={{ marginBottom: 0 }}>
          <span style={{ fontSize: 20 }}>{juego.icon}</span><h3>{juego.label}</h3>
        </div>
        {/* Admin → 🎨 Diseño de juegos → Celular → Vestuario. */}
        {mostrarVestuario && (
          <CostumeStrip
            items={juego.vestuario}
            color={juego.textoCliente} bg={juego.bgCliente} border={juego.bordeCliente}
          />
        )}
      </>}
    />
  );
}

// ─── Si lo sabe cante ────────────────────────────────────────────────────────
function KaraokeView({ user, sessionId, ytConfig }) {
  const [selVideo, setSelVideo] = useState(null);
  const { isEnrolled, enroll, leave, loading } = useEscenarioQueue(sessionId, "karaoke");
  const { playlists } = useYouTubePlaylists(ytConfig || {});

  if (isEnrolled) return (
    <EnrolledCard
      color="#C084FC" border="rgba(168,85,247,.4)" bg="rgba(168,85,247,.1)"
      icon="🎙️" title="¡Inscripto!" video={selVideo}
      subtitle="El staff te llama cuando es tu turno 🎤"
      onLeave={leave}
    />
  );

  return (
    <div>
      <div className="sec-hdr"><span style={{ fontSize: 20 }}>🎤</span><h3>Si lo sabe cante</h3></div>
      <div style={{ fontSize: 12, color: "rgba(245,230,192,.5)", marginBottom: 12, lineHeight: 1.5 }}>
        Anotate para cantar en el escenario. El staff maneja la cola.
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,215,0,.45)", marginBottom: 8 }}>
        Elegí tu canción
      </div>
      {!playlists.karaoke?.length && <div style={{textAlign:"center",padding:"24px 0",fontSize:12,color:"rgba(245,230,192,.3)"}}>No hay canciones disponibles.</div>}
      {(playlists.karaoke || []).map((v) => (
        <VideoRow key={v.id} video={v} selected={selVideo?.id === v.id} onSelect={setSelVideo} color="#A855F7" />
      ))}
      <button className="btn-primary" style={{ background: "linear-gradient(135deg,#A855F7,#EC4899)", marginTop: 6 }}
        disabled={!selVideo || loading}
        onClick={() => enroll(user, selVideo?.ytId, selVideo?.title)}>
        🎤 ¡Me apunto a cantar!
      </button>
    </div>
  );
}

// ─── EscenarioView (router) ──────────────────────────────────────────────────
// `demo`: datos de muestra del juego activo, sólo para la vista previa del
// Diseñador (ver preview/celularDemo.js). En la app llega siempre null.
export default function EscenarioView({ user, activeEscenario, isRestricted, onGoProfile, sessionId, ytConfig, gameState, mostrarCatalogo = false, vestuario = {}, estiloCards = true, demo = null }) {
  if (isRestricted) {
    return (
      <BlockedView
        icon="🎤" label="Escenario Bizarren"
        reason={!user?.registered ? "Registrate para participar en el escenario." : "Verificá tu ubicación en el bar."}
        onCTA={onGoProfile}
        ctaLabel={!user?.registered ? "👤 Registrarme" : "📍 Verificar ubicación"}
      />
    );
  }

  // Sin nada activo: las cards de los juegos de escenario (Ajustes → General →
  // Cards de juegos) o la espera vacía de siempre.
  const standby = mostrarCatalogo
    ? <CatalogoJuegos juegos={ESCENARIO_CATALOGO}/>
    : <EscenarioStandby />;

  // Karaoke queda congelado sin borrar su vista ni su case de enrutamiento.
  if (!activeEscenario || activeEscenario === "karaoke") return standby;

  // Duelo de Talentos: vive acá. Con la convocatoria abierta ofrece postularse
  // de entrada, sin cards ni pasos intermedios.
  if (activeEscenario === "duelo") return (
    <DueloVistaCompleta sessionId={sessionId} user={user} gameState={gameState}
      activeEscenario={activeEscenario} estiloCards={estiloCards} demo={demo}/>
  );

  // FTL y Personal Trainer corren el MISMO contrato (postulación → el operador
  // llama → elige video → comenzar), así que comparten vista: lo único que
  // cambia es la configuración del juego.
  const juego = ESCENARIO_JUEGOS[activeEscenario];
  if (juego) return (
    <JuegoEscenarioView juego={juego} user={user} sessionId={sessionId}
      mostrarVestuario={vestuario[juego.type] !== false} estiloCards={estiloCards}
      participante={gameState?.escenario_participant || null}
      videoElegido={gameState?.escenario_video || null} demo={demo} />
  );

  switch (activeEscenario) {
    case "karaoke": return <KaraokeView user={user} sessionId={sessionId} ytConfig={ytConfig} />;
    default:        return standby;
  }
}
