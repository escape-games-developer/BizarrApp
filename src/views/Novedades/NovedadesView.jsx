export default function NovedadesView({ banners = [] }) {
  const visible = banners.filter((b) => b.visible !== false);

  if (visible.length === 0) {
    return (
      <div style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "48px 20px", textAlign: "center",
      }}>
        <div style={{ fontSize: 44, marginBottom: 14, opacity: .2 }}>📣</div>
        <div style={{
          fontFamily: "Syne, sans-serif", fontSize: 15, fontWeight: 800,
          color: "rgba(255,215,0,.25)", marginBottom: 8,
        }}>
          Sin novedades por ahora
        </div>
        <div style={{ fontSize: 12, color: "rgba(245,230,192,.22)", lineHeight: 1.5 }}>
          El staff publicará las promos y novedades de la noche acá.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="sec-hdr">
        <span style={{ fontSize: 20 }}>📣</span>
        <h3>Novedades y Promos</h3>
      </div>

      {visible.map((b, i) => (
        <div
          key={b.id || i}
          className="fade-up"
          style={{
            padding:      "14px 16px",
            marginBottom: 10,
            borderRadius: 14,
            background:   b.bg     || "rgba(255,215,0,.07)",
            border:       `1px solid ${b.border || "rgba(255,215,0,.18)"}`,
            animationDelay: `${i * .07}s`,
            animationFillMode: "both",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ fontSize: 28, flexShrink: 0, marginTop: 2 }}>
              {b.emoji || "📢"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 15,
                color: b.color || "#FFD700", marginBottom: 4, lineHeight: 1.2,
              }}>
                {b.title}
              </div>
              {b.body && (
                <div style={{
                  fontSize: 12, color: "rgba(245,230,192,.65)",
                  lineHeight: 1.5, marginBottom: 6,
                }}>
                  {b.body}
                </div>
              )}
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "2px 9px", borderRadius: 10,
                background: "rgba(255,215,0,.08)", border: "1px solid rgba(255,215,0,.15)",
                fontSize: 9, fontWeight: 700, color: "rgba(255,215,0,.5)", letterSpacing: ".5px",
              }}>
                {b.tag || "NOVEDAD"}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
