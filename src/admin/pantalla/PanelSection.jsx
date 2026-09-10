import { useCallback, useEffect, useState } from "react";
import { P } from "../../components/pantalla/pantallaUi";

/**
 * Acordeón de configuración del panel DJ.
 *
 * `status` sigue existiendo como metadata técnica, pero por defecto NO se
 * muestra al operador: el editor original no expone chips PENDIENTE ni carteles
 * de implementación. Para pantallas internas de desarrollo se puede activar
 * con `showTechnicalStatus`.
 *
 * `embedded` permite reutilizar una sección dentro de otra (por ejemplo,
 * Carteles/Filtro/Código dentro de Recompensas) sin crear un acordeón anidado.
 */

const LS_PREFIJO = "bizarrapp_pantalla_sec_";

export const AVISO_PENDIENTE =
  "Pendiente de base de datos — se activa en la próxima etapa";

function leerAbierto(id, porDefecto) {
  try {
    const v = localStorage.getItem(LS_PREFIJO + id);
    return v === null ? porDefecto : v === "1";
  } catch { return porDefecto; }
}

export default function PanelSection({
  id, title, icon, status = "ok", defaultOpen = false, badge = null,
  aviso = null, children, embedded = false, showTechnicalStatus = false,
}) {
  const [abierta, setAbierta] = useState(() => leerAbierto(id, defaultOpen));

  useEffect(() => { setAbierta(leerAbierto(id, defaultOpen)); }, [id, defaultOpen]);

  const alternar = useCallback(() => {
    setAbierta((v) => {
      const siguiente = !v;
      try { localStorage.setItem(LS_PREFIJO + id, siguiente ? "1" : "0"); } catch { /* modo privado */ }
      return siguiente;
    });
  }, [id]);

  const pendiente = status === "pendiente";

  if (embedded) {
    return (
      <div style={{
        marginTop: 16, paddingTop: 14,
        borderTop: "1px solid rgba(240,232,255,.10)",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 7, marginBottom: 10,
          fontSize: 10.5, fontWeight: 900, letterSpacing: .7,
          color: P.tenue, textTransform: "uppercase",
        }}>
          {icon && <span style={{ fontSize: 13 }}>{icon}</span>}
          <span>{title}</span>
          {badge != null && <span className="pdj-chip">{badge}</span>}
        </div>
        {children}
      </div>
    );
  }

  return (
    <section className={`pdj-sec${abierta ? " pdj-sec-abierta" : ""}`}>
      <button type="button" className="pdj-sec-cab" onClick={alternar}
        aria-expanded={abierta} aria-controls={`sec-${id}`}>
        <span className="pdj-sec-flecha">▸</span>
        {icon && <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>}
        <h5>{title}</h5>
        {badge != null && (
          <span className="pdj-chip" style={{
            background: "rgba(0,229,255,.12)", color: P.cyan, flexShrink: 0,
          }}>{badge}</span>
        )}
        {showTechnicalStatus && pendiente && (
          <span className="pdj-chip" style={{
            background: "rgba(255,214,0,.12)", color: P.amarillo,
            border: "1px solid rgba(255,214,0,.28)", flexShrink: 0,
          }}>PENDIENTE</span>
        )}
      </button>

      {abierta && (
        <div className="pdj-sec-cuerpo" id={`sec-${id}`}>
          {showTechnicalStatus && pendiente && (
            <div className="pdj-sec-aviso">
              <span style={{ flexShrink: 0 }}>🕓</span>
              <span>{aviso || AVISO_PENDIENTE}</span>
            </div>
          )}
          {children}
        </div>
      )}
    </section>
  );
}
