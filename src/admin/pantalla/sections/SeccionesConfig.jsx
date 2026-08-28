import SeccionCiclo from "./SeccionCiclo";
import SeccionCodigo from "./SeccionCodigo";
import SeccionContenido from "./SeccionContenido";
import SeccionVotacion from "./SeccionVotacion";
import SeccionReglas from "./SeccionReglas";
import SeccionKick from "./SeccionKick";
import SeccionPoderes from "./SeccionPoderes";
import SeccionTvLink from "./SeccionTvLink";
import SeccionInvitados from "./SeccionInvitados";
import SeccionIngreso from "./SeccionIngreso";
import SeccionContactos from "./SeccionContactos";
import SeccionLimpieza from "./SeccionLimpieza";
import SeccionEmojis from "./SeccionEmojis";
import SeccionRegalosVip from "./SeccionRegalosVip";
import SeccionEquipos from "./SeccionEquipos";
import SeccionVisual from "./SeccionVisual";
import SeccionDisenadores from "./SeccionDisenadores";
import SeccionTandas from "./SeccionTandas";
import SeccionTransicion from "./SeccionTransicion";
import SeccionRecompensas from "./SeccionRecompensas";
import SeccionCodigoCanje from "./SeccionCodigoCanje";
import SeccionCartelesTv from "./SeccionCartelesTv";
import SeccionFiltro from "./SeccionFiltro";
import SeccionPresets from "./SeccionPresets";
import SeccionLinkCorto from "./SeccionLinkCorto";
import SeccionReset from "./SeccionReset";

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
      <SeccionCiclo {...shared} />
      <SeccionCodigo {...shared} />
      <SeccionContenido {...shared} />
      <SeccionVotacion {...shared} />
      <SeccionReglas {...shared} />
      <SeccionKick {...shared} />
      <SeccionPoderes {...shared} />
      <SeccionTvLink {...shared} />
      <SeccionInvitados {...shared} />
      <SeccionIngreso {...shared} />
      <SeccionContactos {...shared} />
      <SeccionLimpieza {...shared} />
      <SeccionEmojis {...shared} />
      <SeccionRegalosVip {...shared} />
      <SeccionEquipos {...shared} />
      <SeccionVisual {...shared} />
      <SeccionDisenadores {...shared} />
      <SeccionTandas {...shared} />
      <SeccionTransicion {...shared} />
      <SeccionRecompensas {...shared} />
      <SeccionCodigoCanje {...shared} />
      <SeccionCartelesTv {...shared} />
      <SeccionFiltro {...shared} />
      <SeccionPresets {...shared} />
      <SeccionLinkCorto {...shared} />

      {/* Zona roja: siempre al fondo de la columna. */}
      <SeccionReset {...shared} />
    </>
  );
}
