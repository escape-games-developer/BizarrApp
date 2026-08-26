import { useCallback, useEffect, useState } from "react";
import { fetchVotePowers, setVotePower, resetPowers, updateEvent } from "../../services/pantallaDj";
import { P } from "../../components/pantalla/pantallaUi";

/**
 * Reglas del evento, en cards temáticas en vez de un formulario vertical.
 *
 * Los valores son los reales de `pantalla_events` y `pantalla_vote_powers`:
 * no hay defaults inventados en la UI. Si un tipo de voto está apagado para un
 * rol, el servidor rechaza el intento — el botón oculto en el cliente es sólo
 * cortesía, no la defensa.
 */

const ROLES = [
  { id: "guest",    label: "Invitado"    },
  { id: "vip",      label: "VIP"         },
  { id: "birthday", label: "Cumpleañero" },
  { id: "staff",    label: "Staff"       },
];

const TIPOS = [
  { id: "up",         label: "👍 Positivo" },
  { id: "down",       label: "👎 Negativo" },
  { id: "super_up",   label: "🔥 Super"    },
  { id: "super_down", label: "💀 Super odio" },
];

function Numero({ label, value, min, max, hint, onSave }) {
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);
  return (
    <div className="pdj-campo">
      <span className="pdj-campo-lbl">{label}</span>
      <input className="pdj-input pdj-num" type="number" min={min} max={max} value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          const n = Math.min(max, Math.max(min, Number(v) || min));
          setV(n);
          if (n !== value) onSave(n);
        }} />
      {hint && <div className="pdj-campo-hint">{hint}</div>}
    </div>
  );
}

