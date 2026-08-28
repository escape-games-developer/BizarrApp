import { useCallback, useEffect, useRef, useState } from "react";
import { P, mensajeAmigable } from "../../components/pantalla/pantallaUi";

/**
 * Controles compartidos por las secciones del panel.
 *
 * Cada sección guarda lo suyo con su propio botón, como en DJ Democracy: no
 * hay ningún «Guardar todo». El feedback lo da `useGuardado` + `<BotonGuardar>`,
 * que distinguen tres finales: guardado, error del servidor y — el que importa —
 * «Supabase no devolvió error pero tampoco filas», que es RLS y se muestra como
 * error, nunca como éxito.
 */

// ── Guardado por sección ─────────────────────────────────────────────────────

export function useGuardado(guardarFn) {
  const [estado,  setEstado]  = useState("idle"); // idle | guardando | ok | error
  const [mensaje, setMensaje] = useState(null);
  const timer  = useRef(null);
  const activo = useRef(true);

  useEffect(() => {
    activo.current = true;
    return () => { activo.current = false; clearTimeout(timer.current); };
  }, []);

  const guardar = useCallback(async (...args) => {
    clearTimeout(timer.current);
    setEstado("guardando"); setMensaje(null);
    try {
      await guardarFn(...args);
      if (!activo.current) return true;
      setEstado("ok"); setMensaje("Guardado");
      timer.current = setTimeout(() => { if (activo.current) setEstado("idle"); }, 2600);
      return true;
    } catch (err) {
      if (!activo.current) return false;
      setEstado("error"); setMensaje(mensajeAmigable(err));
      return false;
    }
  }, [guardarFn]);

  return { estado, mensaje, guardar, limpiar: () => { setEstado("idle"); setMensaje(null); } };
}

export function BotonGuardar({ estado, mensaje, disabled, onClick, texto = "Guardar" }) {
  const color = estado === "error" ? "#FCA5A5" : P.verde;
  return (
    <div className="pdj-guardar">
      <button type="button" className="pdj-mini pdj-mini-p"
        disabled={disabled || estado === "guardando"} onClick={onClick}
        style={{ padding: "9px 18px" }}>
        {estado === "guardando" ? "Guardando…" : texto}
      </button>
      {mensaje && estado !== "guardando" && (
        <span className="pdj-guardar-msg" style={{ color }}>
          {estado === "error" ? "⚠ " : "✓ "}{mensaje}
        </span>
      )}
    </div>
  );
}

// ── Campos ───────────────────────────────────────────────────────────────────

export function Campo({ label, hint, children }) {
  return (
    <div className="pdj-campo">
      {label && <span className="pdj-campo-lbl">{label}</span>}
      {children}
      {hint && <div className="pdj-campo-hint">{hint}</div>}
    </div>
  );
}

/** Entero acotado. No dispara nada solo: el valor sube con el botón Guardar. */
export function CampoNumero({ label, value, min, max, hint, disabled, onChange }) {
  return (
    <Campo label={label} hint={hint}>
      <input className="pdj-input pdj-num" type="number" min={min} max={max}
        value={value ?? ""} disabled={disabled}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        onBlur={(e) => {
          if (e.target.value === "") { onChange(min); return; }
          onChange(Math.min(max, Math.max(min, Number(e.target.value) || min)));
        }} />
    </Campo>
  );
}

export function CampoTexto({ label, value, hint, disabled, placeholder, maxLength, onChange }) {
  return (
    <Campo label={label} hint={hint}>
      <input className="pdj-input" value={value ?? ""} disabled={disabled}
        placeholder={placeholder} maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)} />
    </Campo>
  );
}

export function CampoSelect({ label, value, hint, disabled, options, onChange }) {
  return (
    <Campo label={label} hint={hint}>
      <select className="pdj-input" value={value ?? ""} disabled={disabled}
        onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Campo>
  );
}

export function CampoSwitch({ label, checked, disabled, onChange }) {
  return (
    <label className="pdj-switch" style={disabled ? { opacity: .55 } : undefined}>
      <span className="pdj-switch-txt">{label}</span>
      <input type="checkbox" checked={!!checked} disabled={disabled}
        onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

/** Copia al portapapeles y avisa en el propio botón. */
export function BotonCopiar({ valor, texto = "⧉ Copiar", disabled, className = "pdj-mini" }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className={className} disabled={disabled || !valor}
      onClick={() => {
        navigator.clipboard?.writeText(valor);
        setOk(true); setTimeout(() => setOk(false), 1600);
      }}>
      {ok ? "✓ Copiado" : texto}
    </button>
  );
}

/**
 * Espeja una prop del servidor en estado local editable.
 * Cuando el evento cambia (o llega un UPDATE por Realtime), el borrador se
 * rehace: la fuente de verdad sigue siendo la base, no el formulario.
 */
export function useBorrador(fuente, deps) {
  const [borrador, setBorrador] = useState(fuente);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setBorrador(fuente); }, deps);
  const set = useCallback((campo, valor) => setBorrador((b) => ({ ...b, [campo]: valor })), []);
  return [borrador, set, setBorrador];
}
