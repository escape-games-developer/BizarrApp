import SeccionReglas from "./SeccionReglas";
import SeccionKick from "./SeccionKick";
import SeccionSubtitulos from "./SeccionSubtitulos";
import SeccionLimpieza from "./SeccionLimpieza";
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

/** Orden observado en el editor original. */
export default function SeccionesConfig(shared) {
  return (
    <>
      <SeccionReglas {...shared} />
      <SeccionKick {...shared} />
      <SeccionSubtitulos {...shared} />
      <SeccionLimpieza {...shared} />
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
