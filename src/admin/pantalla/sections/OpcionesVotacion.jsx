import { useEffect, useState } from "react";
import { saveEventFields } from "../../../services/pantallaDj";
import { P } from "../../../components/pantalla/pantallaUi";

/**
 * Reglas de votación → las tres opciones sueltas del original, cada una en su
 * tarjeta con su casilla. Se guardan solas (al tocar la casilla, y las horas al
 * salir del campo).
 *
 *   youtube_captions_enabled   → subtítulos automáticos en la TV (el motor los
 *                                pide con loadModule('captions'))
 *   vote_sound_enabled         → «pop» del celular al votar o reaccionar
 *   guest_cleanup_enabled      → limpieza de invitados: la corre el job
 *   guest_max_connection_hours   `pantalla-limpieza-invitados` (pg_cron, cada
 *                                15 min) con `pantalla_cleanup_guests()`
 */

function Opcion({ titulo, desc, checked, disabled, onCambiar, children }) {
  return (
    <div className="rv-card">
      <label className="rv-check">
        <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onCambiar(e.target.checked)}/>
        <span>
          <div className="rv-lbl" style={{ margin: 0 }}>{titulo}</div>
          <div className="rv-desc">{desc}</div>
        </span>
      </label>
      {children}
    </div>
  );
}

export default function OpcionesVotacion({ event, refresh, onError }) {
  const [ocupado, setOcupado] = useState(false);
  const [horas, setHoras] = useState(event.guest_max_connection_hours ?? 24);
  useEffect(() => { setHoras(event.guest_max_connection_hours ?? 24); }, [event.guest_max_connection_hours]);

  const guardar = async (patch) => {
    setOcupado(true); onError?.(null);
    try { await saveEventFields(event.id, patch); await refresh(); }
    catch (err) { onError?.(err); }
    finally { setOcupado(false); }
  };

  const guardarHoras = () => {
    const n = Math.round(Number(horas));
    if (!Number.isFinite(n) || n < 1 || n > 168) { setHoras(event.guest_max_connection_hours ?? 24); return; }
    if (n !== event.guest_max_connection_hours) guardar({ guest_max_connection_hours: n });
  };

  const modoVideo = event.content_mode !== "audio";

  return (
    <>
      <Opcion titulo="Subtítulos automáticos en videos de YouTube"
        desc={modoVideo
          ? "Mostrar u ocultar los subtítulos automáticos de YouTube en la vista TV. Se aplica al arrancar cada video nuevo."
          : "El evento está en modo MP3: no hay video que subtitular."}
        checked={!!event.youtube_captions_enabled} disabled={ocupado || !modoVideo}
        onCambiar={(v) => guardar({ youtube_captions_enabled: v })}/>

      <Opcion titulo="Sonido al votar/reaccionar"
        desc="Reproduce un “pop” corto y sutil en el celular del invitado cada vez que vota o manda una reacción. La vibración del celular funciona siempre, sin depender de esta opción."
        checked={event.vote_sound_enabled !== false} disabled={ocupado}
        onCambiar={(v) => guardar({ vote_sound_enabled: v })}/>

      <Opcion titulo="Limpieza automática de invitados"
        desc="Si está apagado, ningún invitado se elimina automáticamente aunque pase mucho tiempo conectado. Los roles VIP, Staff y DJ nunca se eliminan automáticamente."
        checked={!!event.guest_cleanup_enabled} disabled={ocupado}
        onCambiar={(v) => guardar({ guest_cleanup_enabled: v })}>
        <div className="rv-campo" style={{ opacity: event.guest_cleanup_enabled ? 1 : .5 }}>
          <label className="rv-inline">
            Horas máximas de conexión (1–168)
            <input className="pdj-input" type="number" min={1} max={168} value={horas}
              disabled={ocupado || !event.guest_cleanup_enabled}
              onChange={(e) => setHoras(e.target.value)} onBlur={guardarHoras}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}/>
          </label>
          <div className="rv-desc">
            Se cuenta desde que el invitado escaneó el QR por primera vez (no se renueva con la actividad). Por
            ejemplo, 11 horas para un bar que cierra. La limpieza corre sola cada 15 minutos.
          </div>
          {!event.guest_cleanup_enabled && (
            <div className="rv-desc" style={{ color: P.tenue }}>Activá la limpieza para editar las horas.</div>
          )}
        </div>
      </Opcion>
    </>
  );
}
