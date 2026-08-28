import { P } from "../../../components/pantalla/pantallaUi";

/**
 * Columna de configuración del editor: el orden en que el DJ arma una noche.
 *
 * Todas las secciones se montan con <PanelSection/>; ninguna arma su propio
 * acordeón. Las que todavía no tienen respaldo en la base van con
 * `status="pendiente"`, se ven completas y no escriben nada.
 */
export default function SeccionesConfig() {
  return (
    <div style={{ fontSize: 11, color: P.tenue, lineHeight: 1.6, padding: "4px 2px" }}>
      Las secciones de configuración se montan acá.
    </div>
  );
}
