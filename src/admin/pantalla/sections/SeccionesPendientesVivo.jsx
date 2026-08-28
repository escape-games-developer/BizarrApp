import QRCode from "react-qr-code";
import { P } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";

/**
 * Lo que la cabina todavía no puede hacer.
 *
 * Se maqueta completo y deshabilitado en vez de esconderlo: el DJ ve qué va a
 * haber y no lo busca en otro lado. **Ninguno de estos controles llama a
 * Supabase** — no hay handler, los inputs están `disabled` y los QR de rol son
 * decorativos.
 *
 * A diferencia de la FASE 4, acá lo que falta no son columnas: es el motor.
 * Los efectos los tiene que dibujar la TV, los súper votos por equipo los tiene
 * que aplicar `pantalla_cast_super_vote`, y los QR de rol necesitan que
 * `pantalla_join_event` acepte un rol — hoy no recibe ninguno. Nada de eso se
 * toca desde el panel.
 */

const ROLES_QR = [
  { id: "vip",      ico: "👑", label: "VIP" },
  { id: "birthday", ico: "🎂", label: "Cumpleañero" },
  { id: "staff",    ico: "🛠", label: "Staff" },
];

export default function SeccionesPendientesVivo({ event, participants }) {
  return (
    <>
      {/* ── Efectos de TV ───────────────────────────────────────────── */}
      <PanelSection id="efectos-tv" title="Efectos visuales en TV" icon="🎆" status="pendiente">
        <div className="pdj-sub">
          Dispara un efecto sobre el video que está sonando.
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[["🎉", "Confetti"], ["✨", "Destellos"], ["⚡", "Rayos láser"]].map(([ico, txt]) => (
            <button key={txt} type="button" className="pdj-mini" disabled
              title="El motor de la TV todavía no dibuja efectos">
              {ico} {txt}
            </button>
          ))}
        </div>
        <div className="pdj-campo-hint">
          Falta que la vista de TV escuche y dibuje el efecto. No es una columna: es motor.
        </div>
      </PanelSection>

      {/* ── Sorteos y reconocimientos ───────────────────────────────── */}
      <PanelSection id="sorteos-manuales" title="Sorteos y reconocimientos" icon="🎉" status="pendiente">
        <div className="pdj-sub">
          Sortear entre los presentes o reconocer a alguien en particular, con un premio adjunto.
        </div>

        <div className="pdj-campo">
          <span className="pdj-campo-lbl">A quién</span>
          <select className="pdj-input" disabled defaultValue="">
            <option value="">Sorteo al azar entre {participants.length} presente(s)</option>
          </select>
        </div>

        <div className="pdj-campo">
          <span className="pdj-campo-lbl">Premio adjunto</span>
          <select className="pdj-input" disabled defaultValue="">
            <option value="">Sin premio</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button type="button" className="pdj-mini pdj-mini-p" disabled>🎲 Sortear</button>
          <button type="button" className="pdj-mini" disabled>🏅 Reconocer</button>
        </div>
        <div className="pdj-campo-hint">
          Otorgar el premio escribiría en <code>pantalla_granted_rewards</code>, pero todavía
          nada lo consume: la TV no muestra el cartel y el invitado no ve el premio. Se deja
          apagado hasta que ese circuito exista.
        </div>
      </PanelSection>

      {/* ── Súper votos por equipo ──────────────────────────────────── */}
      <PanelSection id="super-equipos" title="Súper votos por equipo" icon="🏆" status="pendiente">
        <div className="pdj-sub">
          Darle súper votos a todo un equipo de una sola vez.
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          <select className="pdj-input" disabled defaultValue="" style={{ flex: 1 }}>
            <option value="">Elegí un equipo…</option>
          </select>
          <input className="pdj-input" type="number" disabled defaultValue={1} min={1}
            aria-label="Cantidad de súper votos" style={{ width: 62 }} />
          <button type="button" className="pdj-mini pdj-mini-p" disabled>Dar</button>
        </div>
        <div className="pdj-campo-hint">
          El cupo de súper votos lo lleva <code>pantalla_participants.extra_super_votes</code>,
          pero repartirlo por equipo necesita que el motor sepa quién es de qué equipo. Todavía
          no hay tabla de pertenencia.
        </div>
      </PanelSection>

      {/* ── QRs de roles especiales ─────────────────────────────────── */}
      <PanelSection id="qr-roles" title="QRs de roles especiales" icon="🎫" status="pendiente">
        <div className="pdj-sub">
          Un QR por rol: quien lo escanea entra ya con ese rol, sin que el staff lo asigne a mano.
        </div>
        <div style={{ display: "flex", gap: 9, justifyContent: "center", flexWrap: "wrap" }}>
          {ROLES_QR.map((r) => (
            <div key={r.id} style={{ textAlign: "center", opacity: .4 }}>
              <div className="pdj-qr" style={{ display: "inline-block", filter: "grayscale(1)" }}>
                <QRCode value={`${window.location.origin}/?pantallaCode=${event.code}`} size={64} />
              </div>
              <div style={{ fontSize: 9.5, color: P.tenue, marginTop: 4 }}>{r.ico} {r.label}</div>
            </div>
          ))}
        </div>
        <div className="pdj-campo-hint">
          Los de arriba son decorativos: apuntan al link común. Para que sirvan,
          <code style={{ margin: "0 3px" }}>pantalla_join_event</code> tiene que aceptar un rol
          firmado — hoy no recibe ninguno, y por eso nadie puede auto-asignarse VIP.
        </div>
      </PanelSection>
    </>
  );
}
