/** Interruptor compacto del Admin (clases `.tgl-*` de los estilos del panel). */
export default function Toggle({ on, onToggle, label, color, disabled = false, etiqueta }) {
  return (
    <div className="tgl">
      <button type="button" role="switch" aria-checked={!!on} aria-label={etiqueta || label || undefined}
        className={`tgl-track ${on ? "tgl-on" : "tgl-off"}`} disabled={disabled}
        style={{ ...(on ? { background: `linear-gradient(135deg,${color || "#00E5FF"},${color || "#00F5A0"})` } : {}),
          ...(disabled ? { opacity: .5, cursor: "default" } : {}) }}
        onClick={onToggle}>
        <div className="tgl-thumb"/>
      </button>
      <span className="tgl-lbl" style={{ color: on ? "#F0E8FF" : "rgba(240,232,255,.38)" }}>{label}</span>
    </div>
  );
}
