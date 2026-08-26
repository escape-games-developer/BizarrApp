import { useEffect, useRef, useState } from "react";
import { updateEvent } from "../../services/pantallaDj";

export default function EventNameEditor({ event, compact = false, onError, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(event.name || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const inputRef = useRef(null);
  const savedTimerRef = useRef(null);

  useEffect(() => {
    if (!editing) setValue(event.name || "");
  }, [editing, event.name]);

  useEffect(() => () => clearTimeout(savedTimerRef.current), []);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const cancel = () => {
    setValue(event.name || "");
    setEditing(false);
  };

  const save = async () => {
    const name = value.trim();
    if (!name) {
      onError?.("El nombre del evento no puede estar vacío.");
      inputRef.current?.focus();
      return;
    }
    if (name === event.name) { setEditing(false); return; }
    setSaving(true);
    try {
      await updateEvent(event.id, { name });
      await onSaved?.();
      setValue(name);
      setEditing(false);
      setSaved(true);
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 1800);
    } catch (error) {
      onError?.(error.message || error);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, flexWrap: compact ? "nowrap" : "wrap" }}>
      <div className={compact ? "pdj-hdr-name" : undefined} style={{ minWidth: 0 }}>{event.name}</div>
      <button type="button" className="pdj-mini" onClick={() => setEditing(true)}
        style={{ padding: compact ? "4px 7px" : "7px 10px", flexShrink: 0 }} aria-label="Editar nombre del evento">
        ✏️{compact ? "" : " Editar"}
      </button>
      {saved && <span style={{ fontSize: 10, fontWeight: 800, color: "#00F5A0" }}>✓ Guardado</span>}
    </div>
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0, flexWrap: "wrap" }}>
      <input ref={inputRef} className="pdj-input" value={value} disabled={saving}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") { event.preventDefault(); save(); }
          if (event.key === "Escape") { event.preventDefault(); cancel(); }
        }}
        aria-label="Nombre del evento" style={{ flex: "1 1 180px", minWidth: 0 }} />
      <button type="button" className="pdj-mini pdj-mini-p" disabled={saving || !value.trim()} onClick={save}>
        {saving ? "Guardando…" : "Guardar"}
      </button>
      <button type="button" className="pdj-mini" disabled={saving} onClick={cancel}>Cancelar</button>
    </div>
  );
}