function Switch({ label, checked, onChange, disabled }) {
  return (
    <label className="pdj-switch">
      <span className="pdj-switch-txt">{label}</span>
      <input type="checkbox" checked={checked} disabled={disabled}
        onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export default function ReglasTab({ event, refresh, onError }) {
  const [powers, setPowers] = useState([]);
  const [busy,   setBusy]   = useState(false);

  const cargarPowers = useCallback(async () => {
    try { setPowers(await fetchVotePowers(event.id)); }
    catch (err) { onError(err); }
  }, [event.id, onError]);

  useEffect(() => { cargarPowers(); }, [cargarPowers]);

  const guardar = useCallback(async (patch) => {
    setBusy(true); onError(null);
    try { await updateEvent(event.id, patch); await refresh(); }
    catch (err) { onError(err); }
    finally { setBusy(false); }
  }, [event.id, refresh, onError]);

  const power = (role, type) =>
    powers.find((p) => p.role === role && p.vote_type === type) || { enabled: false, value: 1 };

  const cambiarPower = async (role, type, patch) => {
    onError(null);
    try {
      await setVotePower(event.id, role, type, { ...power(role, type), ...patch });
      await cargarPowers();
    } catch (err) { onError(err); }
  };

  return (
    <>
      {/* ── Votación ──────────────────────────────────────────────────── */}
      <div className="pdj-card pdj-card-acento">
        <div className="pdj-card-titulo">
          <span style={{ fontSize: 15 }}>🗳</span><h4>Reglas de votación</h4>
        </div>

        <div className="pdj-campo">
          <span className="pdj-campo-lbl">Modo de votación</span>
          <select className="pdj-input" value={event.voting_mode} disabled={busy}
            onChange={(e) => guardar({ voting_mode: e.target.value })}>
            <option value="best">Best — un 👍 por persona, se mueve al votar otro tema</option>
            <option value="rank">Rank — un 👍 por cada tema</option>
          </select>
          <div className="pdj-campo-hint">
            En <strong>Best</strong> cada persona sostiene una sola elección: votar otra canción
            le saca el voto a la anterior. En <strong>Rank</strong> puede votar todas las que quiera.
          </div>
        </div>

        <Numero label="Cantidad de candidatas visibles" min={3} max={15}
          value={event.active_candidates_count}
          hint="La ventana fija que ve el cliente. El servidor la rellena solo desde la playlist."
          onSave={(n) => guardar({ active_candidates_count: n })} />

        <Numero label="Rondas en último lugar antes de relegar" min={1} max={10}
          value={event.relegation_rounds_threshold}
          hint="El tema que queda último esta cantidad de rondas seguidas sale de la ventana y vuelve al fondo de la playlist."
          onSave={(n) => guardar({ relegation_rounds_threshold: n })} />

        <Numero label="Score de descarte" min={-50} max={0}
          value={event.reject_score_threshold}
          hint="Por debajo de este score el tema queda descartado y no vuelve a entrar en la ventana."
          onSave={(n) => guardar({ reject_score_threshold: n })} />

        <Numero label="Super votos por persona" min={0} max={10}
          value={event.super_votes_per_user}
          hint="El cupo se lleva en el servidor: no hay nada en el navegador que lo pueda sortear."
          onSave={(n) => guardar({ super_votes_per_user: n })} />

        <Switch label="Desactivar la votación por completo" checked={event.voting_disabled}
          disabled={busy} onChange={(v) => guardar({ voting_disabled: v })} />
      </div>

      {/* ── Sacar tema ────────────────────────────────────────────────── */}
      <div className="pdj-card">
        <div className="pdj-card-titulo">
          <span style={{ fontSize: 15 }}>👎</span><h4>Sacar Tema</h4>
        </div>
        <div className="pdj-sub">
          Cuando se alcanza el porcentaje requerido de participantes activos, la canción se saltea.
          El Staff no cuenta para el cálculo.
        </div>

        <Switch label="Sacar Tema habilitado" checked={event.kick_enabled}
          disabled={busy} onChange={(v) => guardar({ kick_enabled: v })} />

        <div className="pdj-campo">
          <span className="pdj-campo-lbl">Texto del botón en el cliente</span>
          <input className="pdj-input" defaultValue={event.kick_button_text} disabled={busy}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== event.kick_button_text) guardar({ kick_button_text: v });
            }} />
        </div>

        <Numero label="Porcentaje necesario (%)" min={1} max={100}
          value={event.kick_threshold_pct}
          hint="Se calcula sobre los participantes activos, sin contar al Staff."
          onSave={(n) => guardar({ kick_threshold_pct: n })} />

        <Numero label="Ventana de actividad (minutos)" min={1} max={480}
          value={event.kick_activity_minutes}
          hint="Alguien cuenta como activo si su último heartbeat entra en esta ventana."
          onSave={(n) => guardar({ kick_activity_minutes: n })} />
      </div>

      {/* ── Poderes ───────────────────────────────────────────────────── */}
      <div className="pdj-card">
        <div className="pdj-card-titulo">
          <span style={{ fontSize: 15 }}>⚡</span><h4>Poderes de voto</h4>
          <button className="pdj-mini" onClick={() => {
            if (window.confirm("¿Restaurar la matriz de poderes por defecto?")) {
              resetPowers(event.id).then(cargarPowers).catch(onError);
            }
          }}>Restaurar</button>
        </div>

        <div className="pdj-sub">
          Habilitación y peso por rol. Si un tipo está apagado, el servidor rechaza el voto.
          Staff con peso 0 vota sin mover el ranking.
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="pdj-matriz">
            <thead>
              <tr>
                <th>Rol</th>
                {TIPOS.map((t) => <th key={t.id}>{t.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {ROLES.map((r) => (
                <tr key={r.id}>
                  <td>{r.label}</td>
                  {TIPOS.map((t) => {
                    const p = power(r.id, t.id);
                    return (
                      <td key={t.id}>
                        <div className="pdj-celda">
                          <input type="checkbox" checked={p.enabled}
                            aria-label={`${r.label} · ${t.label} habilitado`}
                            onChange={(e) => cambiarPower(r.id, t.id, { enabled: e.target.checked })} />
                          <input type="number" min={0} max={99} value={p.value} disabled={!p.enabled}
                            aria-label={`${r.label} · ${t.label} peso`}
                            onChange={(e) => cambiarPower(r.id, t.id, { value: Number(e.target.value) || 0 })} />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Freeze ────────────────────────────────────────────────────── */}
      <div className="pdj-card">
        <div className="pdj-card-titulo">
          <span style={{ fontSize: 15 }}>❄️</span><h4>Congelar el orden</h4>
          <span className="pdj-chip" style={{
            background: event.voting_frozen ? "rgba(0,229,255,.12)" : "rgba(240,232,255,.06)",
            color: event.voting_frozen ? P.cyan : P.tenue2,
          }}>{event.voting_frozen ? "CONGELADO" : "LIBRE"}</span>
        </div>
        <div className="pdj-sub" style={{ marginBottom: 0 }}>
          Congelar toma una foto del ranking y la deja quieta en todas las pantallas.
          <strong> Los votos se siguen registrando por detrás</strong>: no bloquea la escritura,
          sólo el orden que se muestra. Al reanudar, el ranking salta al estado real.
          Se controla desde la <strong>Consola DJ</strong>, que es donde se usa en vivo.
        </div>
      </div>
    </>
  );
}
