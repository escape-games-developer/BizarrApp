import { useState, useCallback, useRef, useEffect } from "react";
import { useRaffle }    from "../../hooks/useRaffle";
import { BlockedView }  from "../../components/UI";
import { rand }         from "../../constants/theme";
import { STROBE_COLORS } from "../../constants/data";

// ─── Pantalla de espera (sin juego activo) ─────────────────────────────────
function GameStandby() {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "40px 16px", textAlign: "center", minHeight: 260,
    }}>
      <div style={{ fontSize: 48, marginBottom: 14, opacity: .2 }}>🎮</div>
      <div style={{
        fontFamily: "Syne, sans-serif", fontSize: 16, fontWeight: 800,
        color: "rgba(255,215,0,.28)", marginBottom: 8,
      }}>
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
function ReyDelOrto({ user }) {
  const { state, cd, color, dark, winner, prize, setPrize, launch, reset, isStrobe, isWinner } = useRaffle();
  const iWon = isWinner && !!user; // en prod: verificar si user.id === winner.userId

  return (
    <div>
      <div className="sec-hdr">
        <span style={{ fontSize: 20 }}>🎰</span>
        <h3>Rey del Orto</h3>
      </div>

      {state === "idle" && (
        <>
          <div style={{
            fontSize: 12, color: "rgba(245,230,192,.5)", lineHeight: 1.6, marginBottom: 16,
          }}>
            El staff va a lanzar el sorteo. Todos los celulares van a titilar.
            El que quede en verde es el ganador.
          </div>
          <div style={{
            padding: "12px 14px", borderRadius: 12,
            background: "rgba(255,215,0,.06)", border: "1px solid rgba(255,215,0,.14)",
            fontSize: 12, color: "rgba(255,215,0,.5)", textAlign: "center",
          }}>
            ⏳ Esperá que el staff lance el sorteo...
          </div>
        </>
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
            color: dark ? "rgba(245,230,192,.03)" : "rgba(0,0,0,.18)",
            lineHeight: 1,
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
          border:     `1px solid ${iWon ? "rgba(34,197,94,.3)" : "rgba(255,255,255,.08)"}`,
          borderRadius: 16, animation: "fadeUp .5s ease",
        }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>
            {iWon ? "🏆" : "😅"}
          </div>
          <div style={{
            fontFamily: "Syne, sans-serif", fontSize: 18, fontWeight: 900,
            color: iWon ? "#22C55E" : "rgba(245,230,192,.5)",
            marginBottom: 6,
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

// ─── Sumá el Número ─────────────────────────────────────────────────────────
function SumaElNumero({ user }) {
  const [myNum]  = useState(() => rand(1, 9));
  const [group,  setGroup]  = useState([]);
  const [won,    setWon]    = useState(false);
  const TARGET   = 28;
  const total    = [myNum, ...group.map((n) => n.num)].reduce((a, b) => a + b, 0);

  const addSimUser = useCallback(() => {
    if (group.length >= 4) return;
    setGroup((g) => [...g, { id: Date.now(), name: `Usuario ${g.length + 2}`, num: rand(1, 9) }]);
  }, [group.length]);

  const remove = useCallback((id) => setGroup((g) => g.filter((u) => u.id !== id)), []);

  useEffect(() => { if (total === TARGET && group.length > 0) setWon(true); }, [total, group.length]);

  if (won) return (
    <div style={{ textAlign: "center", padding: "24px 16px", animation: "fadeUp .5s ease" }}>
      <div style={{ fontSize: 48, marginBottom: 10 }}>🎉</div>
      <div style={{ fontFamily: "Syne, sans-serif", fontSize: 20, fontWeight: 900, color: "#FFD700", marginBottom: 6 }}>
        ¡Corrán al escenario!
      </div>
      <div style={{ fontSize: 13, color: "rgba(245,230,192,.6)" }}>Sumaron {TARGET} exacto</div>
    </div>
  );

  return (
    <div>
      <div className="sec-hdr"><span style={{ fontSize: 20 }}>🔢</span><h3>Sumá el Número</h3></div>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "rgba(245,230,192,.4)", marginBottom: 8 }}>
          Objetivo: suma {TARGET} exacto con otros usuarios
        </div>
        <div style={{
          display: "inline-block", padding: "6px 20px",
          background: "rgba(255,215,0,.08)", border: "1px solid rgba(255,215,0,.2)",
          borderRadius: 20, fontSize: 14, color: "#FFD700", fontWeight: 700,
        }}>
          Total actual: <strong>{total}</strong> / {TARGET}
        </div>
      </div>
      {/* Tu número */}
      <div style={{
        textAlign: "center", padding: "16px", marginBottom: 12,
        background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.25)", borderRadius: 14,
      }}>
        <div style={{ fontSize: 11, color: "rgba(239,68,68,.7)", marginBottom: 4 }}>Tu número</div>
        <div style={{ fontFamily: "Syne, sans-serif", fontSize: 52, fontWeight: 900, color: "#EF4444", lineHeight: 1 }}>
          {myNum}
        </div>
      </div>
      {/* Grupo */}
      {group.map((u) => (
        <div key={u.id} style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 12px", marginBottom: 6, borderRadius: 10,
          background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)",
        }}>
          <span style={{ fontFamily: "Syne, sans-serif", fontSize: 20, fontWeight: 900, color: "#FFD700", width: 32 }}>
            {u.num}
          </span>
          <span style={{ flex: 1, fontSize: 12 }}>{u.name}</span>
          <button onClick={() => remove(u.id)} style={{
            background: "none", border: "none", color: "rgba(239,68,68,.6)",
            cursor: "pointer", fontSize: 14,
          }}>✕</button>
        </div>
      ))}
      <button
        className="btn-primary"
        style={{ background: "linear-gradient(135deg, #EF4444, #F97316)" }}
        onClick={addSimUser}
        disabled={group.length >= 4}
      >
        + Agregar compañero al grupo (demo)
      </button>
    </div>
  );
}

