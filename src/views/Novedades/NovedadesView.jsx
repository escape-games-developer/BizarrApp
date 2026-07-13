export default function NovedadesView({ banners = [] }) {
  const visible = banners.filter((b) => b.visible !== false);

  if (visible.length === 0) {
    return (
      <div style={{
        background: "linear-gradient(135deg, #0D0010, #130018)",
        border: "3px dashed #FFD600",
        borderRadius: "20px",
        padding: "40px 24px",
        textAlign: "center",
      }}>
        <div style={{ fontSize: "4rem", marginBottom: 14 }}>📣</div>
        <div style={{
          fontFamily: "'Bangers', cursive", fontSize: "2rem",
          color: "#FFD600", marginBottom: 8,
        }}>
          NADA POR AHORA
        </div>
        <div style={{
          fontFamily: "'Poppins', sans-serif", fontSize: 13,
          color: "#9E9E9E", lineHeight: 1.5,
        }}>
          El staff cargará las novedades de la noche
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="sec-hdr" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
        <h3 style={{
          fontFamily: "'Bangers', cursive",
          fontSize: "2.8rem",
          color: "#FFD600",
          textShadow: "0 0 16px #FFD600, 0 0 32px rgba(255,214,0,0.3)",
        }}>
          HOY EN BIZARREN 🎉
        </h3>
        <p style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: "1rem",
          fontWeight: 600,
          color: "#FF2D78",
          margin: 0,
        }}>
          Enterate de todo lo que se viene
        </p>
      </div>

      {visible.map((b, i) => (
        <div
          key={b.id || i}
          className="fade-up"
          style={{
            padding:      "16px",
            marginBottom: 10,
            borderRadius: 16,
            background:   "linear-gradient(135deg, #0D0010 0%, #130018 100%)",
            border:       "2px solid #9B2FFF",
            boxShadow:    "0 0 16px rgba(155,47,255,0.3)",
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
