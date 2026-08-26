import { useMemo } from "react";
import { P, conSigno, colorScore, MOTIVO_HISTORIAL } from "../../components/pantalla/pantallaUi";

/**
 * Historial musical de la noche, no una tabla de auditoría.
 *
 * El score que se muestra es `won_with_score`: el puntaje congelado con el que
 * el tema ganó la votación antes de pasar a sonar. Los datos vienen del panel
 * (una sola suscripción para todo el módulo); acá sólo se presentan.
 */
export default function HistorialTab({ history }) {
  const resumen = useMemo(() => ({
    temas:      history.length,
    aFavor:     history.reduce((a, h) => a + (h.pos_votes || 0), 0),
    volteadas:  history.filter((h) => h.ended_reason === "kick").length,
    mejor:      [...history].sort((a, b) => (b.final_score || 0) - (a.final_score || 0))[0] || null,
  }), [history]);

  return (
    <>
      <div className="pdj-card pdj-card-acento">
        <div className="pdj-card-titulo">
          <span style={{ fontSize: 15 }}>🕘</span><h4>Resumen de la noche</h4>
        </div>
        <div className="pdj-metricas">
          {[
            { v: resumen.temas,     l: "Temas sonados", c: P.amarillo },
            { v: resumen.aFavor,    l: "👍 A favor",    c: P.verde },
            { v: resumen.volteadas, l: "👎 Volteadas",  c: P.fucsia },
          ].map((m) => (
            <div key={m.l} className="pdj-metrica" style={{ background: `${m.c}12`, borderColor: `${m.c}30` }}>
              <div className="pdj-metrica-v" style={{ color: m.c }}>{m.v}</div>
              <div className="pdj-metrica-l">{m.l}</div>
            </div>
          ))}
        </div>

        {resumen.mejor && (
          <div style={{ marginTop: 12, fontSize: 11.5, color: P.tenue }}>
            🏆 La más votada de la noche:{" "}
            <strong style={{ color: P.texto }}>{resumen.mejor.title}</strong>
            {" "}con <strong style={{ color: P.verde }}>{conSigno(resumen.mejor.final_score)} pts</strong>
          </div>
        )}
      </div>

      <div className="pdj-card">
        <div className="pdj-card-titulo">
          <span style={{ fontSize: 15 }}>🎶</span>
          <h4>Ya sonaron</h4>
          <span className="pdj-hint">de la más reciente a la más vieja</span>
        </div>

        {history.length === 0 ? (
          <div className="pdj-vacio">
            <div className="pdj-vacio-ico">🕘</div>
            <div className="pdj-vacio-tit">Todavía no se reprodujeron canciones</div>
            <div className="pdj-vacio-txt">
              Cuando el DJ avance, cada tema queda registrado acá con el score que lo hizo ganar
              y el motivo por el que terminó.
            </div>
          </div>
        ) : history.map((h, i) => {
          const motivo = MOTIVO_HISTORIAL[h.ended_reason] || MOTIVO_HISTORIAL.advance;
          return (
            <div key={h.id} className="pdj-hist">
              <span className="pdj-hist-n">{history.length - i}</span>

              {h.cover_url
                ? <img className="pdj-hist-cover" src={h.cover_url} alt="" loading="lazy" decoding="async"
                    onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                : <div className="pdj-hist-cover" style={{ display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 17, opacity: .3,
                    background: "rgba(240,232,255,.05)" }}>🎵</div>}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 700, color: P.texto, lineHeight: 1.25,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{h.title}</div>
                <div style={{ fontSize: 11, color: P.tenue2, marginTop: 1,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {h.artist || "—"}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10.5, color: P.tenue }}>
                    👍 {h.pos_votes ?? 0} · 👎 {h.neg_votes ?? 0}
                  </span>
                  <span className="pdj-chip" style={{
                    background: `${motivo.color}18`, color: motivo.color,
                  }}>{motivo.icono} {motivo.label}</span>
                </div>
              </div>

              <div style={{ flexShrink: 0, textAlign: "right" }}>
                <b style={{
                  fontFamily: "'Syne',sans-serif", fontWeight: 900, fontSize: 18,
                  display: "block", lineHeight: 1, color: colorScore(h.final_score),
                }}>{conSigno(h.final_score)}</b>
                <span style={{ fontSize: 8, color: P.tenue2, letterSpacing: ".5px" }}>GANÓ CON</span>
                <div style={{ fontSize: 9.5, color: P.tenue2, marginTop: 4 }}>
                  {new Date(h.played_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
