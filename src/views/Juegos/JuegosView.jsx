import { useRaffle }         from "../../hooks/useRaffle";
import { useTriviaQuestion, useTriviaVoter } from "../../hooks/realtime/useTriviaVotes";
import { BlockedView }       from "../../components/UI";
import { TEAMS }             from "../../constants/theme";
import CatalogoJuegos, { JUEGOS_CATALOGO } from "../../components/CatalogoJuegos";
import { useSumateRound }    from "../../hooks/realtime/useSumateRound";
import { useArmaPalabraRound } from "../../hooks/realtime/useArmaPalabraRound";

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
// Bloque a sección completa: anula el padding de `.app-content` (14/16/16) y
// ocupa todo el alto entre el header (logo) y la navegación, sin taparlos.
// `minHeight` cubre el caso en que el padre no tiene alto definido (la card
// del Duelo envuelve el juego en un div).
const SECCION_COMPLETA = {
  margin: "-14px -16px -16px", height: "calc(100% + 30px)", minHeight: 320,
  display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "center", textAlign: "center",
  padding: "24px 20px", boxSizing: "border-box",
};

function ReyDelOrto({ user, gameState }) {
  const { state, color, dark, isStrobe, isWinner, isCancelled } = useRaffle(gameState);
  const iWon = isWinner && user?.id && gameState?.raffle_winner_id === user.id;
  const prize = gameState?.raffle_prize || null;

  // ── Sorteo en curso: SÓLO los colores, como la pantalla gigante ──────────
  // Sin número ni texto: la cuenta regresiva vive en la pantalla gigante.
  if (isStrobe) return (
    <div aria-label="Sorteando" style={{ ...SECCION_COMPLETA, background: dark ? "#000" : color }} />
  );

  // ── Resultado: verde el que ganó, rojo los demás ──────────────────────────
  if (isWinner) return (
    <div style={{
      ...SECCION_COMPLETA,
      background: iWon ? "#16A34A" : "#DC2626",
      animation: "fadeUp .4s ease",
    }}>
      <div style={{ fontSize: 64, marginBottom: 12 }}>{iWon ? "🏆" : "😅"}</div>
      <div style={{
        fontFamily: "Syne, sans-serif", fontSize: 30, fontWeight: 900,
        color: "#FFFFFF", lineHeight: 1.1, marginBottom: 10,
      }}>
        {iWon ? "¡GANASTE!" : "Esta vez no fue..."}
      </div>
      {iWon && prize && (
        <div style={{ fontSize: 17, color: "#FFFFFF", fontWeight: 700 }}>
          Premio: {prize}
        </div>
      )}
      {!iWon && (
        <div style={{ fontSize: 14, color: "rgba(255,255,255,.85)" }}>
          La próxima es la tuya.
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div className="sec-hdr">
        <span style={{ fontSize: 20 }}>🎰</span>
        <h3>Rey del Orto</h3>
      </div>

      {state === "idle" && (
        <div style={{
          padding: "12px 14px", borderRadius: 12,
          background: "#000000", border: "1px solid rgba(255,215,0,.14)",
          fontSize: 12, color: "rgba(255,215,0,.5)", textAlign: "center",
        }}>
          ⏳ Esperá que el staff lance el sorteo...
        </div>
      )}

      {/* Ronda cancelada: el sorteo arrancó y el servidor rechazó la resolución
          definitiva. Sin esta rama la tarjeta quedaba vacía —`state` no es
          'idle', ni strobe, ni 'winner'— y el cliente veía sólo el título.

          Acá NO va el motivo. El "por qué" (cuánta gente había, qué mínimo
          estaba configurado, si las reglas dejaban participar) es información
          OPERATIVA: le sirve al staff en el Admin para arreglarlo, y en el
          celular del cliente sólo sonaría a excusa. Tampoco va el código
          interno, ni el ganador de la ronda anterior — el bloque de ganador
          está atado a `isWinner`, así que en 'cancelled' no puede aparecer. */}
      {isCancelled && (
        <div style={{
          padding: "16px 14px", borderRadius: 12, textAlign: "center",
          background: "#000000", border: "1px solid rgba(255,215,0,.16)",
        }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>👑</div>
          <div style={{
            fontFamily: "Syne, sans-serif", fontSize: 15, fontWeight: 900,
            color: "#FCD34D", marginBottom: 6,
          }}>
            El sorteo fue cancelado.
          </div>
          <div style={{ fontSize: 12, color: "rgba(245,230,192,.4)", lineHeight: 1.5 }}>
            Esperá al próximo lanzamiento.
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Desafío Demente ──────────────────────────────────────────────────────────
// `demo` (sólo vista previa del Diseñador): { question, myVote } de muestra.
// Con él los hooks no consultan nada; en producción llega siempre null.
function DesafioDemente({ user, sessionId, gameState, demo = null }) {
  const t = user?.team ? TEAMS[user.team] : null;
  const questionIdx = gameState?.trivia_question ?? 0;
  const triviaState = gameState?.trivia_state ?? "idle";
  const roundId = gameState?.trivia_round_id ?? null;
  const sesion = demo ? null : sessionId;
  const questionVivo = useTriviaQuestion(sesion, roundId, questionIdx, triviaState);
  const voter = useTriviaVoter(sesion, roundId, questionIdx, user?.id, user?.team);
  const question = demo ? demo.question : questionVivo;
  const { myVote, vote, hasVoted, sending, error } = demo
    ? { myVote: demo.myVote ?? null, vote: () => {}, hasVoted: demo.myVote != null, sending: false, error: null }
    : voter;

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
          background: "#000000", border: "1px solid rgba(255,215,0,.15)",
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
      {/* `trivia_winner_team === null` con la ronda terminada es EMPATE, no
          derrota: mismos aciertos en los dos equipos. Antes caía en el else y
          el que empataba leía lo mismo que el que perdía. */}
      {!gameState?.trivia_winner_team ? (
        <div style={{ fontSize: 15, fontWeight: 800, color: "#FCD34D" }}>🤝 ¡EMPATE!</div>
      ) : t && gameState.trivia_winner_team === user?.team ? (
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

// ─── Sumate que sumamos ────────────────────────────────────────────────────
// `demo` (sólo vista previa del Diseñador): { round, miNumero } de muestra.
function SumaElNumero({ user, sessionId, demo = null }) {
  // La ronda y el número vienen de la base, no de game_state: antes el número
  // salía de `minijuego_payload.assigned_number`, que es UNO para toda la
  // sesión — todos los celulares mostraban el mismo. Ahora es por persona.
  //
  // El número se asigna SOLO: no hay ningún botón que tocar. `sumate_obtener_numero`
  // es idempotente, así que un F5, dos pestañas o una reconexión devuelven
  // SIEMPRE el mismo número (`already_assigned: true`). El frontend no genera
  // ningún número: sólo muestra el que dio el servidor.
  const vivo = useSumateRound(demo ? null : sessionId, { userId: user?.id ?? null });
  const { round, miNumero, miNumeroRes, loading } = demo ? { loading: false, miNumeroRes: null, ...demo } : vivo;

  const header = (
    <div className="sec-hdr"><span style={{ fontSize: 20 }}>🔢</span><h3>Sumate que sumamos</h3></div>
  );

  const aviso = (emoji, titulo, texto, color = "rgba(245,230,192,.6)") => (
    <div>{header}
      <div style={{
        textAlign:"center", padding:"34px 20px", borderRadius:18,
        background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.1)",
      }}>
        <div style={{fontSize:40,marginBottom:10}}>{emoji}</div>
        <div style={{fontFamily:"Syne, sans-serif",fontWeight:800,fontSize:16,color,marginBottom:6}}>
          {titulo}
        </div>
        <div style={{fontSize:12.5,color:"rgba(245,230,192,.4)",lineHeight:1.5}}>{texto}</div>
      </div>
    </div>
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

    if (round.status === "finished") {
      return aviso("🏁", "Ronda terminada", "Encontraron la combinación correcta.");
    }
    // Cancelada: nunca hay ganador que mostrar, y el motivo técnico
    // (`cancel_reason`) es información del staff, no del cliente.
    return aviso("🏁", "La ronda terminó.", "Esperá al próximo lanzamiento.");
  }

  // ── Ronda en curso ────────────────────────────────────────────────────────
  // Sin número todavía: el motivo importa. `NOT_PRESENT` es el único accionable
  // por la persona (tiene que estar dentro del bar con la app abierta); el
  // resto son estados de la ronda que Realtime va a corregir solo.
  if (miNumero == null) {
    const code = miNumeroRes?.code;
    if (code === "NOT_PRESENT") {
      return aviso("📍", "No estás en la lista",
        "Verificá tu ubicación en el bar y volvé a entrar para recibir tu número.", "#FCD34D");
    }
    if (code === "ROUND_EXPIRED" || code === "ROUND_ALREADY_CANCELLED") {
      return aviso("🏁", "La ronda terminó.", "Esperá al próximo lanzamiento.");
    }
    if (code === "ROUND_ALREADY_FINISHED") {
      return aviso("🏁", "Ronda terminada", "Encontraron la combinación correcta.");
    }
    if (code === "ROUND_NOT_FOUND") {
      return aviso("🏁", "La ronda terminó.", "Esperá al próximo lanzamiento.");
    }
    if (miNumeroRes && !miNumeroRes.ok) {
      // Fallo técnico (red, permisos). Antes esto dejaba "TU NÚMERO …" colgado
      // para siempre, sin decir nada y sin salida.
      return aviso("📡", "No pudimos traer tu número",
        "Revisá tu conexión. Se reintenta solo al volver a entrar.", "#FCA5A5");
    }
    // Todavía en vuelo: se muestra el esqueleto, no un error.
    return (
      <div>{header}
        <div style={{textAlign:"center",padding:"48px 20px",fontSize:12,color:"rgba(245,230,192,.3)"}}>
          Pidiendo tu número…
        </div>
      </div>
    );
  }

  // Durante la ronda el celular muestra SÓLO el número propio. El objetivo y
  // la consigna viven exclusivamente en la Pantalla Gigante: ni objetivo, ni
  // números ajenos, ni instrucciones acá.
  return (
    <div>
      {header}

      {/* TU NÚMERO — la pieza central del celular. Grande y legible de un
          vistazo: la persona tiene que poder mostrarlo levantando el teléfono
          mientras camina por el bar. */}
      <div style={{
        textAlign:"center", padding:"26px 16px", borderRadius:16,
        background:"rgba(0,229,255,.08)", border:"1px solid rgba(0,229,255,.28)",
      }}>
        <div style={{fontSize:11,color:"rgba(0,229,255,.75)",letterSpacing:".14em",fontWeight:700,marginBottom:4}}>
          TU NÚMERO
        </div>
        <div style={{fontFamily:"Syne, sans-serif",fontSize:120,fontWeight:900,color:"#00E5FF",lineHeight:1}}>
          {miNumero}
        </div>
      </div>
    </div>
  );
}

// ─── Formá la Palabra ──────────────────────────────────────────────────────
// `demo` (sólo vista previa del Diseñador): { round, miLetra } de muestra.
function FormaLaPalabra({ user, sessionId, demo = null }) {
  // La ronda y la letra vienen de la base, no de game_state: antes la letra
  // salía de `minijuego_payload.assigned_letter`, que es UNA para toda la
  // sesión — todos los celulares mostraban la misma. Ahora es por persona.
  //
  // La letra se asigna SOLA: no hay ningún botón que tocar. El que entra con la
  // ronda ya empezada recibe un señuelo, sin alterar la palabra ni las letras
  // que ya están repartidas.
  const vivo = useArmaPalabraRound(demo ? null : sessionId, { userId: user?.id ?? null });
  const { round, miLetra, loading } = demo ? { loading: false, ...demo } : vivo;

  const header = (
    <div className="sec-hdr"><span style={{ fontSize: 20 }}>🔤</span><h3>Arma la palabra</h3></div>
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
          background:"linear-gradient(135deg, rgba(0,245,160,.16), rgba(168,85,247,.08))",
          border:"1px solid rgba(0,245,160,.4)",
        }}>
          <div style={{fontSize:48,marginBottom:8}}>🏆</div>
          <div style={{fontFamily:"Syne, sans-serif",fontWeight:900,fontSize:22,color:"#00F5A0",marginBottom:6}}>
            ¡GANARON!
          </div>
          <div style={{fontSize:13,color:"rgba(245,230,192,.6)"}}>
            Armaron la palabra correctamente.
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
              ? "Armaron la palabra correctamente."
              : "El staff cerró la ronda."}
          </div>
        </div>
      </div>
    );
  }

  // ── Ronda en curso ────────────────────────────────────────────────────────
  // La PALABRA no se dibuja acá: vive sólo en la pantalla gigante, igual que el
  // objetivo de Sumate. `round.target_word` llega en el estado de la ronda
  // (lo necesitan /tv y el panel) pero esta vista no lo renderiza nunca.
  return (
    <div>
      {header}
      {/* Sólo la letra propia: ni la palabra, ni letras ajenas, ni nombres, ni
          la solución. La consigna la da la pantalla gigante. */}
      <div style={{
        textAlign:"center", padding:"22px 16px", borderRadius:16,
        background:"rgba(168,85,247,.1)", border:"1px solid rgba(168,85,247,.3)",
      }}>
        <div style={{fontSize:11,color:"rgba(168,85,247,.8)",letterSpacing:".14em",fontWeight:700,marginBottom:6}}>
          TU LETRA
        </div>
        <div style={{fontFamily:"Syne, sans-serif",fontSize:110,fontWeight:900,color:"#A855F7",lineHeight:1}}>
          {miLetra ?? "…"}
        </div>
      </div>

      {/* La consigna termina en el ESCENARIO, no en la app: el grupo se junta y
          se acerca, y el staff resuelve ahí. No hay validación digital. */}
      <div style={{
        marginTop:10, padding:"14px", borderRadius:12, textAlign:"center", lineHeight:1.6,
        background:"rgba(168,85,247,.07)", border:"1px solid rgba(168,85,247,.18)",
        fontSize:12.5, color:"rgba(240,232,255,.55)",
      }}>
        Encontrá a las personas que necesitás para formar la palabra.
        <div style={{
          marginTop:10, paddingTop:10, borderTop:"1px solid rgba(168,85,247,.18)",
          fontFamily:"Syne, sans-serif", fontWeight:900, fontSize:13.5, color:"#C084FC",
        }}>
          ¡Júntense y acérquense al escenario!
        </div>
      </div>
    </div>
  );
}

// ─── Desafío Demente anunciado ────────────────────────────────────────────
/**
 * Aviso de "próximamente" dentro de la sección Juegos.
 *
 * Se apoya en la capa que el admin ya usa para anunciar en la pantalla
 * gigante (`active_placa='game_trivia'`, que escribe `announceGame`), sin
 * columnas ni push nuevos. Anunciar NO es jugar: mientras `active_game` no
 * sea 'trivia' esto es sólo un aviso, sin nada que tocar.
 *
 * Patrón visual de card apagada: logo en gris y CTA
 * deshabilitado, para que se lea distinto de un juego en curso.
 */
function TriviaProximamenteCard() {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        borderRadius: 18, padding: "18px 16px", textAlign: "center",
        background: "linear-gradient(135deg, rgba(155,47,255,.12), rgba(255,45,120,.08))",
        border: "1.5px solid rgba(155,47,255,.4)",
      }}>
        <img
          src="/placas/Desafio_demente-removebg-preview.png"
          alt="Desafío Demente"
          style={{
            width: 120, height: 120, objectFit: "contain", margin: "0 auto 8px",
            filter: "grayscale(.35) opacity(.85)",
          }}
          onError={(e) => { e.target.style.display = "none"; }}
        />
        <div style={{
          fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: 18,
          color: "#C084FC", marginBottom: 4,
        }}>
          Desafío Demente
        </div>
        <div style={{ fontSize: 12, color: "rgba(245,230,192,.45)", marginBottom: 12 }}>
          Team Batata 🍠 vs Team Membrillo 🍋
        </div>
        <button disabled style={{
          width: "100%", padding: "13px 16px", borderRadius: 12,
          background: "rgba(255,255,255,.04)", color: "rgba(245,230,192,.35)",
          border: "1px solid rgba(255,255,255,.08)",
          fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 13,
          cursor: "not-allowed",
        }}>
          Próximamente
        </button>
        <div style={{ fontSize: 11, color: "rgba(255,215,0,.45)", marginTop: 10 }}>
          ⏳ Preparate — arranca en breve
        </div>
      </div>
    </div>
  );
}

// ─── Arma la Palabra anunciada ────────────────────────────────────────────
/**
 * Aviso de "próximamente" de Arma la Palabra dentro de la sección Juegos.
 *
 * Igual que la de Desafío Demente, se apoya en la capa que el admin ya usa
 * para anunciar en la pantalla gigante (`active_placa='game_palabra'`, que
 * escribe `announceGame`): sin columnas, sin push. Anunciar NO es jugar —
 * mientras `active_game` no sea 'palabra' esto es sólo un aviso.
 *
 * Deliberadamente NO comparte código con TriviaProximamenteCard: ese módulo
 * está cerrado y no se toca. Si aparece un tercer juego con el mismo patrón,
 * ahí valdrá la pena unificar las tres.
 */
function PalabraProximamenteCard() {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        borderRadius: 18, padding: "18px 16px", textAlign: "center",
        background: "linear-gradient(135deg, rgba(168,85,247,.12), rgba(255,45,120,.08))",
        border: "1.5px solid rgba(168,85,247,.4)",
      }}>
        <img
          src="/placas/Arma_la_palabra-removebg-preview.png"
          alt="Arma la palabra"
          style={{
            width: 120, height: 120, objectFit: "contain", margin: "0 auto 8px",
            filter: "grayscale(.35) opacity(.85)",
          }}
          onError={(e) => { e.target.style.display = "none"; }}
        />
        <div style={{
          fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: 18,
          color: "#C77DFF", marginBottom: 4,
        }}>
          Arma la palabra
        </div>
        <div style={{ fontSize: 12, color: "rgba(245,230,192,.45)", marginBottom: 12 }}>
          Encontrá a los que tienen las otras letras 🔤
        </div>
        <button disabled style={{
          width: "100%", padding: "13px 16px", borderRadius: 12,
          background: "rgba(255,255,255,.04)", color: "rgba(245,230,192,.35)",
          border: "1px solid rgba(255,255,255,.08)",
          fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 13,
          cursor: "not-allowed",
        }}>
          Próximamente
        </button>
        <div style={{ fontSize: 11, color: "rgba(255,215,0,.45)", marginTop: 10 }}>
          ⏳ Preparate — arranca en breve
        </div>
      </div>
    </div>
  );
}