// ─── Formá la Palabra ────────────────────────────────────────────────────────
function FormaLaPalabra({ user }) {
  const WORDS   = ["DISCO","FIESTA","BAILE","RITMO","NOCHE"];
  const [word]  = useState(() => WORDS[rand(0, WORDS.length - 1)]);
  const letters = word.split("");
  const [myLetter] = useState(() => letters[rand(0, letters.length - 1)]);
  const [group,  setGroup]  = useState([]);
  const [won,    setWon]    = useState(false);

  const allLetters  = [myLetter, ...group.map((m) => m.letter)];
  const wordFormed  = allLetters.length === letters.length &&
                      [...allLetters].sort().join("") === [...letters].sort().join("");

  useEffect(() => { if (wordFormed) setWon(true); }, [wordFormed]);

  const addLetter = useCallback(() => {
    const remaining = letters.filter((l) => !allLetters.includes(l));
    if (remaining.length === 0) return;
    const letter = remaining[rand(0, remaining.length - 1)];
    setGroup((g) => [...g, { id: Date.now(), name: `Usuario ${g.length + 2}`, letter }]);
  }, [letters, allLetters]);

  if (won) return (
    <div style={{ textAlign: "center", padding: "24px 16px", animation: "fadeUp .5s ease" }}>
      <div style={{ fontSize: 48, marginBottom: 10 }}>🔤</div>
      <div style={{ fontFamily: "Syne, sans-serif", fontSize: 28, fontWeight: 900, color: "#A855F7", marginBottom: 6 }}>
        {word}
      </div>
      <div style={{ fontFamily: "Syne, sans-serif", fontSize: 18, fontWeight: 800, color: "#F5E6C0" }}>
        ¡Corrán al escenario!
      </div>
    </div>
  );

  return (
    <div>
      <div className="sec-hdr"><span style={{ fontSize: 20 }}>🔤</span><h3>Formá la Palabra</h3></div>
      <div style={{ textAlign: "center", marginBottom: 12, fontSize: 11, color: "rgba(245,230,192,.4)" }}>
        Encontrá a los que tienen las otras letras de la palabra
      </div>
      {/* Palabra objetivo (simulada en pantalla gigante) */}
      <div style={{
        display: "flex", gap: 6, justifyContent: "center", marginBottom: 16,
      }}>
        {letters.map((l, i) => {
          const filled = allLetters[i];
          return (
            <div key={i} style={{
              width: 40, height: 44, borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "Syne, sans-serif", fontSize: 20, fontWeight: 900,
              background: filled ? "rgba(168,85,247,.2)" : "rgba(255,255,255,.05)",
              border:     `1px solid ${filled ? "#A855F7" : "rgba(255,255,255,.1)"}`,
              color:      filled ? "#C084FC" : "rgba(245,230,192,.2)",
            }}>
              {filled || "_"}
            </div>
          );
        })}
      </div>
      {/* Tu letra */}
      <div style={{
        textAlign: "center", padding: "14px", marginBottom: 12,
        background: "rgba(168,85,247,.1)", border: "1px solid rgba(168,85,247,.3)", borderRadius: 14,
      }}>
        <div style={{ fontSize: 11, color: "rgba(168,85,247,.7)", marginBottom: 4 }}>Tu letra</div>
        <div style={{ fontFamily: "Syne, sans-serif", fontSize: 52, fontWeight: 900, color: "#A855F7", lineHeight: 1 }}>
          {myLetter}
        </div>
      </div>
      {group.map((m) => (
        <div key={m.id} style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 12px", marginBottom: 6, borderRadius: 10,
          background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)",
        }}>
          <span style={{ fontFamily: "Syne, sans-serif", fontSize: 20, fontWeight: 900, color: "#A855F7", width: 28 }}>
            {m.letter}
          </span>
          <span style={{ flex: 1, fontSize: 12 }}>{m.name}</span>
        </div>
      ))}
      <button
        className="btn-primary"
        style={{ background: "linear-gradient(135deg, #A855F7, #EC4899)" }}
        onClick={addLetter}
        disabled={allLetters.length >= letters.length}
      >
        + Agregar compañero (demo)
      </button>
    </div>
  );
}

