import { useCallback, useEffect, useState } from "react";
import { fetchShortLinks, createShortLink, deleteShortLink } from "../../../services/pantallaConfig";
import { P } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";
import { BotonCopiar, Campo } from "../panelControls";

/**
 * Links cortos del evento.
 *
 * `pantalla_short_links` tiene el propio código como clave primaria, así que un
 * código repetido lo rechaza la base — no hace falta chequearlo antes.
 *
 * El alfabeto es el mismo que usa el código del evento: sin I, O, 0 ni 1, que
 * de lejos se confunden. Se dicta por teléfono sin tener que deletrear.
 */

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const nuevoCodigo = () => Array.from(
  { length: 6 },
  () => ALFABETO[Math.floor(Math.random() * ALFABETO.length)],
).join("");

const limpiar = (v) => String(v || "").toUpperCase().split("")
  .filter((c) => ALFABETO.includes(c)).join("").slice(0, 8);

const urlCorta = (code) => `${window.location.origin}/t/${code}`;

const DESTINOS = {
  tv:    { label: "📺 Pantalla TV", ayuda: "Abre la TV del evento." },
  guest: { label: "📱 Invitado",    ayuda: "Abre la vista del invitado." },
};

export default function SeccionLinkCorto({ event, onError }) {
  const [links,   setLinks]   = useState([]);
  const [codigo,  setCodigo]  = useState(nuevoCodigo);
  const [destino, setDestino] = useState("tv");
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try { setLinks(await fetchShortLinks(event.id)); }
    catch (err) { onError?.(err); }
  }, [event.id, onError]);

  useEffect(() => { cargar(); }, [cargar]);

  const correr = async (fn) => {
    setOcupado(true); onError?.(null);
    try { await fn(); await cargar(); }
    catch (err) { onError?.(err); }
    finally { setOcupado(false); }
  };

  const crear = () => {
    if (codigo.length < 4) return;
    correr(async () => {
      await createShortLink(event.id, { code: codigo, target: destino });
      setCodigo(nuevoCodigo());
    });
  };

  return (
    <PanelSection id="link-corto" title="Link corto" icon="🔗" badge={links.length || null}>
      <div className="pdj-sec-aviso">
        <span style={{ flexShrink: 0 }}>🕓</span>
        <span>
          El link se crea y se guarda, pero la ruta <code>/t/:codigo</code> todavía no está
          dada de alta en la app: por ahora el link corto no redirige a ningún lado.
        </span>
      </div>

      <div className="pdj-sub">
        Un link fácil de dictar para la TV o para el invitado, sin token a la vista.
      </div>

      {links.map((l) => (
        <div key={l.code} style={{
          display: "flex", alignItems: "center", gap: 6, marginBottom: 5,
          padding: "7px 9px", borderRadius: 10,
          background: "rgba(240,232,255,.035)", border: "1px solid rgba(240,232,255,.08)",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: "'Syne',sans-serif", fontWeight: 900, fontSize: 12,
              color: P.amarillo, letterSpacing: 1.5,
            }}>/t/{l.code}</div>
            <div style={{ fontSize: 9, color: P.tenue2 }}>
              {DESTINOS[l.target]?.label || l.target}
            </div>
          </div>
          <BotonCopiar valor={urlCorta(l.code)} texto="⧉" />
          <button type="button" className="pdj-ico pdj-ico-peligro" disabled={ocupado}
            title="Eliminar link corto" aria-label={`Eliminar /t/${l.code}`}
            onClick={() => {
              if (window.confirm(`¿Eliminar el link corto /t/${l.code}?`)) {
                correr(() => deleteShortLink(l.code));
              }
            }}>✕</button>
        </div>
      ))}

      {links.length === 0 && (
        <div className="pdj-campo-hint" style={{ marginTop: 0, marginBottom: 9 }}>
          Todavía no hay ningún link corto para este evento.
        </div>
      )}

      <Campo label="Código nuevo" hint={DESTINOS[destino].ayuda}>
        <div style={{ display: "flex", gap: 5 }}>
          <input className="pdj-input" value={codigo} maxLength={8} disabled={ocupado}
            aria-label="Código del link corto"
            onChange={(e) => setCodigo(limpiar(e.target.value))}
            style={{
              flex: 1, minWidth: 0, fontFamily: "'Syne',sans-serif",
              fontWeight: 900, letterSpacing: 3, fontSize: 13,
            }} />
          <button type="button" className="pdj-mini" disabled={ocupado}
            title="Generar otro código" onClick={() => setCodigo(nuevoCodigo())}>🎲</button>
        </div>
      </Campo>

      <div style={{ display: "flex", gap: 5 }}>
        <select className="pdj-input" value={destino} disabled={ocupado}
          aria-label="Destino del link corto"
          onChange={(e) => setDestino(e.target.value)} style={{ flex: 1, minWidth: 0 }}>
          {Object.entries(DESTINOS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <button type="button" className="pdj-mini pdj-mini-p"
          disabled={ocupado || codigo.length < 4} onClick={crear}>+ Crear</button>
      </div>
    </PanelSection>
  );
}
