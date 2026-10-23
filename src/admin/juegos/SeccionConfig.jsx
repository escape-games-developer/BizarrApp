/** Cuándo se aplica un cambio, dicho igual en todos los juegos. */
const CUANDO = {
  ronda: "Rige desde la próxima ronda",
  tv:    "La TV lo toma en ≤ 3 s",
  app:   "Los clientes lo ven al abrir la app",
};

/** Bloque de configuración de un juego: título, cuándo se aplica y contenido. */
export function SeccionConfig({ icon, titulo, cuando, children, style }) {
  return (
    <div className="card" style={{ marginBottom: 10, ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <div className="ctitle" style={{ margin: 0, flex: 1 }}>{icon} {titulo}</div>
        {cuando && (
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: .5, textTransform: "uppercase",
            padding: "3px 7px", borderRadius: 6, color: "rgba(240,232,255,.55)",
            background: "rgba(240,232,255,.05)", border: "1px solid rgba(240,232,255,.12)" }}>
            {CUANDO[cuando]}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

/** Aviso de guardado (✓ / ✕) debajo de un control. */
export function AvisoGuardado({ aviso }) {
  if (!aviso) return null;
  return (
    <div role={aviso.ok ? "status" : "alert"}
      style={{ fontSize: 10.5, color: aviso.ok ? "#00F5A0" : "#FCA5A5", marginTop: 8, lineHeight: 1.5 }}>
      {aviso.ok ? "✓ " : "✕ "}{aviso.text}
    </div>
  );
}
