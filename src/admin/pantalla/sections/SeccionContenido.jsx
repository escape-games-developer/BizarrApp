import { useState, useEffect } from "react";
import { saveEventFields } from "../../../services/pantallaDj";
import { P } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";
import { BotonGuardar, CampoSelect, CampoSwitch, useGuardado } from "../panelControls";

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
  const [subs, setSubs] = useState(!!event.youtube_captions_enabled);
  useEffect(() => { setModo(event.content_mode); }, [event.content_mode]);
  useEffect(() => { setSubs(!!event.youtube_captions_enabled); }, [event.youtube_captions_enabled]);

  const { estado, mensaje, guardar } = useGuardado(async () => {
    await saveEventFields(event.id, { content_mode: modo, youtube_captions_enabled: subs });
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

      <CampoSwitch label="Subtítulos automáticos de YouTube en la TV" checked={subs}
        disabled={modo !== "video"} onChange={setSubs} />
      <div className="pdj-campo-hint" style={{ marginTop: 4 }}>
        Pide la pista de subtítulos automáticos al reproductor. Sólo aplica en modo video, y
        depende de que el video la tenga: YouTube no la genera para todos.
      </div>

      <BotonGuardar estado={estado} mensaje={mensaje}
        disabled={modo === event.content_mode && subs === !!event.youtube_captions_enabled}
        onClick={guardar} />
    </PanelSection>
  );
}
