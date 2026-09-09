import { useRaffle }         from "../../hooks/useRaffle";
import { useTriviaQuestion, useTriviaVoter } from "../../hooks/realtime/useTriviaVotes";
import { BlockedView }       from "../../components/UI";
import { TEAMS }             from "../../constants/theme";
import DueloCard             from "./DueloCard";
import DueloVistaCompleta    from "./DueloVistaCompleta";
import { useSumateRound }    from "../../hooks/realtime/useSumateRound";

// ─── Standby ──────────────────────────────────────────────────────────────────
function GameStandby() {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "40px 16px", textAlign: "center", minHeight: 260,
    }}>
      <div style={{ fontSize: 48, marginBottom: 14, opacity: .2 }}>🎮</div>
      <div style={{ fontFamily: "Syne, sans-serif", fontSize: 16, fontWeight: 800, color: "rgba(255,215,0,.28)", marginBottom: 8 }}>
        Juegos
      </div>
      <div style={{ fontSize: 12, color: "rgba(245,230,192,.22)", lineHeight: 1.6, maxWidth: 200 }}>
        El staff activará un juego cuando sea el momento. ¡Estate atento!
      </div>
      <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
        {["🎰","🔢","🔤","🧠"].map((ic, i) => (
          <span key={i} style={{ fontSize: 24, opacity: .13, filter: "grayscale(1)" }}>{ic}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Rey del Orto ──────────────────────────────────────────────────────────
function ReyDelOrto({ user, gameState }) {
  const { state, cd, color, dark, isStrobe, isWinner } = useRaffle(gameState);
  const iWon = isWinner && user?.id && gameState?.raffle_winner_id === user.id;
  const prize = gameState?.raffle_prize || null;

  return (
    <div>
      <div className="sec-hdr">
        <span style={{ fontSize: 20 }}>🎰</span>
        <h3>Rey del Orto</h3>
      </div>

      {state === "idle" && (
        <div style={{
          padding: "12px 14px", borderRadius: 12,
          background: "rgba(255,215,0,.06)", border: "1px solid rgba(255,215,0,.14)",
          fontSize: 12, color: "rgba(255,215,0,.5)", textAlign: "center",
        }}>
          ⏳ Esperá que el staff lance el sorteo...
        </div>
      )}

      {isStrobe && (
        <div style={{
          borderRadius: 16, height: 220,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 10,
          background: dark ? "#000" : color,
          transition: "background .1s",
        }}>
          <div style={{
            fontFamily: "Syne, sans-serif", fontSize: 72, fontWeight: 900,
            color: dark ? "rgba(245,230,192,.03)" : "rgba(0,0,0,.18)", lineHeight: 1,
          }}>
            {cd}
          </div>
          <div style={{ fontSize: 12, color: dark ? "rgba(245,230,192,.04)" : "rgba(0,0,0,.2)" }}>
            sorteando...
          </div>
        </div>
      )}

      {isWinner && (
        <div style={{
          textAlign: "center", padding: "24px 16px",
          background: iWon ? "rgba(34,197,94,.1)" : "rgba(255,255,255,.04)",
          border: `1px solid ${iWon ? "rgba(34,197,94,.3)" : "rgba(255,255,255,.08)"}`,
          borderRadius: 16, animation: "fadeUp .5s ease",
        }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>{iWon ? "🏆" : "😅"}</div>
          <div style={{
            fontFamily: "Syne, sans-serif", fontSize: 18, fontWeight: 900,
            color: iWon ? "#22C55E" : "rgba(245,230,192,.5)", marginBottom: 6,
          }}>
            {iWon ? "¡GANASTE!" : "Esta vez no fue..."}
          </div>
          {iWon && prize && (
            <div style={{ fontSize: 14, color: "#FCD34D", fontWeight: 600, marginBottom: 14 }}>
              Premio: {prize}
            </div>
          )}
          {!iWon && (
            <div style={{ fontSize: 12, color: "rgba(245,230,192,.3)" }}>
              La próxima es la tuya.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Desafío Demente ──────────────────────────────────────────────────────────
function DesafioDemente({ user, sessionId, gameState }) {
  const t = user?.team ? TEAMS[user.team] : null;
  const questionIdx = gameState?.trivia_question ?? 0;
  const triviaState = gameState?.trivia_state ?? "idle";
  const roundId = gameState?.trivia_round_id ?? null;
  const question = useTriviaQuestion(sessionId, roundId, questionIdx, triviaState);

  const { myVote, vote, hasVoted, sending, error } = useTriviaVoter(
    sessionId, roundId, questionIdx, user?.id, user?.team
  );

  if (triviaState === "idle" || !question) return (
    <div>
      <div className="sec-hdr"><span style={{ fontSize: 20 }}>🧠</span><h3>Desafío Demente!</h3></div>
      {t ? (
        <div style={{
          textAlign: "center", padding: "16px", marginBottom: 14,
          background: t.bg, border: `1px solid ${t.border}`, borderRadius: 14,
        }}>
          <div style={{ fontSize: 36, marginBottom: 6 }}>{t.emoji}</div>
          <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: 16, color: t.color }}>
            {t.name}
          </div>
        </div>
      ) : (
        <div style={{
          padding: "10px 14px", marginBottom: 14,
          background: "rgba(255,215,0,.07)", border: "1px solid rgba(255,215,0,.15)",
          borderRadius: 10, fontSize: 12, color: "rgba(255,215,0,.6)", textAlign: "center",
        }}>
          ⚠️ No elegiste equipo. Andá a tu perfil y elegí Team Batata o Team Membrillo.
        </div>
      )}
      <div style={{ textAlign: "center", padding: "12px 0", fontSize: 12, color: "rgba(255,215,0,.3)" }}>
        ⏳ Esperá que el staff lance la primera pregunta...
      </div>
    </div>
  );

  if (triviaState === "finished") return (
    <div style={{ textAlign: "center", padding: "24px 16px" }}>
      <div style={{ fontSize: 48, marginBottom: 10 }}>🏆</div>
      <div style={{ fontFamily: "Syne, sans-serif", fontSize: 20, fontWeight: 900, color: "#FFD700", marginBottom: 6 }}>
        ¡Desafío terminado!
      </div>
      {gameState?.trivia_winner_team && t && gameState.trivia_winner_team === user?.team ? (
        <div style={{ fontSize: 14, color: "#86EFAC" }}>¡Tu equipo ganó el desafío! 🎉</div>
      ) : (
        <div style={{ fontSize: 13, color: "rgba(245,230,192,.5)" }}>Mejor suerte la próxima.</div>
      )}
    </div>
  );

  return (
    <div>
      <div className="sec-hdr"><span style={{ fontSize: 20 }}>🧠</span><h3>Desafío Demente!</h3></div>

      {t && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
          background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10, marginBottom: 14,
        }}>
          <span style={{ fontSize: 20 }}>{t.emoji}</span>
          <span style={{ fontSize: 12, color: t.color, fontWeight: 700 }}>{t.name}</span>
        </div>
      )}
      {!t && <div style={{padding:"10px 12px",marginBottom:12,borderRadius:10,background:"rgba(239,68,68,.1)",color:"#FCA5A5",fontSize:12,textAlign:"center"}}>Elegí Team Batata o Team Membrillo en tu perfil para votar.</div>}

      <div style={{
        padding: "14px", background: "rgba(138,85,247,.08)",
        border: "1px solid rgba(138,85,247,.2)", borderRadius: 12, marginBottom: 14,
      }}>
        <div style={{ fontSize: 10, color: "rgba(138,85,247,.6)", marginBottom: 6 }}>
          PREGUNTA {questionIdx + 1}
        </div>
        <div style={{ fontSize: 14, color: "#F0E8FF", fontWeight: 600, lineHeight: 1.5 }}>
          {question.text}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {question.options.map((opt, i) => {
          const isMyVote   = myVote === i;
          const isCorrect  = triviaState === "revealed" && i === question.correct;
          const isWrong    = triviaState === "revealed" && isMyVote && i !== question.correct;

          return (
            <button
              key={i}
              onClick={() => vote(i)}
              disabled={!t || hasVoted || sending || triviaState !== "active"}
              style={{
                padding: "12px 14px", borderRadius: 10, textAlign: "left",
                border: "1px solid",
                borderColor: isCorrect ? "#22C55E" : isWrong ? "#EF4444" : isMyVote ? "#9B2FFF" : "rgba(255,255,255,.1)",
                background:  isCorrect ? "rgba(34,197,94,.15)" : isWrong ? "rgba(239,68,68,.1)" : isMyVote ? "rgba(155,47,255,.15)" : "rgba(255,255,255,.04)",
                color: "#F0E8FF", fontSize: 13, cursor: hasVoted ? "default" : "pointer",
                transition: "all .2s",
              }}
            >
              <span style={{ fontWeight: 700, marginRight: 8, opacity: .5 }}>{["A","B","C","D"][i]}.</span>
              {opt}
              {isCorrect && <span style={{ marginLeft: 8, color: "#22C55E" }}>✓</span>}
              {isWrong   && <span style={{ marginLeft: 8, color: "#EF4444" }}>✗</span>}
            </button>
          );
        })}
      </div>

      {hasVoted && triviaState === "active" && (
        <div style={{
          textAlign: "center", marginTop: 14, padding: "10px",
          background: "rgba(34,197,94,.08)", border: "1px solid rgba(34,197,94,.2)",
          borderRadius: 10, fontSize: 12, color: "#86EFAC",
        }}>
          ✓ Voto enviado · Esperá el resultado en pantalla
        </div>
      )}
      {error && <div style={{marginTop:10,textAlign:"center",fontSize:12,color:"#FCA5A5"}}>{error}</div>}
    </div>
  );
}

// ─── Sumá el Número ────────────────────────────────────────────────────────
function SumaElNumero({ user, sessionId }) {
  // La ronda y el número vienen de la base, no de game_state: antes el número
  // salía de `minijuego_payload.assigned_number`, que es UNO para toda la
  // sesión — todos los celulares mostraban el mismo. Ahora es por persona.
  //
  // El número se asigna SOLO: no hay ningún botón que tocar. Si el usuario
  // entra con la ronda ya empezada, el hook le pide el suyo al servidor.
  const { round, miNumero, loading } = useSumateRound(sessionId, { userId: user?.id ?? null });

  const header = (
    <div className="sec-hdr"><span style={{ fontSize: 20 }}>🔢</span><h3>Sumate que sumamos</h3></div>
  );

  if (loading) return (
    <div>{header}
      <div style={{textAlign:"center",padding:"48px 20px",fontSize:12,color:"rgba(245,230,192,.3)"}}>
        Cargando la ronda…
      </div>
    </div>
  );

  if (!round) return (
    <div>{header}
      <div style={{textAlign:"center",padding:"48px 20px",fontSize:12,color:"rgba(245,230,192,.3)"}}>
        Todavía no arrancó ninguna ronda.
      </div>
    </div>
  );

  // ── Ronda cerrada ─────────────────────────────────────────────────────────
  if (round.status !== "playing") {
    const grupo = round.winner_group || [];
    const gane  = grupo.some((g) => g.user_id === user?.id);
    if (round.status === "finished" && gane) return (
      <div>{header}
        <div style={{
          textAlign:"center", padding:"34px 20px", borderRadius:20,
          background:"linear-gradient(135deg, rgba(0,245,160,.16), rgba(255,215,0,.08))",
          border:"1px solid rgba(0,245,160,.4)",
        }}>
          <div style={{fontSize:48,marginBottom:8}}>🏆</div>
          <div style={{fontFamily:"Syne, sans-serif",fontWeight:900,fontSize:22,color:"#00F5A0",marginBottom:6}}>
            ¡GANARON!
          </div>
          <div style={{fontSize:13,color:"rgba(245,230,192,.6)"}}>
            Encontraron la combinación correcta.
          </div>
        </div>
      </div>
    );
    return (
      <div>{header}
        <div style={{
          textAlign:"center", padding:"34px 20px", borderRadius:18,
          background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.1)",
        }}>
          <div style={{fontSize:40,marginBottom:10}}>🏁</div>
          <div style={{fontFamily:"Syne, sans-serif",fontWeight:800,fontSize:16,color:"rgba(245,230,192,.6)",marginBottom:6}}>
            Ronda terminada
          </div>
          <div style={{fontSize:12.5,color:"rgba(245,230,192,.4)"}}>
            {round.status === "finished"
              ? "Encontraron la combinación correcta."
              : "El staff cerró la ronda."}
          </div>
        </div>
      </div>
    );
  }

  // ── Ronda en curso ────────────────────────────────────────────────────────
  // El OBJETIVO no se dibuja acá: vive sólo en la pantalla gigante. Si el
  // celular lo mostrara, el juego se resolvería desde la mesa — hay que
  // levantar la vista, mirar la TV y buscar gente. `round.target_number` sigue
  // llegando en el estado de la ronda (lo necesitan /tv y el panel), pero esta
  // vista no lo renderiza en ningún momento mientras la ronda está viva.
  return (
    <div>
      {header}
      <div style={{
        textAlign:"center", padding:"22px 16px", marginBottom:12, borderRadius:16,
        background:"rgba(0,229,255,.08)", border:"1px solid rgba(0,229,255,.28)",
      }}>
        <div style={{fontSize:11,color:"rgba(0,229,255,.75)",letterSpacing:".14em",fontWeight:700,marginBottom:6}}>
          TU NÚMERO
        </div>
        <div style={{fontFamily:"Syne, sans-serif",fontSize:88,fontWeight:900,color:"#00E5FF",lineHeight:1}}>
          {miNumero ?? "…"}
        </div>
      </div>

      {/* Ni el objetivo, ni números ajenos, ni nombres, ni combinaciones
          sugeridas: hay que mirar la TV y encontrarse en el bar. */}
      <div style={{
        padding:"14px", borderRadius:12, textAlign:"center", lineHeight:1.6,
        background:"rgba(255,215,0,.06)", border:"1px solid rgba(255,215,0,.14)",
        fontSize:12.5, color:"rgba(255,215,0,.6)",
      }}>
        Mirá la pantalla gigante y buscá a otros jugadores.<br/>
        Júntense hasta llegar exactamente al número objetivo, y preséntense al staff.
      </div>
    </div>
  );
}

// ─── Formá la Palabra ──────────────────────────────────────────────────────
function FormaLaPalabra({ user, gameState }) {
  const word = gameState?.minijuego_payload?.target_word;
  const assignedLetter = gameState?.minijuego_payload?.assigned_letter;

  if (!word || !assignedLetter) return (
    <div style={{textAlign:"center",padding:"48px 20px",fontSize:12,color:"rgba(245,230,192,.3)"}}>
      No hay datos del juego disponibles.
    </div>
  );

  const letters = word.split("");
  const myLetter = assignedLetter;

  return (
    <div>
      <div className="sec-hdr"><span style={{ fontSize: 20 }}>🔤</span><h3>Arma la palabra</h3></div>
      <div style={{ textAlign: "center", marginBottom: 12, fontSize: 11, color: "rgba(245,230,192,.4)" }}>
        Encontrá a los que tienen las otras letras
      </div>
      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 16 }}>
        {letters.map((l, i) => (
          <div key={i} style={{
            width: 40, height: 44, borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "Syne, sans-serif", fontSize: 20, fontWeight: 900,
            background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)",
            color: "rgba(245,230,192,.2)",
          }}>_</div>
        ))}
      </div>
      <div style={{
        textAlign: "center", padding: "14px", marginBottom: 12,
        background: "rgba(168,85,247,.1)", border: "1px solid rgba(168,85,247,.3)", borderRadius: 14,
      }}>
        <div style={{ fontSize: 11, color: "rgba(168,85,247,.7)", marginBottom: 4 }}>Tu letra</div>
        <div style={{ fontFamily: "Syne, sans-serif", fontSize: 52, fontWeight: 900, color: "#A855F7", lineHeight: 1 }}>
          {myLetter}
        </div>
      </div>
      <div style={{
        padding: "12px 14px", background: "rgba(168,85,247,.06)",
        border: "1px solid rgba(168,85,247,.14)", borderRadius: 10,
        fontSize: 12, color: "rgba(168,85,247,.5)", textAlign: "center",
      }}>
        Mostrá tu letra a otros jugadores y armá la palabra para ganar 🔤
      </div>
    </div>
  );
}

// ─── JuegosView (router) ──────────────────────────────────────────────────
export default function JuegosView({ user, activeGame, activeEscenario, isRestricted, onGoProfile, sessionId, gameState, gameOpen, setGameOpen }) {
  if (isRestricted) {
    return (
      <BlockedView
        icon="🎮" label="Juegos"
        reason={!user?.registered ? "Registrate para participar en los juegos y sorteos." : "Verificá tu ubicación en el bar para jugar."}
        onCTA={onGoProfile}
        ctaLabel={!user?.registered ? "👤 Registrarme" : "📍 Verificar ubicación"}
      />
    );
  }

  // Navegación interna: si el usuario abrió el duelo, toma la pantalla completa.
  if (gameOpen === "duelo") {
    return (
      <DueloVistaCompleta
        sessionId={sessionId} user={user} gameState={gameState}
        activeEscenario={activeEscenario} onBack={() => setGameOpen?.(null)}
      />
    );
  }

  const dueloCard = activeEscenario === "duelo"
    ? <DueloCard activeEscenario={activeEscenario} onOpen={() => setGameOpen?.("duelo")} />
    : null;

  // Contenido del juego activo (o standby si no hay ninguno).
  let gameContent;
  switch (activeGame) {
    case "rey del orto": gameContent = <ReyDelOrto user={user} gameState={gameState} />; break;
    case "trivia":       gameContent = <DesafioDemente user={user} sessionId={sessionId} gameState={gameState} />; break;
    case "suma":         gameContent = <SumaElNumero user={user} sessionId={sessionId} />; break;
    case "palabra":      gameContent = <FormaLaPalabra user={user} gameState={gameState} />; break;
    default:             gameContent = <GameStandby />;
  }

  // La card del duelo depende del estado realtime: no se muestra si el admin
  // no activó active_escenario="duelo".
  if (!activeGame) return <div>{dueloCard}{gameContent}</div>;
  return activeEscenario === "duelo"
    ? <div>{dueloCard}{gameContent}</div>
    : gameContent;
}
