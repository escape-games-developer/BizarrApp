import { useState, useEffect, useCallback } from "react";
import { useRaffle }         from "../../hooks/useRaffle";
import { useTriviaVoter }    from "../../hooks/realtime/useTriviaVotes";
import { BlockedView }       from "../../components/UI";
import { TEAMS, rand }       from "../../constants/theme";
import { STROBE_COLORS, TRIVIA_QUESTIONS } from "../../constants/data";

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
  const question    = TRIVIA_QUESTIONS[questionIdx];

  const { myVote, vote, hasVoted } = useTriviaVoter(
    sessionId, questionIdx, user?.id, user?.team
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
        <div style={{ fontSize: 14, color: "#86EFAC" }}>¡Tu equipo ganó el cupón! 🎉</div>
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
              disabled={hasVoted || triviaState === "revealed"}
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
    </div>
  );
}

// ─── Sumá el Número ────────────────────────────────────────────────────────
function SumaElNumero({ user, gameState }) {
  const target  = gameState?.minijuego_payload?.target_number || 28;
  const [myNum] = useState(() => rand(1, 9));

  return (
    <div>
      <div className="sec-hdr"><span style={{ fontSize: 20 }}>🔢</span><h3>Sumate que sumamos</h3></div>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "rgba(245,230,192,.4)", marginBottom: 8 }}>
          Objetivo: sumá {target} exacto con otros usuarios
        </div>
      </div>
      <div style={{
        textAlign: "center", padding: "16px", marginBottom: 12,
        background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.25)", borderRadius: 14,
      }}>
        <div style={{ fontSize: 11, color: "rgba(239,68,68,.7)", marginBottom: 4 }}>Tu número</div>
        <div style={{ fontFamily: "Syne, sans-serif", fontSize: 52, fontWeight: 900, color: "#EF4444", lineHeight: 1 }}>
          {myNum}
        </div>
      </div>
      <div style={{
        padding: "12px 14px", background: "rgba(255,215,0,.06)",
        border: "1px solid rgba(255,215,0,.14)", borderRadius: 10,
        fontSize: 12, color: "rgba(255,215,0,.5)", textAlign: "center",
      }}>
        Encontrá a otros jugadores y sumá {target} exacto para ganar 🎯
      </div>
    </div>
  );
}

// ─── Formá la Palabra ──────────────────────────────────────────────────────
function FormaLaPalabra({ user, gameState }) {
  const words   = ["DISCO","FIESTA","BAILE","RITMO","NOCHE"];
  const word    = gameState?.minijuego_payload?.target_word || words[rand(0, words.length - 1)];
  const letters = word.split("");
  const [myLetter] = useState(() => letters[rand(0, letters.length - 1)]);

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
export default function JuegosView({ user, activeGame, isRestricted, onGoProfile, sessionId, gameState }) {
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

  if (!activeGame) return <GameStandby />;

  switch (activeGame) {
    case "rey del orto": return <ReyDelOrto user={user} gameState={gameState} />;
    case "trivia":       return <DesafioDemente user={user} sessionId={sessionId} gameState={gameState} />;
    case "suma":         return <SumaElNumero user={user} gameState={gameState} />;
    case "palabra":      return <FormaLaPalabra user={user} gameState={gameState} />;
    default:             return <GameStandby />;
  }
}