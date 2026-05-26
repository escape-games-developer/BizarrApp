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
      <div className="sec-hdr">
        <span style={{ fontSize: 20 }}>🍹</span>
        <h3>Carta del Bar</h3>
      </div>

      {/* Tabs de categoría */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 14, paddingBottom: 2 }}>
        {MENU.map((c) => (
          <button
            key={c.id}
            onClick={() => setCat(c.id)}
            style={{
              flexShrink: 0,
              padding: "7px 14px",
              borderRadius: 20,
              border: "1px solid",
              fontFamily: "Syne, sans-serif",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              transition: "all .18s",
              background:   cat === c.id ? "#FFD700" : "rgba(255,215,0,.05)",
              borderColor:  cat === c.id ? "#FFD700" : "rgba(255,215,0,.15)",
              color:        cat === c.id ? "#1A0A00" : "rgba(255,215,0,.5)",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {/* Items */}
      <div className="card">
        {items.map((item, i) => (
          <div
            key={i}
            style={{
              display:       "flex",
              alignItems:    "center",
              padding:       "11px 0",
              borderBottom:  i < items.length - 1 ? "1px solid rgba(255,215,0,.07)" : "none",
              gap: 10,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#F5E6C0", marginBottom: 3 }}>
                {item.name}
              </div>
              <div style={{ fontSize: 11, color: "rgba(245,230,192,.42)", lineHeight: 1.4 }}>
                {item.desc}
              </div>
            </div>
            <div style={{
              fontFamily: "Syne, sans-serif",
              fontSize: 14,
              fontWeight: 800,
              color: "#FFD700",
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
