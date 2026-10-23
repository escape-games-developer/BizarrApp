import SeccionReglas from "./SeccionReglas";
import SeccionIngreso from "./SeccionIngreso";
import SeccionPoderes from "./SeccionPoderes";
import SeccionEmojis from "./SeccionEmojis";
import SeccionRegalosVip from "./SeccionRegalosVip";
import SeccionEquipos from "./SeccionEquipos";
import SeccionVisual from "./SeccionVisual";
import SeccionDisenadores from "./SeccionDisenadores";
import SeccionTandas from "./SeccionTandas";
import SeccionTransicion from "./SeccionTransicion";
import SeccionRecompensas from "./SeccionRecompensas";
import SeccionPresets from "./SeccionPresets";
import SeccionReset from "./SeccionReset";

/**
 * Orden observado en el editor original. «Reglas de votación» incluye Sacar
 * Tema, subtítulos, sonido y limpieza de invitados, como en el original.
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
      <SeccionReset {...shared} />
    </>
  );
}
