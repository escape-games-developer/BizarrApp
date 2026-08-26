import { dTokens, DISPLAY_FONT } from "../tokens";

// Votos del líder — fija la escala de las barras hasta que haya datos reales.
const MAX_VOTES = 132;

const COLORS = {
  magenta: { hex: dTokens.magenta, glow: dTokens.glowMagenta, bright: "#F472B6" },
  cyan:    { hex: dTokens.cyan,    glow: dTokens.glowCyan,    bright: "#38BDF8" },
  yellow:  { hex: dTokens.yellow,  glow: dTokens.glowYellow,  bright: "#FCD34D" },
};

const styles = {
  card: {
    background: "rgba(15, 8, 25, 0.85)",
    borderRadius: 14,
    // Padding y gap proporcionales al canvas: con valores fijos la tarjeta no
    // entraba en la fila y se recortaban el contador y la barra.
    padding: "clamp(6px, 1.1cqw, 14px)",
    // /designer no tiene reset global de box-sizing (ver DesignerCanvas).
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "clamp(2px, 0.45cqw, 8px)",
    position: "relative",
    overflow: "hidden",
    minWidth: 0,
  },
  avatar: {
    width: "clamp(24px, 5.2cqw, 120px)",
    aspectRatio: "1 / 1",
    boxSizing: "border-box",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #2A0E3D, #4A1560)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarInitial: {
    fontFamily: DISPLAY_FONT,
    fontSize: "clamp(16px, 3.4cqw, 48px)",
    fontWeight: 900,
    color: "#FFFFFF",
    lineHeight: 1,
  },
  name: {
    fontFamily: DISPLAY_FONT,
    fontSize: "clamp(11px, 2.2cqw, 36px)",
    fontWeight: 900,
    color: "#FFFFFF",
    letterSpacing: "2px",
    lineHeight: 1.1,
    whiteSpace: "nowrap",
  },
  votesLabel: {
    fontSize: "clamp(7px, 0.95cqw, 11px)",
    letterSpacing: "2px",
    color: dTokens.textDim,
    whiteSpace: "nowrap",
  },
  votesCount: {
    fontFamily: DISPLAY_FONT,
    fontSize: "clamp(14px, 3.2cqw, 48px)",
    fontWeight: 900,
    color: "#FFFFFF",
    lineHeight: 1,
  },
  barTrack: {
    width: "100%",
    height: 6,
    // Sin esto flex la encoge a 0 cuando el contenido aprieta y la barra desaparece.
    flexShrink: 0,
    background: "rgba(255,255,255,0.1)",
    borderRadius: 3,
    overflow: "hidden",
  },
};

export default function ParticipantCard({ participant }) {
  const { name, votes, color, avatar } = participant;
  const c = COLORS[color] || COLORS.magenta;
  const pct = Math.max(0, Math.min(100, (votes / MAX_VOTES) * 100));

  return (
    <div style={{ ...styles.card, border: `2px solid ${c.hex}`, boxShadow: c.glow }}>
      <div style={{ ...styles.avatar, border: `3px solid ${c.hex}`, boxShadow: c.glow }}>
        <span style={styles.avatarInitial}>{avatar}</span>
      </div>

      <div style={{ ...styles.name, textShadow: `0 0 10px ${c.hex}` }}>{name}</div>

      <div style={styles.votesLabel}>⭐ VOTOS ⭐</div>

      <div style={styles.votesCount}>{votes}</div>

      <div style={styles.barTrack}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 3,
            background: `linear-gradient(90deg, ${c.hex} 0%, ${c.bright} 100%)`,
            boxShadow: c.glow,
          }}
        />
      </div>
    </div>
  );
}
