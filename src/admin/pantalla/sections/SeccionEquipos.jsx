import { useCallback, useEffect, useState } from "react";
import { saveEventFields } from "../../../services/pantallaDj";
import {
  fetchTeams, createTeam, updateTeam, deleteTeam, MAX_EQUIPOS, CLAVES_PREMIO,
} from "../../../services/pantallaConfig";
import { P } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";
import {
  BotonGuardar, Campo, CampoNumero, CampoSelect, CampoSwitch, useBorrador, useGuardado,
} from "../panelControls";

/**
 * Equipos: la competencia paralela a la votación.
 *
 * Dos cosas distintas conviven acá y por eso hay dos guardados:
 *  - la configuración del evento (`pantalla_events`), con un botón propio;
 *  - los equipos en sí (`pantalla_teams`), que se crean y borran de a uno.
 *
 * `points` lo lleva el motor a medida que la gente interactúa: el panel define
 * cuánto vale cada acción, no toca el marcador.
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
  const [nombre,  setNombre]  = useState("");
  const [icono,   setIcono]   = useState("🐯");
  const [ocupado, setOcupado] = useState(false);

  const [b, set] = useBorrador(
    Object.fromEntries(CAMPOS_EVENTO.map((c) => [c, event[c] ?? ""])),
    [event.id, ...CAMPOS_EVENTO.map((c) => event[c])],
  );

  const cargar = useCallback(async () => {
    try { setEquipos(await fetchTeams(event.id)); }
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

  const agregar = () => {
    const n = nombre.trim();
    if (!n) return;
    correr(async () => {
      await createTeam(event.id, { name: n, icon: icono || "🐯", position: equipos.length });
      setNombre("");
    });
  };

  const off = !b.teams_enabled;

  return (
    <PanelSection id="equipos" title="Equipos" icon="🏆" badge={equipos.length || null}>
      <CampoSwitch label="Equipos habilitados" checked={!!b.teams_enabled}
        onChange={(v) => set("teams_enabled", v)} />

      {/* ── Los equipos ─────────────────────────────────────────────── */}
      <div style={{ marginTop: 12, opacity: off ? .55 : 1 }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: P.tenue, marginBottom: 6 }}>
          EQUIPOS ({equipos.length}/{MAX_EQUIPOS})
        </div>

        {equipos.map((t) => (
          <div key={t.id} style={{
            display: "flex", alignItems: "center", gap: 6, marginBottom: 5,
            padding: "6px 8px", borderRadius: 10,
            background: "rgba(240,232,255,.035)", border: "1px solid rgba(240,232,255,.08)",
          }}>
            <input className="pdj-input" defaultValue={t.icon} maxLength={4} disabled={ocupado || off}
              aria-label={`Ícono de ${t.name}`}
              onBlur={(e) => {
                const v = e.target.value.trim() || "🐯";
                if (v !== t.icon) correr(() => updateTeam(t.id, { icon: v }));
              }}
              style={{ width: 46, flexShrink: 0, textAlign: "center", fontSize: 15, padding: "5px 4px" }} />
            <input className="pdj-input" defaultValue={t.name} disabled={ocupado || off}
              aria-label={`Nombre de ${t.name}`}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== t.name) correr(() => updateTeam(t.id, { name: v }));
              }}
              style={{ flex: 1, minWidth: 0, padding: "5px 8px", fontSize: 11.5 }} />
            <span style={{
              fontFamily: "'Syne',sans-serif", fontWeight: 900, fontSize: 12,
              color: P.amarillo, flexShrink: 0, minWidth: 30, textAlign: "right",
            }} title="Puntos acumulados — los lleva el motor">{t.points ?? 0}</span>
            <button type="button" className="pdj-ico pdj-ico-peligro" disabled={ocupado || off}
              title={`Eliminar ${t.name}`} aria-label={`Eliminar ${t.name}`}
              onClick={() => {
                if (window.confirm(`¿Eliminar el equipo "${t.name}"?\n\nSe pierde su puntaje.`)) {
                  correr(() => deleteTeam(t.id));
                }
              }}>✕</button>
          </div>
        ))}

        {equipos.length < MAX_EQUIPOS && (
          <div style={{ display: "flex", gap: 5, marginTop: 7 }}>
            <input className="pdj-input" value={icono} maxLength={4} disabled={ocupado || off}
              aria-label="Ícono del equipo nuevo"
              onChange={(e) => setIcono(e.target.value)}
              style={{ width: 46, flexShrink: 0, textAlign: "center", fontSize: 15, padding: "6px 4px" }} />
            <input className="pdj-input" value={nombre} placeholder="Nombre del equipo"
              disabled={ocupado || off} aria-label="Nombre del equipo nuevo"
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregar(); } }}
              style={{ flex: 1, minWidth: 0, padding: "6px 8px", fontSize: 11.5 }} />
            <button type="button" className="pdj-mini pdj-mini-p" disabled={ocupado || off || !nombre.trim()}
              onClick={agregar}>+ Agregar</button>
          </div>
        )}
        {equipos.length >= MAX_EQUIPOS && (
          <div className="pdj-campo-hint">Llegaste al máximo de {MAX_EQUIPOS} equipos.</div>
        )}
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
