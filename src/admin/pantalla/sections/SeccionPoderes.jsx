import { useCallback, useEffect, useState } from "react";
import {
  fetchVotePowers, saveVotePowers, resetPowers, saveEventFields,
} from "../../../services/pantallaDj";
import { P } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";
import { BotonGuardar, CampoNumero, useGuardado } from "../panelControls";

/**
 * Poderes de voto: qué puede hacer cada rol y cuánto pesa.
 *
 * La matriz vive en `pantalla_vote_powers`, una fila por (evento, rol, tipo).
 * Si un tipo está apagado el servidor rechaza el voto; esconder el botón en el
 * cliente es cortesía, no la defensa. Staff con peso 0 vota sin mover nada.
 *
 * A diferencia de la versión anterior, acá se edita un borrador completo y se
 * sube con un solo Guardar: en una matriz de 16 celdas, un upsert por click era
 * un ida y vuelta a la base por cada tecla.
 */

const ROLES = [
  { id: "guest",    label: "Invitado",    ico: "👤", color: P.tenue },
  { id: "vip",      label: "VIP",         ico: "👑", color: P.amarillo },
  { id: "birthday", label: "Cumpleañero", ico: "🎂", color: P.fucsia },
  { id: "staff",    label: "Staff",       ico: "🛠", color: P.cyan },
];

const TIPOS = [
  { id: "up",         label: "👍 Positivo" },
  { id: "down",       label: "👎 Negativo" },
  { id: "super_up",   label: "🔥 Súper" },
  { id: "super_down", label: "💀 Súper odio" },
];

const clave = (rol, tipo) => `${rol}|${tipo}`;

/** Filas de la base → mapa plano, con default para las celdas que no existen. */
function aMapa(filas) {
  const m = {};
  for (const r of ROLES) {
    for (const t of TIPOS) {
      const fila = filas.find((f) => f.role === r.id && f.vote_type === t.id);
      m[clave(r.id, t.id)] = { enabled: !!fila?.enabled, value: fila?.value ?? 1 };
    }
  }
  return m;
}

export default function SeccionPoderes({ event, refresh, onError }) {
  const [base,   setBase]   = useState({});
  const [borr,   setBorr]   = useState({});
  const [supers, setSupers] = useState(event.super_votes_per_user);
  const [reseteando, setReseteando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const mapa = aMapa(await fetchVotePowers(event.id));
      setBase(mapa); setBorr(mapa);
    } catch (err) { onError?.(err); }
  }, [event.id, onError]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { setSupers(event.super_votes_per_user); }, [event.super_votes_per_user]);

  const celda = (rol, tipo) => borr[clave(rol, tipo)] || { enabled: false, value: 1 };
  const set = (rol, tipo, patch) =>
    setBorr((b) => ({ ...b, [clave(rol, tipo)]: { ...celda(rol, tipo), ...patch } }));

  const cambiadas = Object.keys(borr).filter((k) => {
    const a = base[k], z = borr[k];
    return !a || a.enabled !== z.enabled || a.value !== z.value;
  });
  const cambiado = cambiadas.length > 0 || supers !== event.super_votes_per_user;

  const { estado, mensaje, guardar } = useGuardado(async () => {
    if (cambiadas.length) {
      await saveVotePowers(event.id, cambiadas.map((k) => {
        const [role, vote_type] = k.split("|");
        return { role, vote_type, enabled: borr[k].enabled, value: borr[k].value };
      }));
    }
    if (supers !== event.super_votes_per_user) {
      await saveEventFields(event.id, { super_votes_per_user: supers });
      await refresh();
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
    <PanelSection id="poderes-usuario" title="Poderes de usuario" icon="⚡">
      <div className="pdj-sub">
        Habilitación y peso por rol. Si un tipo está apagado, el servidor rechaza el voto.
      </div>

      {ROLES.map((r) => (
        <div key={r.id} style={{
          borderRadius: 12, padding: "9px 10px", marginBottom: 8,
          background: "rgba(240,232,255,.035)", border: "1px solid rgba(240,232,255,.08)",
        }}>
          <div style={{
            fontSize: 11, fontWeight: 800, color: r.color, marginBottom: 7,
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <span>{r.ico}</span>{r.label}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {TIPOS.map((t) => {
              const c = celda(r.id, t.id);
              return (
                <div key={t.id} style={{
                  display: "flex", alignItems: "center", gap: 5, minWidth: 0,
                  padding: "5px 6px", borderRadius: 9,
                  background: c.enabled ? "rgba(155,47,255,.12)" : "rgba(240,232,255,.03)",
                  border: `1px solid ${c.enabled ? "rgba(155,47,255,.3)" : "rgba(240,232,255,.07)"}`,
                }}>
                  <input type="checkbox" checked={c.enabled}
                    aria-label={`${r.label} · ${t.label} habilitado`}
                    onChange={(e) => set(r.id, t.id, { enabled: e.target.checked })}
                    style={{ accentColor: "#9B2FFF", cursor: "pointer", flexShrink: 0 }} />
                  <span style={{
                    fontSize: 9.5, color: "rgba(240,232,255,.6)", flex: 1, minWidth: 0,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{t.label}</span>
                  <input type="number" min={0} max={99} value={c.value} disabled={!c.enabled}
                    aria-label={`${r.label} · ${t.label} peso`}
                    onChange={(e) => set(r.id, t.id, { value: Number(e.target.value) || 0 })}
                    style={{
                      width: 40, flexShrink: 0, padding: "3px 4px", borderRadius: 7, fontSize: 11,
                      textAlign: "center", fontFamily: "'Syne',sans-serif", fontWeight: 800,
                      background: "rgba(240,232,255,.06)", color: "#F0E8FF",
                      border: "1px solid rgba(240,232,255,.12)", outline: "none",
                      opacity: c.enabled ? 1 : .35,
                    }} />
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <CampoNumero label="Súper votos por persona" min={0} max={10} value={supers}
        onChange={setSupers}
        hint="El cupo se lleva en el servidor: no hay nada en el navegador que lo pueda sortear." />

      <BotonGuardar estado={estado} mensaje={mensaje} disabled={!cambiado} onClick={guardar} />

      <button type="button" className="pdj-mini" disabled={reseteando}
        onClick={restablecer} style={{ marginTop: 9 }}>
        {reseteando ? "Restableciendo…" : "↺ Restablecer a valores por defecto"}
      </button>
    </PanelSection>
  );
}
