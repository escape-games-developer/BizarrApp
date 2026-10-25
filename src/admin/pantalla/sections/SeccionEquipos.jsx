import { useCallback, useEffect, useState } from "react";
import { saveEventFields } from "../../../services/pantallaDj";
import { fetchTeamScores, resetTeamScores, CLAVES_PREMIO } from "../../../services/pantallaConfig";
import { P } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";
import {
  BotonGuardar, Campo, CampoNumero, CampoSelect, CampoSwitch, useBorrador, useGuardado,
} from "../panelControls";

/**
 * Equipos: la competencia paralela a la votación.
 *
 * Los equipos son los de la app: Team Batata y Team Membrillo (el equipo del
 * perfil de cada cliente, el mismo del Desafío Demente). Cada voto, súper
 * voto, súper odio, reacción y GIF a pantalla suma a su equipo lo que vale acá
 * (el motor vive en la base: migración 20261025010000). El panel guarda la
 * configuración del evento, muestra el marcador y lo puede poner en cero.
 */

const ACCIONES = [
  { campo: "team_points_vote",           label: "Voto normal" },
  { campo: "team_points_reaction",       label: "Reacción" },
  { campo: "team_points_super_vote",     label: "Súper voto" },
  { campo: "team_points_super_hate",     label: "Súper odio" },
  { campo: "team_points_gif_screen",     label: "GIF a pantalla" },
  { campo: "team_points_screen_message", label: "Mensaje en pantalla" },
];

const CAMPOS_EVENTO = [
  "teams_enabled", "team_round_mode", "team_round_hours", "team_round_songs",
  "team_round_prize_key", "team_round_tv_text", "team_round_banner_seconds",
  ...ACCIONES.map((a) => a.campo),
];

const PREMIOS = [
  { value: "", label: "Sin premio" },
  ...CLAVES_PREMIO.map((k) => ({ value: k, label: k.replace(/_/g, " ") })),
];

