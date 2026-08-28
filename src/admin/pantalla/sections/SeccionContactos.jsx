import { useCallback, useEffect, useState } from "react";
import { fetchContacts, contactosACsv, descargarTexto } from "../../../services/pantallaConfig";
import { P } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";

/**
 * Base de contactos permanente.
 *
 * Es **sólo lectura desde el panel**: las filas las escribe el backend cuando
 * alguien se une, no esta pantalla. `pantalla_contacts` no tiene policy de
 * lectura pública — ni siquiera el propio invitado lee su fila — así que esta
 * lista sólo aparece con sesión de admin.
 *
 * Sobrevive al evento: reiniciarlo no la borra, que es todo el punto de tener
 * una base y no una lista de la noche.
 */
export default function SeccionContactos({ event, onError }) {
  const [contactos, setContactos] = useState([]);
  const [cargando,  setCargando]  = useState(false);
  const [filtro,    setFiltro]    = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    try { setContactos(await fetchContacts(event.id)); }
    catch (err) { onError?.(err); }
    finally { setCargando(false); }
  }, [event.id, onError]);

  useEffect(() => { cargar(); }, [cargar]);

  const q = filtro.trim().toLowerCase();
  const visibles = q
    ? contactos.filter((c) =>
        `${c.nickname || ""} ${c.email || ""} ${c.phone || ""}`.toLowerCase().includes(q))
    : contactos;

  const conEmail = contactos.filter((c) => c.email).length;
  const conTel   = contactos.filter((c) => c.phone).length;

  return (
    <PanelSection id="contactos" title="Base de contactos" icon="📇"
      badge={cargando ? "…" : contactos.length || null}>
      <div className="pdj-sub">
        Lo que dejaron los invitados al unirse. El panel sólo lee: las filas las escribe el
        servidor en el momento del ingreso.
      </div>

      <div className="pdj-metricas" style={{ marginBottom: 11 }}>
        {[
          { v: contactos.length, l: "Contactos", c: P.amarillo },
          { v: conEmail,         l: "Con email", c: P.cyan },
          { v: conTel,           l: "Con tel.",  c: P.verde },
        ].map((m) => (
          <div key={m.l} className="pdj-metrica" style={{ background: `${m.c}12`, borderColor: `${m.c}30` }}>
            <div className="pdj-metrica-v" style={{ color: m.c }}>{m.v}</div>
            <div className="pdj-metrica-l">{m.l}</div>
          </div>
        ))}
      </div>

      {contactos.length > 0 && (
        <input className="pdj-input" placeholder="🔍 Buscar por apodo, email o teléfono…"
          value={filtro} onChange={(e) => setFiltro(e.target.value)}
          style={{ marginBottom: 9 }} />
      )}

      {contactos.length === 0 && !cargando && (
        <div className="pdj-campo-hint" style={{ marginTop: 0, marginBottom: 9 }}>
          Todavía no hay contactos. Se llenan solos cuando el ingreso pide email o teléfono:
          revisá la sección «Ingreso de invitados».
        </div>
      )}

      <div style={{ maxHeight: 280, overflowY: "auto" }}>
        {visibles.map((c) => (
          <div key={c.id} style={{
            padding: "6px 9px", borderRadius: 9, marginBottom: 4,
            background: "rgba(240,232,255,.035)", border: "1px solid rgba(240,232,255,.07)",
          }}>
            <div style={{
              fontSize: 11.5, fontWeight: 700, color: P.texto,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{c.nickname || "Sin apodo"}</div>
            <div style={{
              fontSize: 9.5, color: P.tenue2, marginTop: 1,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {[c.email, c.phone].filter(Boolean).join(" · ") || "sin datos de contacto"}
            </div>
          </div>
        ))}
        {contactos.length > 0 && visibles.length === 0 && (
          <div className="pdj-campo-hint">Nadie coincide con la búsqueda.</div>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
        <button type="button" className="pdj-mini" disabled={cargando} onClick={cargar}>
          {cargando ? "Cargando…" : "↻ Actualizar"}
        </button>
        <button type="button" className="pdj-mini pdj-mini-a" disabled={contactos.length === 0}
          onClick={() => descargarTexto(
            `contactos-${event.code}.csv`,
            contactosACsv(contactos),
            "text/csv;charset=utf-8",
          )}>
          ↥ Exportar CSV
        </button>
      </div>
    </PanelSection>
  );
}
