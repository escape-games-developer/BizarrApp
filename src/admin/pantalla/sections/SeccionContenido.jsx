import { useState, useEffect } from "react";
import { saveEventFields } from "../../../services/pantallaDj";
import { P } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";
import { BotonGuardar, CampoSelect, useGuardado } from "../panelControls";

/**
 * Qué reproduce la TV: el video de YouTube o sólo el audio de un MP3 propio.
 *
 * `content_mode` acepta 'video' y 'audio' — el CHECK de la tabla no admite
 * ningún otro valor. En modo audio los temas tienen que traer `audio_path`;
 * la carga de MP3 todavía no existe en el panel, así que se avisa.
 */

const MODOS = [
  { value: "video", label: "🎬 Videos de YouTube" },
  { value: "audio", label: "🎵 Música MP3" },
];

export default function SeccionContenido({ event, items, refresh }) {
  const [modo, setModo] = useState(event.content_mode);
  useEffect(() => { setModo(event.content_mode); }, [event.content_mode]);

  const { estado, mensaje, guardar } = useGuardado(async (valor) => {
    await saveEventFields(event.id, { content_mode: valor });
    await refresh();
  });

  const conAudio = items.filter((i) => i.audio_path).length;

  return (
    <PanelSection id="modo-contenido" title="Modo de contenido" icon="🎬">
      <CampoSelect label="Qué reproduce la TV" value={modo} options={MODOS}
        onChange={setModo}
        hint="En modo video la TV muestra el clip de YouTube. En modo MP3 sólo suena el audio del archivo del bar." />

      {modo === "audio" && conAudio === 0 && (
        <div className="pdj-campo-hint" style={{ color: P.amarillo, marginTop: -6, marginBottom: 8 }}>
          Ninguno de los {items.length} temas cargados tiene archivo de audio. En modo MP3 no habría
          nada para reproducir: la carga de archivos todavía no está en el panel.
        </div>
      )}

      <BotonGuardar estado={estado} mensaje={mensaje}
        disabled={modo === event.content_mode} onClick={() => guardar(modo)} />
    </PanelSection>
  );
}
