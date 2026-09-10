import { useState, useEffect } from "react";
import { saveEventFields } from "../../../services/pantallaDj";
import { P } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";
import { BotonGuardar, CampoSwitch, useGuardado } from "../panelControls";

/**
 * Subtítulos automáticos de YouTube en la TV.
 *
 * Sección propia, como en la original. Antes vivía dentro de «Modo de
 * contenido», que además está pendiente: el operador veía el cartel amarillo de
 * la tarjeta y no tenía forma de saber que el switch de abajo sí funcionaba.
 *
 * Es de las pocas configuraciones del panel que llega entera hasta la pantalla:
 * `youtube_captions_enabled` viaja a `/tv` como `captionsEnabled` y el motor lo
 * aplica con `loadModule('captions')` sobre los dos players.
 *
 * Depende de dos cosas que no controlamos: que el evento esté en modo video, y
 * que YouTube haya generado la pista para ese video — no la tiene todo el
 * catálogo, así que el switch encendido no garantiza subtítulos en pantalla.
 */
export default function SeccionSubtitulos({ event, refresh }) {
  const [subs, setSubs] = useState(!!event.youtube_captions_enabled);
  useEffect(() => { setSubs(!!event.youtube_captions_enabled); }, [event.youtube_captions_enabled]);

  const { estado, mensaje, guardar } = useGuardado(async () => {
    await saveEventFields(event.id, { youtube_captions_enabled: subs });
    await refresh();
  });

  const modoVideo = event.content_mode !== "audio";

  return (
    <PanelSection id="subtitulos-youtube" title="Subtítulos de YouTube" icon="💬">
      <CampoSwitch label="Subtítulos automáticos en la TV" checked={subs}
        disabled={!modoVideo} onChange={setSubs} />

      <div className="pdj-campo-hint" style={{ marginTop: 4 }}>
        Le pide la pista de subtítulos automáticos al reproductor. Depende de que el video la
        tenga: YouTube no la genera para todos.
      </div>

      {!modoVideo && (
        <div className="pdj-campo-hint" style={{ color: P.amarillo }}>
          El evento está en modo MP3, donde no hay video que subtitular.
        </div>
      )}

      <BotonGuardar estado={estado} mensaje={mensaje}
        disabled={subs === !!event.youtube_captions_enabled} onClick={guardar} />
    </PanelSection>
  );
}
