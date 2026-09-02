import SeccionReglas from "./SeccionReglas";
import SeccionPoderes from "./SeccionPoderes";
import SeccionIngreso from "./SeccionIngreso";
import SeccionEmojis from "./SeccionEmojis";
import SeccionRegalosVip from "./SeccionRegalosVip";
import SeccionEquipos from "./SeccionEquipos";
import SeccionVisual from "./SeccionVisual";
import SeccionDisenadores from "./SeccionDisenadores";
import SeccionTandas from "./SeccionTandas";
import SeccionTransicion from "./SeccionTransicion";
import SeccionRecompensas from "./SeccionRecompensas";
import SeccionPresets from "./SeccionPresets";

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
      <SeccionReglas {...shared} />
      <SeccionIngreso {...shared} />
      <SeccionPoderes {...shared} />
      <SeccionEmojis {...shared} />
      <SeccionRegalosVip {...shared} />
      <SeccionEquipos {...shared} />
      <SeccionVisual {...shared} />
      <SeccionDisenadores {...shared} />
      <SeccionTandas {...shared} />
      <SeccionTransicion {...shared} />
      <SeccionRecompensas {...shared} />
      <SeccionPresets {...shared} />
    </>
  );
}
