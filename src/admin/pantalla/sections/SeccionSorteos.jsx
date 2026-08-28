import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import {
  fetchPrizes, fetchGrantedRewards, grantReward, markRewardDelivered, CLAVES_PREMIO,
} from "../../../services/pantallaConfig";
import { P } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";
import { Campo } from "../panelControls";

/**
 * Sorteos y reconocimientos manuales, desde la cabina.
 *
 * Escribe en `pantalla_granted_rewards`: `source='raffle'` cuando el DJ sortea
 * entre los presentes y `source='manual'` cuando reconoce a alguien puntual.
 * Los otros tres valores del CHECK los pone el motor, no esta pantalla.
 *
 * El sorteo se hace acá, sobre los participantes que el panel ya tiene en
 * memoria, y se guarda **una sola fila**: la elección del ganador queda
 * registrada, no se recalcula. Volver a sortear otorga otro premio, no reemplaza
 * el anterior.
 *
 * El catálogo se filtra por los premios habilitados en `pantalla_prizes`. Si
 * todavía no se configuró ninguno se ofrecen los ocho, para que el DJ no quede
 * trabado por una sección que quizá nadie tocó.
 */

const PREMIOS = {
  extra_super_vote:     { ico: "🔥", label: "Súper voto extra" },
  giant_reaction:       { ico: "💥", label: "Reacción gigante" },
  highlighted_nickname: { ico: "✨", label: "Apodo destacado" },
  physical_prize:       { ico: "🎁", label: "Premio real del local" },
  vip_upgrade:          { ico: "👑", label: "Pase a VIP" },
  gif_screen:           { ico: "🎞", label: "GIF a pantalla" },
  screen_message:       { ico: "💬", label: "Mensaje en pantalla" },
  vip_badge:            { ico: "🏅", label: "Insignia VIP" },
};

const FUENTES = {
  manual:      { ico: "🏅", label: "Reconocimiento" },
  raffle:      { ico: "🎲", label: "Sorteo" },
  achievement: { ico: "⭐", label: "Logro" },
  vip_gift:    { ico: "🎁", label: "Regalo VIP" },
  team_round:  { ico: "🏆", label: "Ronda de equipo" },
};

