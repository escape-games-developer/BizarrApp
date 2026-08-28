import SeccionCodigo from "./SeccionCodigo";
import SeccionContenido from "./SeccionContenido";
import SeccionVotacion from "./SeccionVotacion";
import SeccionReglas from "./SeccionReglas";

/**
 * Columna de configuración del editor: el orden en que el DJ arma una noche.
 *
 * Todas las secciones se montan con <PanelSection/>; ninguna arma su propio
 * acordeón. Las que todavía no tienen respaldo en la base van con
 * `status="pendiente"`, se ven completas y no escriben nada.
 */
export default function SeccionesConfig(shared) {
  return (
    <>
      <SeccionCodigo {...shared} />
      <SeccionContenido {...shared} />
      <SeccionVotacion {...shared} />
      <SeccionReglas {...shared} />
    </>
  );
}
