import { designerTheme as T } from "../theme";

export const panelCard = { background: T.popover, border: `1px solid ${T.border}`, borderRadius: 12, padding: 12 };
export const labelStyle = { display: "block", color: T.mutedForeground, fontSize: 10, fontWeight: 700, letterSpacing: ".06em", marginBottom: 6, textTransform: "uppercase" };
export const inputStyle = { width: "100%", minWidth: 0, background: T.input, border: `1px solid ${T.border}`, borderRadius: 8, color: T.foreground, fontSize: 12, outline: "none", padding: "8px 9px" };

export function Chips({ value, options, onChange }) {
  return <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
    {options.map(option => {
      const item = typeof option === "string" ? { value: option, label: option } : option;
      const selected = value === item.value;
      return <button key={item.value} type="button" onClick={() => onChange(item.value)} style={{
        background: selected ? "rgba(249,115,22,.15)" : "transparent",
        border: `1px solid ${selected ? T.primary : T.border}`,
        borderRadius: 999, color: selected ? T.primaryGlow : T.mutedForeground,
        cursor: "pointer", fontSize: 10, padding: "5px 9px",
      }}>{item.label}</button>;
    })}
  </div>;
}

export function Field({ label, children }) {
  return <label style={{ display: "block", minWidth: 0 }}><span style={labelStyle}>{label}</span>{children}</label>;
}

export function NumberField({ label, value, onChange, step = 0.5, min, max }) {
  return <Field label={label}><input style={inputStyle} type="number" value={value ?? ""} step={step} min={min} max={max} onChange={event => onChange(event.target.value === "" ? null : Number(event.target.value))}/></Field>;
}

export function ColorField({ label, value, onChange }) {
  const safe = value || "#ffffff";
  return <Field label={label}><div style={{ display: "flex", gap: 6 }}>
    <input aria-label={label} type="color" value={safe} onChange={event => onChange(event.target.value)} style={{ width: 38, height: 34, padding: 2, background: T.input, border: `1px solid ${T.border}`, borderRadius: 8 }}/>
    <input style={inputStyle} value={value || ""} placeholder="#ffffff" onChange={event => onChange(event.target.value)}/>
  </div></Field>;
}

export function SectionCard({ title, children }) {
  return <section style={panelCard}><div style={{ ...labelStyle, color: T.foreground, marginBottom: 10 }}>{title}</div>{children}</section>;
}

