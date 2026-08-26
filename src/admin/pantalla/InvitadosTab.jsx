import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { setParticipantRole, removeParticipant } from "../../services/pantallaDj";
import { P } from "../../components/pantalla/pantallaUi";

/**
 * Participantes del evento.
 *
 * Los roles especiales se asignan SÓLO desde acá. En DJ Democracy existe
 * `guest_self_assign_role`, con la que un invitado se convierte en VIP (peso ×2)
 * o cumpleañero (×3) llamando la RPC a mano; la auditoría lo confirmó en las dos
 * versiones. Ese camino no existe en BizarrApp: el motor exige admin/DJ.
 *
 * El nombre y el avatar salen de `profiles`, la identidad que el bar ya tiene.
 * No se duplica ningún dato de contacto en el módulo.
 */

const ROLES = [
  { id: "guest",    label: "Invitado",    color: P.tenue,    ico: "👤" },
  { id: "vip",      label: "VIP",         color: P.amarillo, ico: "👑" },
  { id: "birthday", label: "Cumpleañero", color: P.fucsia,   ico: "🎂" },
  { id: "staff",    label: "Staff",       color: P.cyan,     ico: "🛠" },
];

export default function InvitadosTab({ event, participants, stats, refreshAdmin, onError }) {
  const [perfiles, setPerfiles] = useState({});
  const [busy,     setBusy]     = useState(false);
  const [filtro,   setFiltro]   = useState("");

  // Los perfiles se leen aparte: los participantes ya vienen del panel.
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

  const run = useCallback(async (fn) => {
    setBusy(true); onError(null);
    try { await fn(); await refreshAdmin(); }
    catch (err) { onError(err); }
    finally { setBusy(false); }
  }, [refreshAdmin, onError]);

  const corte = Date.now() - (event.kick_activity_minutes ?? 45) * 60_000;

  const visibles = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    return participants
      .map((p) => ({ ...p, perfil: perfiles[p.user_id], activo: new Date(p.last_seen_at).getTime() > corte }))
      .filter((p) => !q || (p.perfil?.name || "").toLowerCase().includes(q))
      .sort((a, b) => Number(b.activo) - Number(a.activo)
        || new Date(b.last_seen_at) - new Date(a.last_seen_at));
  }, [participants, perfiles, filtro, corte]);

  return (
    <>
      <div className="pdj-card pdj-card-acento">
        <div className="pdj-card-titulo">
          <span style={{ fontSize: 15 }}>👥</span><h4>Participantes</h4>
        </div>
        <div className="pdj-metricas">
          {[
            { v: stats.activos,       l: "Activos ahora", c: P.verde },
            { v: stats.participantes, l: "Total",         c: P.amarillo },
            { v: stats.vips,          l: "VIP / Cumple",  c: P.fucsia },
            { v: stats.staff,         l: "Staff",         c: P.cyan },
          ].map((m) => (
            <div key={m.l} className="pdj-metrica" style={{ background: `${m.c}12`, borderColor: `${m.c}30` }}>
              <div className="pdj-metrica-v" style={{ color: m.c }}>{m.v}</div>
              <div className="pdj-metrica-l">{m.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="pdj-card">
        <div className="pdj-card-titulo">
          <span style={{ fontSize: 15 }}>⚡</span><h4>Gestión</h4>
          <span className="pdj-hint">acciones de admin</span>
        </div>
        <div className="pdj-sub">
          Los roles especiales los asigna el staff desde acá. Nadie puede auto-asignárselos
          desde la app del cliente.
        </div>

        <input className="pdj-input" placeholder="🔍 Buscar por nombre…"
          value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ marginBottom: 11 }} />

        {participants.length === 0 && (
          <div className="pdj-vacio">
            <div className="pdj-vacio-ico">👥</div>
            <div className="pdj-vacio-tit">Todavía no se sumó nadie</div>
            <div className="pdj-vacio-txt">
              Los clientes entran solos al abrir <strong>Pantalla › 🎧 Música</strong> con el evento en vivo.
            </div>
          </div>
        )}

        {participants.length > 0 && visibles.length === 0 && (
          <div className="pdj-vacio">
            <div className="pdj-vacio-ico">🔍</div>
            <div className="pdj-vacio-tit">Nadie coincide con la búsqueda</div>
          </div>
        )}

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
                  fontSize: 13, fontWeight: 700, color: P.texto,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{p.perfil?.name || "Sin nombre"}</div>
                <div style={{ fontSize: 10.5, color: P.tenue2, marginTop: 2,
                  display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="pdj-online" style={{ background: p.activo ? P.verde : "rgba(240,232,255,.2)" }} />
                  {p.activo ? "activo" : "inactivo"}
                  {p.super_votes_used > 0 && <span>· 🔥 {p.super_votes_used} usado(s)</span>}
                </div>
              </div>

              <select value={p.role} disabled={busy}
                aria-label={`Rol de ${p.perfil?.name || "participante"}`}
                onChange={(e) => run(() => setParticipantRole(event.id, p.user_id, e.target.value))}
                style={{
                  flexShrink: 0, padding: "6px 8px", borderRadius: 9, fontSize: 11, cursor: "pointer",
                  fontWeight: 700, background: "rgba(240,232,255,.05)", color: rol.color,
                  border: "1px solid rgba(240,232,255,.1)", outline: "none",
                  fontFamily: "'Space Grotesk',sans-serif",
                }}>
                {ROLES.map((r) => <option key={r.id} value={r.id}>{r.ico} {r.label}</option>)}
              </select>

              <button className="pdj-ico pdj-ico-peligro" disabled={busy}
                title="Sacar del evento" aria-label="Sacar del evento"
                onClick={() => {
                  if (window.confirm(
                    `¿Sacar a ${p.perfil?.name || "este participante"} del evento?\n\nSe borran sus votos.`))
                    run(() => removeParticipant(event.id, p.user_id));
                }}>✕</button>
            </div>
          );
        })}
      </div>
    </>
  );
}
