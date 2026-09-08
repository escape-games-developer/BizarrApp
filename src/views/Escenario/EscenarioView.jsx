import { useState, useCallback } from "react";
import { BlockedView, VideoRow }           from "../../components/UI";
import { useYouTubePlaylists }             from "../../hooks/useYouTubePlaylists";
import { useEscenarioQueue }               from "../../hooks/realtime/useEscenarioQueue";
import { usePlaylistCategoria }            from "../../hooks/usePlaylistCategoria";
import { useFollowLeaderVotes }            from "../../hooks/realtime/useFollowLeaderVotes";

// ─── Standby ─────────────────────────────────────────────────────────────────
function EscenarioStandby() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "40px 16px", textAlign: "center", minHeight: 260,
    }}>
      <div style={{ fontSize: 48, marginBottom: 14, opacity: .22 }}>🎤</div>
      <div style={{ fontFamily: "Syne, sans-serif", fontSize: 16, fontWeight: 800, color: "rgba(255,215,0,.28)", marginBottom: 8 }}>
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
      <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: 16, color, marginBottom: 4 }}>
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
          fontFamily: "Syne, sans-serif", fontWeight: 700,
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

// ─── Duelo de Talentos ───────────────────────────────────────────────────────
// El Duelo se juega desde la pestaña Juegos (postulación + aplausómetro sobre
// applause_sessions). Acá había una segunda votación que escribía directo
// game_state.duelo_votes_a/b desde el cliente: contaba distinto que la pantalla,
// pisaba el contador con read-modify-write y hoy RLS la rechaza — el usuario
// veía "✓ Voto enviado" sin que se registrara nada. Queda sólo el cartel que
// manda al flujo real.
function DueloView() {
  return (
    <div>
      <div className="sec-hdr"><span style={{ fontSize: 20 }}>⚔️</span><h3>Duelo de Talentos</h3></div>
      <div style={{
        textAlign: "center", padding: "34px 20px", borderRadius: 16,
        background: "rgba(255,45,120,.08)", border: "1px solid rgba(255,45,120,.28)",
      }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🎤</div>
        <div style={{
          fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 15,
          color: "#FF2D95", marginBottom: 6,
        }}>
          El Duelo está en la pestaña Juegos
        </div>
        <div style={{ fontSize: 12.5, color: "rgba(245,230,192,.5)", lineHeight: 1.5 }}>
          Entrá a 🎮 <strong>Juegos</strong> para postularte y para aplaudir a tu favorito.
        </div>
      </div>
    </div>
  );
}

// ─── Votación del público durante un turno de FTL ────────────────────────────
// El turno es `escenario_participant.turn_id` (= escenario_queue.id). Cambiar
// de participante cambia el turno, así que los contadores y el voto propio
// arrancan de cero solos: no hay nada que limpiar a mano.
//
// El voto no se escribe nunca directo: va por el RPC cast_follow_leader_vote,
// que es quien valida que el turno esté abierto y que no vote el protagonista.
function VotacionFtl({ turnId, userId }) {
  const { totals, myVote, castVote, error } = useFollowLeaderVotes(turnId, userId);
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
        fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: 13,
        color: "rgba(255,215,0,.75)", marginBottom: 10, letterSpacing: ".04em",
      }}>¿CÓMO LO ESTÁ HACIENDO?</div>

      <div style={{ display: "flex", gap: 10 }}>
        {OPCIONES.map((o) => {
          const elegido = myVote === o.voto;
          return (
            <button key={o.voto} onClick={() => votar(o.voto)} disabled={!!enviando}
              style={{
                flex: 1, padding: "14px 8px", borderRadius: 14, cursor: enviando ? "wait" : "pointer",
                background: elegido ? `${o.color}22` : "rgba(255,255,255,.03)",
                border: `2px solid ${elegido ? o.color : "rgba(255,255,255,.08)"}`,
                transition: "all .18s", WebkitTapHighlightColor: "transparent",
              }}>
              <div style={{ fontSize: 30, marginBottom: 4, opacity: enviando === o.voto ? .5 : 1 }}>
                {o.icono}
              </div>
              <div style={{
                fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: 19,
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

// ─── Follow the Leader ───────────────────────────────────────────────────────
// La inscripción vive en `escenario_queue`, no en un useState: por eso el hook
// recibe el user id. Un F5 acá tiene que devolver la misma pantalla, y la
// llamada al escenario tiene que llegar sola por Realtime.
function FollowTheLeaderView({ user, sessionId, ytConfig, participante }) {
  const [selVideo, setSelVideo] = useState(null);
  const { myEntry, isEnrolled, enroll, leave, loading, error } =
    useEscenarioQueue(sessionId, "ftl", user?.id ?? null);

  // Fuente de verdad: el catálogo central de Supabase (categoría 'ftl' de
  // Admin › Playlists YouTube). Funciona con el localStorage vacío, que es el
  // caso de todos los celulares y de cualquier PC recién abierta.
  const { canciones, loading: cargandoLista } = usePlaylistCategoria("ftl");

  // Fallback explícito y NO destructivo: el viejo camino por
  // localStorage['bizarrapp_yt_config'].ftl → YouTube Data API. Sólo entra
  // cuando la central no trajo nada, así una configuración válida de Supabase
  // nunca queda pisada por lo que tenga guardado este navegador. Con el objeto
  // vacío, useYouTubePlaylists no hace ni una llamada de red.
  const sinCatalogo = !cargandoLista && canciones.length === 0;
  const { playlists } = useYouTubePlaylists(sinCatalogo ? (ytConfig || {}) : {});
  const lista = canciones.length ? canciones : (playlists.ftl || []);

  // La canción la manda la fila de la base — `selVideo` es sólo lo que estoy
  // eligiendo ahora y se pierde con el refresh.
  const miCancion = myEntry?.yt_title ? { title: myEntry.yt_title } : selVideo;

  // Hay alguien en el escenario. Se decide con el snapshot proyectado, que es
  // la misma fuente que mira /tv: el turno que se vota es el que se ve.
  const turnId  = participante?.turn_id || null;
  const soyYo   = !!participante?.user_id && participante.user_id === user?.id;

  // El staff me llamó: es la fase que importa mostrar, y llega por Realtime.
  // El protagonista no vota — el RPC lo rechazaría igual, pero ni siquiera se
  // le ofrecen los botones.
  if (soyYo || myEntry?.status === "called") return (
    <EnrolledCard
      color="#FDBA74" border="rgba(255,149,0,.45)" bg="rgba(255,149,0,.12)"
      icon="🎤" title="🎤 Estás en el escenario" video={miCancion}
      subtitle="El bar te sigue. ¡Marcá el paso!"
      onLeave={null}
    />
  );

  // Turno de otro: el público vota.
  if (turnId) return (
    <div>
      <div className="sec-hdr"><span style={{ fontSize: 20 }}>💃</span><h3>Follow the Leader</h3></div>
      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "14px 12px",
        borderRadius: 14, background: "rgba(236,72,153,.08)",
        border: "1px solid rgba(236,72,153,.25)",
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%", flexShrink: 0, fontSize: 26,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(255,255,255,.05)", border: "2px solid rgba(236,72,153,.45)",
        }}>{participante.avatar_emoji || "🎤"}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10.5, color: "rgba(245,230,192,.4)", letterSpacing: ".1em", fontWeight: 700 }}>
            EN EL ESCENARIO
          </div>
          <div style={{
            fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: 17, color: "#F9A8D4",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{participante.name || "Participante"}</div>
        </div>
      </div>

      <VotacionFtl turnId={turnId} userId={user?.id ?? null}/>
    </div>
  );

  if (isEnrolled) return (
    <>
      {error && <ErrorNota texto={error}/>}
      <EnrolledCard
        color="#F9A8D4" border="rgba(236,72,153,.4)" bg="rgba(236,72,153,.1)"
        icon="🎟️" title="¡Inscripto!" video={miCancion}
        subtitle="Esperá que el staff te llame al escenario 🎤"
        onLeave={leave}
      />
    </>
  );

  return (
    <div>
      <div className="sec-hdr"><span style={{ fontSize: 20 }}>💃</span><h3>Follow the Leader</h3></div>
      <CostumeStrip
        items={["🧢 Gorra de béisbol","🕺 Chaleco brillante","🥿 Sneakers blancos","🕶️ Lentes de sol"]}
        color="rgba(236,72,153,.8)" bg="rgba(236,72,153,.08)" border="rgba(236,72,153,.2)"
      />
      <div style={{ fontSize: 12, color: "rgba(245,230,192,.5)", marginBottom: 12, lineHeight: 1.5 }}>
        Subís al escenario, elegís una canción y liderás el baile. ¡El bar te sigue!
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,215,0,.45)", marginBottom: 8 }}>
        Elegí tu canción
      </div>
      {cargandoLista && (
        <div style={{textAlign:"center",padding:"24px 0",fontSize:12,color:"rgba(245,230,192,.3)"}}>
          Cargando canciones…
        </div>
      )}
      {!cargandoLista && lista.length === 0 && (
        <div style={{textAlign:"center",padding:"24px 0",fontSize:12,color:"rgba(245,230,192,.3)",lineHeight:1.6}}>
          Todavía no hay canciones cargadas.<br/>
          <span style={{fontSize:11,opacity:.75}}>Avisale al staff.</span>
        </div>
      )}
      {lista.map((v) => (
        <VideoRow key={v.id} video={v} selected={selVideo?.id === v.id} onSelect={setSelVideo} color="#EC4899" />
      ))}
      <button className="btn-primary" style={{ background: "linear-gradient(135deg,#EC4899,#8B5CF6)", marginTop: 6 }}
        disabled={!selVideo || loading}
        onClick={() => enroll(user, selVideo?.ytId, selVideo?.title)}>
        {loading ? "Anotándote…" : "💃 ¡Me apunto al escenario!"}
      </button>
      {error && <ErrorNota texto={error}/>}
    </div>
  );
}

// ─── Personal Trainer ────────────────────────────────────────────────────────
function PersonalTrainerView({ user, sessionId }) {
  const { isEnrolled, enroll, leave, loading } = useEscenarioQueue(sessionId, "pt");

  if (isEnrolled) return (
    <EnrolledCard
      color="#86EFAC" border="rgba(16,185,129,.4)" bg="rgba(16,185,129,.1)"
      icon="🏅" title="¡Inscripto!"
      subtitle="Preparate — el escenario es tuyo pronto 💪"
      onLeave={leave}
    />
  );

  return (
    <div>
      <div className="sec-hdr"><span style={{ fontSize: 20 }}>🏋️</span><h3>Bizarren Personal Trainer</h3></div>
      <CostumeStrip
        items={["🏋️ Polaina de colores","🤸 Muñequeras flúo","🎗️ Bandana en la cabeza","🩱 Body aeróbico"]}
        color="rgba(16,185,129,.8)" bg="rgba(16,185,129,.08)" border="rgba(16,185,129,.2)"
      />
      <div style={{ fontSize: 12, color: "rgba(245,230,192,.5)", marginBottom: 16, lineHeight: 1.5 }}>
        Dirigís una clase de gym dance grupal. Toda la sala te sigue desde sus lugares.
      </div>
      <button className="btn-primary" style={{ background: "linear-gradient(135deg,#10B981,#06B6D4)" }}
        disabled={loading} onClick={() => enroll(user)}>
        🏋️ ¡Quiero dirigir la clase!
      </button>
    </div>
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
export default function EscenarioView({ user, activeEscenario, isRestricted, onGoProfile, sessionId, ytConfig, gameState }) {
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

  // Karaoke queda congelado sin borrar su vista ni su case de enrutamiento.
  if (!activeEscenario || activeEscenario === "karaoke") return <EscenarioStandby />;

  switch (activeEscenario) {
    case "duelo":   return <DueloView />;
    case "ftl":     return <FollowTheLeaderView user={user} sessionId={sessionId} ytConfig={ytConfig}
                      participante={gameState?.escenario_participant || null} />;
    case "pt":      return <PersonalTrainerView user={user} sessionId={sessionId} />;
    case "karaoke": return <KaraokeView user={user} sessionId={sessionId} ytConfig={ytConfig} />;
    default:        return <EscenarioStandby />;
  }
}
