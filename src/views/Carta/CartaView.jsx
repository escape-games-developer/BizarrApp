import { useState, useMemo } from "react";
import { MENU } from "../../constants/data";

export default function CartaView() {
  const [cat, setCat] = useState(MENU[0].id);

  const items = useMemo(
    () => MENU.find((c) => c.id === cat)?.items || [],
    [cat]
  );

  return (
    <div>
      {/* Tabs de categoría */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 14, paddingBottom: 2 }}>
        {MENU.map((c) => (
          <button
            key={c.id}
            onClick={() => setCat(c.id)}
            style={{
              flexShrink: 0,
              padding: "6px 16px",
              borderRadius: 20,
              fontFamily: "Syne, sans-serif",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all .18s",
              background:  cat === c.id ? "#FF2D78" : "#1A001A",
              border:      "2px solid #FF2D78",
              color:       cat === c.id ? "#000" : "#FF2D78",
              boxShadow:   cat === c.id ? "0 0 10px #FF2D78" : "none",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {/* Items */}
      <div>
        {items.map((item, i) => (
          <div
            key={i}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#FFD600"; }}
            onMouseLeave={(e) => { e.currentTarget.style.border = "2px solid #2A0040"; e.currentTarget.style.borderLeft = "4px solid #FFD600"; }}
            style={{
              display:       "flex",
              alignItems:    "center",
              gap: 10,
              background:    "#0D0010",
              border:        "2px solid #2A0040",
              borderLeft:    "4px solid #FFD600",
              borderRadius:  12,
              padding:       "12px 16px",
              marginBottom:  8,
              transition:    "border-color .18s",
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "#FFFFFF", marginBottom: 3 }}>
                {item.name}
              </div>
              <div style={{ fontSize: "0.85rem", color: "#9E9E9E", lineHeight: 1.4 }}>
                {item.desc}
              </div>
            </div>
            <div style={{
              fontFamily: "'Bangers', cursive",
              fontSize: "1.1rem",
              fontWeight: 700,
              color: "#FFD600",
              flexShrink: 0,
            }}>
              ${item.price.toLocaleString("es-AR")}
            </div>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 10, color: "rgba(245,230,192,.25)", textAlign: "center", marginTop: 4 }}>
        Precios en pesos argentinos · Pueden cambiar · Consultá al staff
      </p>
    </div>
  );
}