/**
 * Anuncio de Rey del Orto, Sumate o el Duelo: la placa está en la pantalla
 * gigante (`active_placa`) pero todavía no hay sorteo, ronda ni convocatoria.
 * Mismo formato que las cards de Desafío y Arma. Sólo informa: no hay CTA,
 * la postulación del Duelo aparece recién con su convocatoria.
 */
const PROXIMAMENTE = {
  game_rey:  { img: "/placas/Rey_del_orto-removebg-preview.png",       nombre: "Rey del Orto",
               color: "#FFD700", rgb: "255,215,0",  bajada: "Se viene el sorteo 🎰" },
  game_suma: { img: "/placas/Sumate_que_sumamos-removebg-preview.png", nombre: "Sumate que sumamos",
               color: "#FF9500", rgb: "255,149,0",  bajada: "Te va a tocar un número: armá el objetivo en grupo 🔢" },
  duelo:     { img: "/placas/Duelo_de_talento-removebg-preview.png",   nombre: "Duelo de Talentos",
               color: "#FF2D95", rgb: "255,45,149", bajada: "Cuando abra la convocatoria vas a poder postularte 🎤" },
};

function ProximamenteCard({ placa }) {
  const p = PROXIMAMENTE[placa];
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        borderRadius: 18, padding: "18px 16px", textAlign: "center",
        background: `linear-gradient(135deg, rgba(${p.rgb},.12), rgba(255,45,120,.08))`,
        border: `1.5px solid rgba(${p.rgb},.4)`,
      }}>
        <img
          src={p.img}
          alt={p.nombre}
          style={{
            width: 120, height: 120, objectFit: "contain", margin: "0 auto 8px",
            filter: "grayscale(.35) opacity(.85)",
          }}
          onError={(e) => { e.target.style.display = "none"; }}
        />
        <div style={{
          fontFamily: "Syne, sans-serif", fontWeight: 900, fontSize: 18,
          color: p.color, marginBottom: 4,
        }}>
          {p.nombre}
        </div>
        <div style={{ fontSize: 12, color: "rgba(245,230,192,.45)", marginBottom: 12 }}>
          {p.bajada}
        </div>
        <button disabled style={{
          width: "100%", padding: "13px 16px", borderRadius: 12,
          background: "rgba(255,255,255,.04)", color: "rgba(245,230,192,.35)",
          border: "1px solid rgba(255,255,255,.08)",
          fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 13,
          cursor: "not-allowed",
        }}>
          Próximamente
        </button>
        <div style={{ fontSize: 11, color: "rgba(255,215,0,.45)", marginTop: 10 }}>
          ⏳ Preparate — arranca en breve
        </div>
      </div>
    </div>
  );
}

