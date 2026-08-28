import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { setParticipantRole, removeParticipant } from "../../../services/pantallaDj";
import { P } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";

/**
 * Invitados del evento: quién está, con qué rol, y sacarlo si hace falta.
 *
 * Los roles especiales se asignan sólo desde acá — el motor exige admin/DJ y
 * nadie se los puede auto-asignar desde la app. El nombre y la foto salen de
 * `profiles`, la identidad que el bar ya tiene: el módulo no duplica ni un dato
 * de contacto.
 */

const ROLES = [
  { id: "guest",    label: "Invitado",    color: P.tenue,    ico: "👤" },
  { id: "vip",      label: "VIP",         color: P.amarillo, ico: "👑" },
  { id: "birthday", label: "Cumpleañero", color: P.fucsia,   ico: "🎂" },
  { id: "staff",    label: "Staff",       color: P.cyan,     ico: "🛠" },
];

export default function SeccionInvitados({ event, participants, stats, refreshAdmin, onError }) {
  const [perfiles, setPerfiles] = useState({});
  const [filtro,   setFiltro]   = useState("");
  const [ocupado,  setOcupado]  = useState(false);

  useEffect(() => {
    const ids = participants.map((p) => p.user_id);
    if (!ids.length) { setPerfiles({}); return; }
    let cancelado = false;
    supabase.from("profiles").select("id,name,avatar_emoji,photo_url").in("id", ids)
      .then(({ data, error }) => {
        if (cancelado || error) return;
        setPerfiles(Object.fromEntries((data || []).map((p) => [p.id, p])));
      });
    return () => { cancelado = true; };
  }, [participants]);

  const correr = useCallback(async (fn) => {
    setOcupado(true); onError?.(null);
    try { await fn(); await refreshAdmin(); }
    catch (err) { onError?.(err); }
    finally { setOcupado(false); }
  }, [refreshAdmin, onError]);

  const corte = Date.now() - (event.kick_activity_minutes ?? 45) * 60_000;

  const visibles = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    return participants
      .map((p) => ({
        ...p,
        perfil: perfiles[p.user_id],
        activo: new Date(p.last_seen_at).getTime() > corte,
      }))
      .filter((p) => !q || (p.perfil?.name || "").toLowerCase().includes(q))
      .sort((a, b) => Number(b.activo) - Number(a.activo)
        || new Date(b.last_seen_at) - new Date(a.last_seen_at));
  }, [participants, perfiles, filtro, corte]);

  return (
    <PanelSection id="invitados" title="Invitados" icon="👥" badge={participants.length || null}>
      <div className="pdj-metricas" style={{ marginBottom: 11 }}>
        {[
          { v: stats.activos,       l: "Activos", c: P.verde },
          { v: stats.participantes, l: "Total",   c: P.amarillo },
          { v: stats.vips,          l: "VIP",     c: P.fucsia },
          { v: stats.staff,         l: "Staff",   c: P.cyan },
        ].map((m) => (
          <div key={m.l} className="pdj-metrica" style={{ background: `${m.c}12`, borderColor: `${m.c}30` }}>
            <div className="pdj-metrica-v" style={{ color: m.c }}>{m.v}</div>
            <div className="pdj-metrica-l">{m.l}</div>
          </div>
        ))}
      </div>

      <input className="pdj-input" placeholder="🔍 Buscar por nombre…" value={filtro}
        onChange={(e) => setFiltro(e.target.value)} style={{ marginBottom: 10 }} />

      {participants.length === 0 && (
        <div className="pdj-vacio" style={{ padding: "18px 8px" }}>
          <div className="pdj-vacio-ico">👥</div>
          <div className="pdj-vacio-tit">Todavía no se sumó nadie</div>
          <div className="pdj-vacio-txt">
            Los invitados entran solos al abrir <strong>Pantalla › 🎧 Música</strong> con el evento en vivo.
          </div>
        </div>
      )}

      {participants.length > 0 && visibles.length === 0 && (
        <div className="pdj-campo-hint">Nadie coincide con la búsqueda.</div>
      )}

      <div style={{ maxHeight: 340, overflowY: "auto" }}>
        {visibles.map((p) => {
          const rol = ROLES.find((r) => r.id === p.role) || ROLES[0];
          return (
            <div key={p.id} className="pdj-part" style={{ opacity: p.activo ? 1 : .55 }}>
              <div className="pdj-avatar">
                {p.perfil?.photo_url
                  ? <img src={p.perfil.photo_url} alt="" loading="lazy" />
                  : (p.perfil?.avatar_emoji || rol.ico)}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, fontWeight: 700, color: P.texto,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{p.perfil?.name || "Sin nombre"}</div>
                <div style={{
                  fontSize: 10, color: P.tenue2, marginTop: 2,
                  display: "flex", alignItems: "center", gap: 5,
                }}>
                  <span className="pdj-online" style={{ background: p.activo ? P.verde : "rgba(240,232,255,.2)" }} />
                  {p.activo ? "activo" : "inactivo"}
                  {p.super_votes_used > 0 && <span>· 🔥 {p.super_votes_used}</span>}
                </div>
              </div>

              <select value={p.role} disabled={ocupado}
                aria-label={`Rol de ${p.perfil?.name || "invitado"}`}
                onChange={(e) => correr(() => setParticipantRole(event.id, p.user_id, e.target.value))}
                style={{
                  flexShrink: 0, padding: "5px 6px", borderRadius: 8, fontSize: 10, cursor: "pointer",
                  fontWeight: 700, background: "rgba(240,232,255,.05)", color: rol.color,
                  border: "1px solid rgba(240,232,255,.1)", outline: "none",
                  fontFamily: "'Space Grotesk',sans-serif",
                }}>
                {ROLES.map((r) => <option key={r.id} value={r.id}>{r.ico} {r.label}</option>)}
              </select>

              <button type="button" className="pdj-ico pdj-ico-peligro" disabled={ocupado}
                title="Sacar del evento" aria-label="Sacar del evento"
                onClick={() => {
                  if (window.confirm(
                    `¿Sacar a ${p.perfil?.name || "este invitado"} del evento?\n\nSe borran sus votos.`)) {
                    correr(() => removeParticipant(event.id, p.user_id));
                  }
                }}>✕</button>
            </div>
          );
        })}
      </div>
    </PanelSection>
  );
}