export default function SeccionEquipos({ event, refresh, onError }) {
  const [equipos, setEquipos] = useState([]);
  const [ocupado, setOcupado] = useState(false);

  const [b, set] = useBorrador(
    Object.fromEntries(CAMPOS_EVENTO.map((c) => [c, event[c] ?? ""])),
    [event.id, ...CAMPOS_EVENTO.map((c) => event[c])],
  );

  const cargar = useCallback(async () => {
    try { setEquipos(await fetchTeamScores(event.id)); }
    catch (err) { onError?.(err); }
  }, [event.id, onError]);

  useEffect(() => { cargar(); }, [cargar]);

  const { estado, mensaje, guardar } = useGuardado(async () => {
    await saveEventFields(event.id, {
      teams_enabled:             !!b.teams_enabled,
      team_round_mode:           b.team_round_mode,
      team_round_hours:          Number(b.team_round_hours) || 1,
      team_round_songs:          Number(b.team_round_songs) || 1,
      team_round_prize_key:      b.team_round_prize_key || null,
      team_round_tv_text:        String(b.team_round_tv_text || "").trim() || null,
      team_round_banner_seconds: Number(b.team_round_banner_seconds) || 10,
      ...Object.fromEntries(ACCIONES.map((a) => [a.campo, Number(b[a.campo]) || 0])),
    });
    await refresh();
  });

  const cambiado = CAMPOS_EVENTO.some((c) => String(b[c] ?? "") !== String(event[c] ?? ""));

  const correr = async (fn) => {
    setOcupado(true); onError?.(null);
    try { await fn(); await cargar(); }
    catch (err) { onError?.(err); }
    finally { setOcupado(false); }
  };

  const off = !b.teams_enabled;

  return (
    <PanelSection id="equipos" title="Equipos" icon="🏆"
      status="pendiente"
      aviso={"Los puntos ya se suman solos. Las rondas (duración, premio y cartel) todavía "
        + "no tienen motor: el marcador corre de corrido hasta que lo pongas en cero."}>
      <CampoSwitch label="Equipos habilitados" checked={!!b.teams_enabled}
        onChange={(v) => set("teams_enabled", v)} />

      {/* ── Marcador ─────────────────────────────────────────────────── */}
      <div style={{ marginTop: 12, opacity: off ? .55 : 1 }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: P.tenue, marginBottom: 6 }}>
          MARCADOR
        </div>
        {equipos.map((t) => (
          <div key={t.id} style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 5,
            padding: "7px 10px", borderRadius: 10,
            background: "rgba(240,232,255,.035)", border: "1px solid rgba(240,232,255,.08)",
          }}>
            <span style={{ fontSize: 16 }}>{t.icon}</span>
            <span style={{ flex: 1, fontSize: 11.5, fontWeight: 700, color: t.color }}>{t.name}</span>
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 700, fontSize: 13, color: P.amarillo }}
              title="Puntos acumulados — los suma el motor">{t.points}</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7 }}>
          <button type="button" className="pdj-mini" disabled={ocupado}
            onClick={() => {
              if (window.confirm("¿Poner el marcador de los dos equipos en cero?")) correr(() => resetTeamScores(event.id));
            }}>Poner en cero</button>
          <button type="button" className="pdj-mini" disabled={ocupado} onClick={cargar}>↻ Actualizar</button>
        </div>
        <div className="pdj-campo-hint">
          Cada cliente suma para el equipo que eligió en su perfil. Sin equipo elegido, no suma.
        </div>
      </div>

      {/* ── Valores de interacción ──────────────────────────────────── */}
      <div style={{ marginTop: 14, opacity: off ? .55 : 1 }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: P.tenue, marginBottom: 6 }}>
          PUNTOS POR ACCIÓN
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
          {ACCIONES.map((a) => (
            <div key={a.campo}>
              <label htmlFor={a.campo} style={{
                fontSize: 9, fontWeight: 700, letterSpacing: .4, textTransform: "uppercase",
                color: P.tenue2, display: "block", marginBottom: 3,
              }}>{a.label}</label>
              <input id={a.campo} className="pdj-input" type="number" min={0} max={999}
                value={b[a.campo] ?? 0} disabled={off}
                onChange={(e) => set(a.campo, Number(e.target.value) || 0)}
                style={{ padding: "6px 8px", fontSize: 11 }} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Rondas ─────────────────────────────────────────────────── */}
      <div style={{ marginTop: 14, opacity: off ? .55 : 1 }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: P.tenue, marginBottom: 6 }}>
          RONDAS
        </div>

        <CampoSelect label="La ronda se mide por" value={b.team_round_mode} disabled={off}
          options={[
            { value: "hours", label: "⏱ Horas" },
            { value: "songs", label: "🎵 Canciones" },
          ]}
          onChange={(v) => set("team_round_mode", v)} />

        {b.team_round_mode === "hours" ? (
          <Campo label="Duración de la ronda (horas)"
            hint="Acepta decimales: 1.5 son una hora y media.">
            <input className="pdj-input" type="number" min={0.25} max={12} step={0.25}
              value={b.team_round_hours} disabled={off}
              onChange={(e) => set("team_round_hours", e.target.value)} />
          </Campo>
        ) : (
          <CampoNumero label="Duración de la ronda (canciones)" min={1} max={200} disabled={off}
            value={b.team_round_songs} onChange={(v) => set("team_round_songs", v)} />
        )}

        <CampoSelect label="Premio a sortear entre el equipo ganador"
          value={b.team_round_prize_key || ""} options={PREMIOS} disabled={off}
          onChange={(v) => set("team_round_prize_key", v)}
          hint="Se sortea entre los integrantes del equipo que gana la ronda." />

        <Campo label="Cartel en la TV"
          hint="Acepta {equipo} y {ganador}, que se reemplazan al mostrarlo.">
          <input className="pdj-input" value={b.team_round_tv_text ?? ""} disabled={off}
            maxLength={160} placeholder="🏆 ¡{equipo} ganó la ronda! El premio es para {ganador}"
            onChange={(e) => set("team_round_tv_text", e.target.value)} />
        </Campo>

        <CampoNumero label="Duración del cartel (segundos)" min={3} max={60} disabled={off}
          value={b.team_round_banner_seconds}
          onChange={(v) => set("team_round_banner_seconds", v)} />
      </div>

      <BotonGuardar estado={estado} mensaje={mensaje} disabled={!cambiado} onClick={guardar} />
    </PanelSection>
  );
}