export default function SeccionSorteos({ event, participants, onError }) {
  const [perfiles,  setPerfiles]  = useState({});
  const [habilitados, setHabilitados] = useState(null); // null = todavía sin leer
  const [otorgados, setOtorgados] = useState([]);
  const [destino,   setDestino]   = useState("");       // "" = sorteo
  const [premio,    setPremio]    = useState("");
  const [sinStaff,  setSinStaff]  = useState(true);
  const [ocupado,   setOcupado]   = useState(false);
  const [aviso,     setAviso]     = useState(null);

  // Nombres: igual que en la sección de invitados, salen de `profiles`.
  useEffect(() => {
    const ids = participants.map((p) => p.user_id);
    if (!ids.length) { setPerfiles({}); return; }
    let cancelado = false;
    supabase.from("profiles").select("id,name").in("id", ids)
      .then(({ data, error }) => {
        if (cancelado || error) return;
        setPerfiles(Object.fromEntries((data || []).map((p) => [p.id, p.name])));
      });
    return () => { cancelado = true; };
  }, [participants]);

  const cargar = useCallback(async () => {
    try {
      const [pr, gr] = await Promise.all([
        fetchPrizes(event.id), fetchGrantedRewards(event.id),
      ]);
      const on = pr.filter((x) => x.enabled).map((x) => x.prize_key);
      setHabilitados(pr.length === 0 ? CLAVES_PREMIO : on);
      setOtorgados(gr);
    } catch (err) { onError?.(err); }
  }, [event.id, onError]);

  useEffect(() => { cargar(); }, [cargar]);

  const corte = Date.now() - (event.kick_activity_minutes ?? 45) * 60_000;

  const elegibles = useMemo(() => participants
    .filter((p) => new Date(p.last_seen_at).getTime() > corte)
    .filter((p) => !sinStaff || p.role !== "staff"),
  [participants, corte, sinStaff]);

  const catalogo = habilitados ?? [];
  const nombre = (uid) => perfiles[uid] || "Sin nombre";

  const flash = (msg) => { setAviso(msg); setTimeout(() => setAviso(null), 4000); };

  const otorgar = async () => {
    if (!premio) return;
    let userId = destino;
    let source = "manual";

    if (!destino) {
      if (!elegibles.length) { onError?.("No hay nadie presente para sortear."); return; }
      userId = elegibles[Math.floor(Math.random() * elegibles.length)].user_id;
      source = "raffle";
    }

    setOcupado(true); onError?.(null);
    try {
      await grantReward(event.id, { user_id: userId, prize_key: premio, source });
      await cargar();
      flash(`${source === "raffle" ? "🎲 Salió sorteado" : "🏅 Reconocido"}: ${nombre(userId)} · ${PREMIOS[premio]?.label || premio}`);
    } catch (err) { onError?.(err); }
    finally { setOcupado(false); }
  };

  const entregar = async (fila) => {
    if (!window.confirm(
      `¿Marcar como entregado el premio de ${nombre(fila.user_id)}?\n\n` +
      "Queda registrada la fecha y no se puede desmarcar.")) return;
    setOcupado(true);
    try { await markRewardDelivered(fila.id); await cargar(); }
    catch (err) { onError?.(err); }
    finally { setOcupado(false); }
  };

  return (
    <PanelSection id="sorteos" title="Sorteos y reconocimientos" icon="🎉"
      badge={otorgados.length || null}>

      {aviso && (
        <div style={{
          padding: "8px 10px", borderRadius: 10, marginBottom: 10, fontSize: 11, lineHeight: 1.45,
          background: "rgba(0,245,160,.09)", border: "1px solid rgba(0,245,160,.28)", color: P.verde,
        }}>{aviso}</div>
      )}

      <Campo label="A quién"
        hint={destino
          ? "Reconocimiento puntual: se guarda con source='manual'."
          : `Sorteo al azar entre los presentes. Entran ${elegibles.length} de ${participants.length}.`}>
        <select className="pdj-input" value={destino} disabled={ocupado}
          aria-label="Destinatario del premio"
          onChange={(e) => setDestino(e.target.value)}>
          <option value="">🎲 Sorteo al azar entre los presentes ({elegibles.length})</option>
          {participants.map((p) => (
            <option key={p.user_id} value={p.user_id}>{nombre(p.user_id)}</option>
          ))}
        </select>
      </Campo>

      {!destino && (
        <label style={{
          display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
          fontSize: 10.5, color: "rgba(240,232,255,.55)", marginTop: -6, marginBottom: 11,
        }}>
          <input type="checkbox" checked={sinStaff} disabled={ocupado}
            onChange={(e) => setSinStaff(e.target.checked)}
            style={{ accentColor: "#9B2FFF", cursor: "pointer", flexShrink: 0 }} />
          Dejar al staff fuera del sorteo
        </label>
      )}

      <Campo label="Premio adjunto"
        hint={habilitados === null ? "Cargando el catálogo…"
          : catalogo.length === 0 ? "No hay ningún premio habilitado en el catálogo del evento."
          : "Sale del catálogo habilitado en la sección Recompensas del Editor."}>
        <select className="pdj-input" value={premio} disabled={ocupado || catalogo.length === 0}
          aria-label="Premio a otorgar"
          onChange={(e) => setPremio(e.target.value)}>
          <option value="">Elegí un premio…</option>
          {catalogo.map((k) => (
            <option key={k} value={k}>{PREMIOS[k]?.ico} {PREMIOS[k]?.label || k}</option>
          ))}
        </select>
      </Campo>

      <button type="button" className="pdj-mini pdj-mini-p" style={{ padding: "10px 18px" }}
        disabled={ocupado || !premio || (!destino && elegibles.length === 0)}
        onClick={otorgar}>
        {ocupado ? "Otorgando…" : destino ? "🏅 Reconocer" : "🎲 Sortear"}
      </button>

      {/* ── Otorgados ──────────────────────────────────────────────── */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(240,232,255,.08)" }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: P.tenue, marginBottom: 7 }}>
          ÚLTIMOS OTORGADOS
        </div>

        {otorgados.length === 0 && (
          <div className="pdj-campo-hint" style={{ marginTop: 0 }}>
            Todavía no se otorgó ningún premio en este evento.
          </div>
        )}

        <div style={{ maxHeight: 260, overflowY: "auto" }}>
          {otorgados.map((g) => {
            const f = FUENTES[g.source] || { ico: "•", label: g.source };
            const pr = PREMIOS[g.prize_key];
            return (
              <div key={g.id} style={{
                display: "flex", alignItems: "center", gap: 7, marginBottom: 4,
                padding: "6px 8px", borderRadius: 9,
                background: "rgba(240,232,255,.035)", border: "1px solid rgba(240,232,255,.07)",
              }}>
                <span style={{ fontSize: 13, flexShrink: 0 }} title={f.label}>{f.ico}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 11.5, fontWeight: 700, color: P.texto,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{nombre(g.user_id)}</div>
                  <div style={{
                    fontSize: 9.5, color: P.tenue2,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {pr ? `${pr.ico} ${pr.label}` : g.prize_key} · {f.label}
                    {g.granted_at && ` · ${new Date(g.granted_at).toLocaleTimeString("es-AR", {
                      hour: "2-digit", minute: "2-digit",
                    })}`}
                  </div>
                </div>
                {g.delivered_at ? (
                  <span className="pdj-chip" style={{
                    background: "rgba(0,245,160,.12)", color: P.verde, flexShrink: 0,
                  }}>ENTREGADO</span>
                ) : (
                  <button type="button" className="pdj-mini" disabled={ocupado}
                    title="Marcar como entregado" onClick={() => entregar(g)}>
                    ✓ Entregar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </PanelSection>
  );
}
