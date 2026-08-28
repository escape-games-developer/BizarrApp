import { useCallback, useEffect, useState } from "react";
import { P } from "../../components/pantalla/pantallaUi";

/**
 * Sección plegable de la columna de configuración.
 *
 * Es el único acordeón del panel: ninguna sección arma el suyo. El estado
 * abierto/cerrado se guarda en localStorage por `id`, así el DJ vuelve a
 * encontrar el panel como lo dejó.
 *
 *   <PanelSection id="reglas-votacion" title="Reglas de votación"
 *                 status="ok" | "pendiente" defaultOpen={false}>
 *     …controles…
 *   </PanelSection>
 *
 * `status="pendiente"` es una sección todavía sin respaldo en la base: se ve
 * completa pero no escribe nada. Lo dice el chip y lo repite el cartel de
 * arriba del cuerpo, para que nadie crea que guardó.
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
  id, title, icon, status = "ok", defaultOpen = false, badge = null, children,
}) {
  const [abierta, setAbierta] = useState(() => leerAbierto(id, defaultOpen));

  // Si cambia el `id` (otra sección monta en el mismo lugar) se relee el estado.
  useEffect(() => { setAbierta(leerAbierto(id, defaultOpen)); }, [id, defaultOpen]);

  const alternar = useCallback(() => {
    setAbierta((v) => {
      const siguiente = !v;
      try { localStorage.setItem(LS_PREFIJO + id, siguiente ? "1" : "0"); } catch { /* modo privado */ }
      return siguiente;
    });
  }, [id]);

  const pendiente = status === "pendiente";

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
        {pendiente && (
          <span className="pdj-chip" style={{
            background: "rgba(255,214,0,.12)", color: P.amarillo,
            border: "1px solid rgba(255,214,0,.28)", flexShrink: 0,
          }}>PENDIENTE</span>
        )}
      </button>

      {abierta && (
        <div className="pdj-sec-cuerpo" id={`sec-${id}`}>
          {pendiente && (
            <div className="pdj-sec-aviso">
              <span style={{ flexShrink: 0 }}>🕓</span>
              <span>{AVISO_PENDIENTE}</span>
            </div>
          )}
          {children}
        </div>
      )}
    </section>
  );
}
