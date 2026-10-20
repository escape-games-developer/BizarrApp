import { useCallback, useEffect, useMemo, useState } from "react";
import { saveEventFields } from "../../../services/pantallaDj";
import { fetchContacts, contactosACsv, descargarTexto } from "../../../services/pantallaConfig";
import { P } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";
import { BotonGuardar, useBorrador, useGuardado } from "../panelControls";

const MODOS = [
  { value: "none", label: "No pedir" },
  { value: "optional", label: "Pedir opcional" },
  { value: "required", label: "Pedir obligatorio" },
];

function SelectorModo({ label, value, onChange }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div className="pdj-campo-lbl" style={{ marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
        {MODOS.map((m) => {
          const activo = value === m.value;
          return (
            <button key={m.value} type="button" onClick={() => onChange(m.value)} style={{
              padding: "7px 11px", borderRadius: 999, cursor: "pointer",
              background: activo ? "rgba(255,122,0,.13)" : "rgba(0,0,0,.18)",
              color: P.texto, fontSize: 10.5, fontWeight: 700,
              border: `1px solid ${activo ? "#ff7a00" : "rgba(240,232,255,.15)"}`,
            }}>{m.label}</button>
          );
        })}
      </div>
    </div>
  );
}

export default function SeccionIngreso({ event, refresh, onError }) {
  const [b, set] = useBorrador(
    {
      require_email_mode: event.require_email_mode || "none",
      require_phone_mode: event.require_phone_mode || "none",
      nickname_suffixes: [...(event.nickname_suffixes || [])],
    },
    [event.id, event.require_email_mode, event.require_phone_mode, JSON.stringify(event.nickname_suffixes)],
  );
  const [nuevo, setNuevo] = useState("");
  const [contactos, setContactos] = useState([]);
  const [cargando, setCargando] = useState(false);

  const cargarContactos = useCallback(async () => {
    setCargando(true);
    try { setContactos(await fetchContacts(event.id)); }
    catch (err) { onError?.(err); }
    finally { setCargando(false); }
  }, [event.id, onError]);

  useEffect(() => { cargarContactos(); }, [cargarContactos]);

  const agregarSufijo = () => {
    const v = nuevo.trim();
    if (!v || b.nickname_suffixes.includes(v)) return;
    set("nickname_suffixes", [...b.nickname_suffixes, v]);
    setNuevo("");
  };

  const quitarSufijo = (i) =>
    set("nickname_suffixes", b.nickname_suffixes.filter((_, idx) => idx !== i));

  const cambiado = useMemo(() =>
    b.require_email_mode !== (event.require_email_mode || "none")
    || b.require_phone_mode !== (event.require_phone_mode || "none")
    || JSON.stringify(b.nickname_suffixes) !== JSON.stringify(event.nickname_suffixes || []),
  [b, event]);

  const { estado, mensaje, guardar } = useGuardado(async () => {
    await saveEventFields(event.id, {
      require_email_mode: b.require_email_mode,
      require_phone_mode: b.require_phone_mode,
      nickname_suffixes: b.nickname_suffixes,
    });
    await refresh();
  });

  return (
    <PanelSection id="ingreso-invitados" title="Ingreso de invitados"
      status="pendiente"
      aviso="BizarrApp ya tiene identidad propia. La configuración se conserva para alcanzar la experiencia DJ Democracy sin crear un segundo login.">
      <div style={{
        padding: 12, borderRadius: 14, marginBottom: 12,
        background: "rgba(240,232,255,.025)", border: "1px solid rgba(240,232,255,.09)",
      }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: P.texto }}>Sufijos para apodos repetidos</div>
        <div className="pdj-campo-hint" style={{ marginTop: 2, marginBottom: 9 }}>
          Si alguien intenta unirse con un apodo ya usado, se le sugieren variantes como â€œMarcelo Genioâ€.
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          {b.nickname_suffixes.map((s, i) => (
            <div key={`${s}-${i}`} style={{ display: "flex", gap: 6 }}>
              <input className="pdj-input" value={s} aria-label={`Sufijo ${i + 1}`}
                onChange={(e) => {
                  const copia = [...b.nickname_suffixes];
                  copia[i] = e.target.value;
                  set("nickname_suffixes", copia);
                }} />
              <button type="button" className="pdj-ico pdj-ico-peligro"
                title="Eliminar sufijo" onClick={() => quitarSufijo(i)}>🗑</button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 6 }}>
            <input className="pdj-input" value={nuevo} placeholder="Nuevo sufijo (ej. Capo)"
              onChange={(e) => setNuevo(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarSufijo(); } }} />
            <button type="button" className="pdj-mini pdj-mini-p" disabled={!nuevo.trim()}
              onClick={agregarSufijo}>+ Agregar</button>
          </div>
        </div>
      </div>

      <div style={{
        padding: 12, borderRadius: 14, marginBottom: 12,
        background: "rgba(240,232,255,.025)", border: "1px solid rgba(240,232,255,.09)",
      }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: P.texto }}>Datos de contacto del invitado</div>
        <div className="pdj-campo-hint" style={{ marginTop: 2 }}>
          Se piden en la pantalla de unirse. Útiles para contactar a ganadores de premios.
        </div>
        <SelectorModo label="Email" value={b.require_email_mode}
          onChange={(v) => set("require_email_mode", v)} />
        <SelectorModo label="Teléfono" value={b.require_phone_mode}
          onChange={(v) => set("require_phone_mode", v)} />
      </div>

      <div style={{
        padding: 12, borderRadius: 14,
        background: "rgba(240,232,255,.025)", border: "1px solid rgba(240,232,255,.09)",
      }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: P.texto }}>Base de contactos</div>
        <div className="pdj-campo-hint" style={{ marginTop: 2, marginBottom: 10 }}>
          Copia permanente de los datos de contacto: se conserva aunque borres invitados o corra la limpieza automática. {contactos.length} contacto(s) registrados.
        </div>
        <button type="button" className="pdj-mini" disabled={cargando || contactos.length === 0}
          onClick={() => descargarTexto(`contactos-${event.code}.csv`, contactosACsv(contactos), "text/csv;charset=utf-8")}>
          â‡© Exportar contactos (CSV)
        </button>
      </div>

      <BotonGuardar estado={estado} mensaje={mensaje} disabled={!cambiado} onClick={guardar} />
    </PanelSection>
  );
}
