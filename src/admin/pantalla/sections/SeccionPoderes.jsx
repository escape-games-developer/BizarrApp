import { useCallback, useEffect, useState } from "react";
import { fetchVotePowers, saveVotePowers, resetPowers } from "../../../services/pantallaDj";
import { P } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";
import { BotonGuardar, useGuardado } from "../panelControls";

const ROLES = [
  { id: "guest", label: "Guest", ico: "👤" },
  { id: "vip", label: "VIP", ico: "👑" },
  { id: "birthday", label: "Cumpleañero", ico: "🎂" },
  { id: "staff", label: "Staff", ico: "🛠" },
  { id: "dj", label: "DJ", ico: "🎧" },
];

const TIPOS = [
  { id: "up", label: "👍 VOTO POSITIVO" },
  { id: "down", label: "👎 VOTO NEGATIVO" },
  { id: "super_up", label: "🔥 SÚPER VOTO" },
  { id: "super_down", label: "💀 SÚPER HATE" },
];

const MIGRACION = "20260909120000_pantalla_kick_style_y_rol_dj.sql";
const ES_CHECK = (msg) => /check|23514|constraint/i.test(String(msg || ""));
const clave = (rol, tipo) => `${rol}|${tipo}`;

const DEFAULTS = {
  guest:    { up: [true, 1], down: [true, 1], super_up: [true, 5], super_down: [false, 2] },
  vip:      { up: [true, 2], down: [true, 2], super_up: [true, 5], super_down: [false, 2] },
  birthday: { up: [true, 3], down: [true, 2], super_up: [true, 5], super_down: [false, 2] },
  staff:    { up: [true, 1], down: [true, 1], super_up: [true, 5], super_down: [false, 0] },
  dj:       { up: [true, 10], down: [true, 10], super_up: [true, 20], super_down: [true, 20] },
};

function aMapa(filas) {
  const m = {};
  for (const r of ROLES) {
    for (const t of TIPOS) {
      const fila = filas.find((f) => f.role === r.id && f.vote_type === t.id);
      const [enabledDefault, valueDefault] = DEFAULTS[r.id][t.id];
      m[clave(r.id, t.id)] = {
        enabled: fila ? !!fila.enabled : enabledDefault,
        value: fila?.value ?? valueDefault,
      };
    }
  }
  return m;
}

function Celda({ role, tipo, value, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
      <label title={`${value.enabled ? "Apagar" : "Encender"} ${tipo.label}`} style={{
        width: 38, height: 22, borderRadius: 999, padding: 2, flexShrink: 0,
        cursor: "pointer", background: value.enabled ? "#ff7a00" : "rgba(240,232,255,.08)",
        display: "flex", justifyContent: value.enabled ? "flex-end" : "flex-start",
        transition: "background .15s",
      }}>
        <input type="checkbox" checked={value.enabled} aria-label={`${role.label} · ${tipo.label}`}
          onChange={(e) => onChange({ enabled: e.target.checked })} style={{ display: "none" }} />
        <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#050507", display: "block" }} />
      </label>
      <input type="number" min={0} max={99} value={value.value}
        aria-label={`${role.label} · ${tipo.label} peso`}
        onChange={(e) => onChange({ value: Number(e.target.value) || 0 })}
        style={{
          width: 56, minWidth: 0, padding: "5px 8px", borderRadius: 10,
          background: "#07070a", color: P.texto, border: "1px solid rgba(240,232,255,.14)",
          opacity: value.enabled ? 1 : .45,
        }} />
    </div>
  );
}

export default function SeccionPoderes({ event, onError }) {
  const [base, setBase] = useState({});
  const [borr, setBorr] = useState({});
  const [reseteando, setReseteando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const mapa = aMapa(await fetchVotePowers(event.id));
      setBase(mapa);
      setBorr(mapa);
    } catch (err) { onError?.(err); }
  }, [event.id, onError]);

  useEffect(() => { cargar(); }, [cargar]);

  const celda = (rol, tipo) => borr[clave(rol, tipo)] || { enabled: false, value: 1 };
  const setCelda = (rol, tipo, patch) => setBorr((actual) => ({
    ...actual,
    [clave(rol, tipo)]: { ...celda(rol, tipo), ...patch },
  }));

  const cambiadas = Object.keys(borr).filter((k) => {
    const a = base[k];
    const z = borr[k];
    return !a || a.enabled !== z.enabled || a.value !== z.value;
  });

  const aFila = (k) => {
    const [role, vote_type] = k.split("|");
    return { role, vote_type, enabled: borr[k].enabled, value: borr[k].value };
  };

  const { estado, mensaje, guardar } = useGuardado(async () => {
    const comunes = cambiadas.filter((k) => !k.startsWith("dj|"));
    const dj = cambiadas.filter((k) => k.startsWith("dj|"));
    if (comunes.length) await saveVotePowers(event.id, comunes.map(aFila));
    if (dj.length) {
      try { await saveVotePowers(event.id, dj.map(aFila)); }
      catch (err) {
        if (!ES_CHECK(err.message)) throw err;
        throw new Error(`Los otros roles se guardaron. Para guardar DJ falta aplicar ${MIGRACION}.`);
      }
    }
    await cargar();
  });

  const restablecer = async () => {
    if (!window.confirm("¿Restablecer la matriz de poderes a los valores por defecto?")) return;
    setReseteando(true);
    try { await resetPowers(event.id); await cargar(); }
    catch (err) { onError?.(err); }
    finally { setReseteando(false); }
  };

  return (
    <PanelSection id="poderes-usuario" title="Poderes de usuario">
      <div className="pdj-sub" style={{ marginBottom: 12 }}>
        Definí qué tipos de voto puede usar cada rol y cuánto pesa cada uno. Si un tipo está apagado,
        el servidor rechaza el intento y el botón no se muestra al invitado.
      </div>

      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 720 }}>
          <div style={{
            display: "grid", gridTemplateColumns: "150px repeat(4, 1fr)", gap: 10,
            alignItems: "center", padding: "0 8px 9px", borderBottom: "1px solid rgba(240,232,255,.1)",
          }}>
            <div className="pdj-campo-lbl">ROL</div>
            {TIPOS.map((t) => <div key={t.id} className="pdj-campo-lbl">{t.label}</div>)}
          </div>

          {ROLES.map((r) => (
            <div key={r.id} style={{
              display: "grid", gridTemplateColumns: "150px repeat(4, 1fr)", gap: 10,
              alignItems: "center", padding: "10px 8px", borderBottom: "1px solid rgba(240,232,255,.08)",
            }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: P.texto }}>{r.ico} {r.label}</div>
              {TIPOS.map((t) => (
                <Celda key={t.id} role={r} tipo={t} value={celda(r.id, t.id)}
                  onChange={(patch) => setCelda(r.id, t.id, patch)} />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="pdj-campo-hint" style={{ marginTop: 10 }}>
        Los valores negativos se calculan automáticamente: el peso se resta en votos “en contra” y Súper Hate.
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <BotonGuardar estado={estado} mensaje={mensaje} disabled={cambiadas.length === 0} onClick={guardar} />
        <button type="button" className="pdj-mini" disabled={reseteando} onClick={restablecer}>
          {reseteando ? "Restableciendo…" : "↺ Restablecer a valores por defecto"}
        </button>
      </div>
    </PanelSection>
  );
}