// ─── Desafío Demente (trivia inline) ────────────────────────────────────────
function DesafioDementeInline({ user }) {
  const { TEAMS } = require("../../constants/theme");
  const t = user?.team ? TEAMS[user.team] : null;

  return (
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
          <div style={{ fontSize: 11, color: t.color, opacity: .7, marginTop: 4 }}>Tu equipo ✓</div>
        </div>
      ) : (
        <div style={{
          padding: "10px 14px", marginBottom: 14,
          background: "rgba(255,215,0,.07)", border: "1px solid rgba(255,215,0,.15)", borderRadius: 10,
          fontSize: 12, color: "rgba(255,215,0,.6)", textAlign: "center",
        }}>
          ⚠️ No elegiste equipo aún. Andá a tu perfil y elegí Team Batata o Team Membrillo.
        </div>
      )}
      <div style={{ padding: "12px 14px", background: "rgba(138,85,247,.1)", border: "1px solid rgba(138,85,247,.25)", borderRadius: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(138,85,247,.8)", letterSpacing: "1px", marginBottom: 8 }}>CÓMO FUNCIONA</div>
        {[
          "El staff lanza una pregunta a la vez",
          "Tocás la respuesta que creés correcta",
          "Los votos de tu equipo suman puntos",
          "El equipo ganador recibe un cupón de descuento",
        ].map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(138,85,247,.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#C084FC", flexShrink: 0 }}>{i + 1}</div>
            <div style={{ fontSize: 11, color: "rgba(245,230,192,.7)" }}>{s}</div>
          </div>
        ))}
      </div>
      <div style={{ textAlign: "center", padding: "12px 0", fontSize: 12, color: "rgba(255,215,0,.3)" }}>
        ⏳ Esperá que el staff lance la primera pregunta...
      </div>
    </div>
  );
}

// ─── JuegosView (router principal) ───────────────────────────────────────────
export default function JuegosView({ user, activeGame, isRestricted, onGoProfile }) {
  if (isRestricted) {
    return (
      <BlockedView
        icon="🎮"
        label="Juegos"
        reason={!user?.registered ? "Registrate para participar en los juegos y sorteos." : "Verificá tu ubicación en el bar para jugar."}
        onCTA={onGoProfile}
        ctaLabel={!user?.registered ? "👤 Registrarme" : "📍 Verificar ubicación"}
      />
    );
  }

  if (!activeGame) return <GameStandby />;

  switch (activeGame) {
    case "rey del orto": return <ReyDelOrto user={user} />;
    case "suma":         return <SumaElNumero user={user} />;
    case "palabra":      return <FormaLaPalabra user={user} />;
    case "trivia":       return <DesafioDementeInline user={user} />;
    default:             return <GameStandby />;
  }
}
