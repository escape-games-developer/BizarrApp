/**
 * Controles chicos del panel de propiedades del editor de pantallas. Usan las
 * clases del Admin (`.inp`, `.ctitle`).
 */

export const nota = { fontSize: 10.5, color: "rgba(240,232,255,.45)", lineHeight: 1.5 };
const etiqueta = { fontSize: 10.5, fontWeight: 700, color: "rgba(240,232,255,.6)", minWidth: 74 };

export function Seccion({ titulo, children, accion }) {
  return (
    <div style={{ padding: "12px 0", borderTop: "1px solid rgba(240,232,255,.07)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div className="ctitle" style={{ margin: 0 }}>{titulo}</div>
        {accion}
      </div>
      <div style={{ display: "grid", gap: 8 }}>{children}</div>
    </div>
  );
}

export function Fila({ label, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {label && <span style={etiqueta}>{label}</span>}
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>{children}</div>
    </div>
  );
}

/** Número con − / + (Shift en los botones = paso × 10). */
export function Num({ value, onChange, step = 1, min = -99999, max = 99999, ancho = 70, sufijo }) {
  const fijar = (v) => onChange(Math.min(max, Math.max(min, Math.round(Number(v) * 100) / 100)));
  const btn = { width: 24, height: 28, borderRadius: 7, border: "1px solid rgba(240,232,255,.14)", background: "rgba(240,232,255,.04)",
    color: "#F0E8FF", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
      <button type="button" style={btn} onClick={(e) => fijar(value - step * (e.shiftKey ? 10 : 1))} aria-label="Menos">−</button>
      <input className="inp" type="number" value={value} step={step} min={min} max={max}
        onChange={(e) => e.target.value !== "" && fijar(e.target.value)}
        style={{ width: ancho, margin: 0, padding: "5px 6px", textAlign: "center" }}/>
      <button type="button" style={btn} onClick={(e) => fijar(value + step * (e.shiftKey ? 10 : 1))} aria-label="Más">+</button>
      {sufijo && <span style={nota}>{sufijo}</span>}
    </span>
  );
}

export function Slider({ value, onChange, min, max, step = 1, mostrar }) {
  return (
    <>
      <input type="range" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: "#9B2FFF", minWidth: 0 }}/>
      <span style={{ ...nota, minWidth: 38, textAlign: "right" }}>{mostrar ? mostrar(value) : value}</span>
    </>
  );
}

const HEX = /^#([0-9a-f]{6})$/i;
const aHex = (c) => {
  if (HEX.test(c || "")) return c;
  const m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(c || "");
  if (m) return `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`;
  const r = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(c || "");
  if (r) return `#${[r[1], r[2], r[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("")}`;
  return "#ffffff";
};

/** Selector de color + campo libre (acepta rgba, para transparencias). */
export function ColorInput({ value, onChange }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
      <input type="color" value={aHex(value)} onChange={(e) => onChange(e.target.value)}
        style={{ width: 32, height: 28, padding: 0, border: "1px solid rgba(240,232,255,.2)", borderRadius: 6, background: "none", cursor: "pointer", flexShrink: 0 }}/>
      <input className="inp" value={value || ""} onChange={(e) => onChange(e.target.value)} spellCheck={false}
        style={{ margin: 0, padding: "5px 8px", fontSize: 11, flex: 1, minWidth: 0 }}/>
    </span>
  );
}

/** Botón de opción (pastilla) para elecciones cortas. */
export function Opcion({ on, onClick, children, title, ancho }) {
  return (
    <button type="button" onClick={onClick} title={title} aria-pressed={on}
      style={{ padding: "5px 10px", minWidth: ancho, borderRadius: 8, fontFamily: "inherit", fontSize: 11.5, fontWeight: 700, cursor: "pointer",
        background: on ? "rgba(155,47,255,.28)" : "rgba(240,232,255,.04)",
        border: `1px solid ${on ? "#9B2FFF" : "rgba(240,232,255,.14)"}`, color: on ? "#F0E8FF" : "rgba(240,232,255,.6)" }}>
      {children}
    </button>
  );
}

export function Interruptor({ on, onClick, children }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, fontWeight: 700, cursor: "pointer",
      color: on ? "#F0E8FF" : "rgba(240,232,255,.55)" }}>
      <input type="checkbox" checked={on} onChange={onClick} style={{ accentColor: "#9B2FFF" }}/>
      {children}
    </label>
  );
}