// ─── JuegosView (router) ──────────────────────────────────────────────────
// `demo`: datos de muestra del juego activo, sólo para la vista previa del
// Diseñador (ver preview/celularDemo.js). En la app llega siempre null.
export default function JuegosView({ user, activeGame, isRestricted, onGoProfile, sessionId, gameState, mostrarCatalogo = false, demo = null }) {
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

  // El Duelo de Talentos vive en Escenario (EscenarioView): Juegos no lo muestra.

  // Anuncio del Desafío: la placa está en la pantalla gigante pero el juego
  // todavía no arrancó. Si `activeGame` ya es 'trivia', manda el juego real y
  // este aviso no se muestra — el switch de abajo lo resuelve solo.
  const triviaAnunciada = gameState?.active_placa === "game_trivia" && activeGame !== "trivia";
  // Mismo criterio para Arma la Palabra. Son excluyentes en la práctica:
  // `active_placa` guarda una sola placa a la vez.
  const palabraAnunciada = gameState?.active_placa === "game_palabra" && activeGame !== "palabra";
  // Rey del Orto y Sumate: misma idea. El Duelo NO tiene aviso previo: o está
  // en el escenario (y Juegos es su postulación) o no se muestra nada.
  const otroAnunciado =
    (gameState?.active_placa === "game_rey"  && activeGame !== "rey del orto") ? "game_rey"
    : (gameState?.active_placa === "game_suma" && activeGame !== "suma")         ? "game_suma"
    : null;
  const hayAnuncio = triviaAnunciada || palabraAnunciada || !!otroAnunciado;

  // Contenido del juego activo (o standby si no hay ninguno).
  let gameContent;
  switch (activeGame) {
    case "rey del orto": gameContent = <ReyDelOrto user={user} gameState={gameState} />; break;
    case "trivia":       gameContent = <DesafioDemente user={user} sessionId={sessionId} gameState={gameState} demo={demo} />; break;
    case "suma":         gameContent = <SumaElNumero user={user} sessionId={sessionId} demo={demo} />; break;
    case "palabra":      gameContent = <FormaLaPalabra user={user} sessionId={sessionId} demo={demo} />; break;
    // Sin juego: las cards de los juegos (Ajustes → General → Cards de juegos)
    // o la espera vacía de siempre.
    default:             gameContent = hayAnuncio ? null : mostrarCatalogo
      ? <CatalogoJuegos juegos={JUEGOS_CATALOGO}/>
      : <GameStandby />;
  }

  // Sin anuncio, el contenido va directo: las cards necesitan el alto completo
  // de la sección y un div envolvente sin alto se lo cortaría.
  if (!activeGame && !hayAnuncio) return gameContent;
  if (!activeGame) return (
    <div>
      {triviaAnunciada  && <TriviaProximamenteCard />}
      {palabraAnunciada && <PalabraProximamenteCard />}
      {otroAnunciado    && <ProximamenteCard placa={otroAnunciado} />}
      {gameContent}
    </div>
  );
  return gameContent;
}
