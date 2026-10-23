import { useCallback, useEffect, useRef, useState } from "react";
import { tvTandaEmitida, tvTandas } from "../services/pantallaDj";
import { urlDeAudio } from "../services/tandas";

/**
 * Tandas publicitarias en la TV (DJ Democracy → Editor → «Tandas publicitarias»).
 *
 * Cuenta las canciones del DJ que van pasando (cada cambio de
 * `current_item_id`) y, cuando llegan a `cadaN`, mete la tanda que toca ANTES
 * del tema siguiente. Ese tema no se pierde ni se adelanta: sigue siendo el
 * actual en la base y arranca cuando termina la tanda.
 *
 *   itemTanda   → clip de YouTube: un item sintético ('tanda:…') para el motor,
 *                 como el video de FTL (sin auto-avance ni reporte de progreso).
 *   audioTanda  → MP3 propio: lo reproduce un <audio> en PantallaTV, con la TV
 *                 tapada y el DJ en pausa.
 *
 * Rotación: sale el clip activo menos emitido (`times_played`) y, entre
 * empatados, el primero de la cola. Al terminar, /tv suma la emisión en la base
 * (`tv_tanda_emitida`), así la rotación sigue aunque la TV se recargue. Con un
 * juego en pantalla no se cuentan canciones ni entran tandas.
 */

const RELEER_MS = 30000;
// Si una tanda no avisa que terminó (video caído, MP3 que no carga), se suelta
// igual pasado su largo más este margen: el DJ no puede quedar trabado.
const MARGEN_MS = 15000;
const LARGO_POR_DEFECTO_S = 180;

const emitible = (c) => c.enabled !== false
  && ((c.source_type === "youtube" && c.youtube_id) || (c.source_type === "audio" && c.audio_path));

/** El clip que toca: el menos emitido y, entre empatados, el primero de la cola. */
const proximaTanda = (clips) => [...clips].filter(emitible)
  .sort((a, b) => (a.times_played ?? 0) - (b.times_played ?? 0) || (a.position ?? 0) - (b.position ?? 0))[0] || null;

export function useTandasTv({ eventId, token, current, habilitadas, cadaN, pausado, reportar }) {
  const [clips, setClips] = useState([]);
  const [tanda, setTanda] = useState(null);   // { clip, clave }
  const cancionesRef = useRef(0);
  const anteriorRef  = useRef(null);
  const terminadaRef = useRef(null);          // clave de la última tanda cerrada

  // La cola se relee sola: lo que se edite en el Admin llega en ≤ 30 s.
  useEffect(() => {
    if (!eventId) return undefined;
    let vivo = true;
    const leer = () => tvTandas(eventId)
      .then((c) => { if (vivo) setClips(c); })
      .catch((e) => console.warn("[TV] tandas:", e.message));
    leer();
    const id = setInterval(leer, RELEER_MS);
    return () => { vivo = false; clearInterval(id); };
  }, [eventId]);

  // Cada cambio de canción del DJ cuenta una. Al llegar a N entra la tanda.
  const actual = current?.id ?? null;
  const n = Math.max(1, Math.round(Number(cadaN) || 0));
  useEffect(() => {
    const anterior = anteriorRef.current;
    anteriorRef.current = actual;
    if (!anterior || !actual || anterior === actual || pausado || tanda) return;
    cancionesRef.current += 1;
    if (!habilitadas || cancionesRef.current < n) return;
    const clip = proximaTanda(clips);
    if (!clip) return;
    cancionesRef.current = 0;
    setTanda({ clip, clave: `${clip.id}:${Date.now().toString(36)}` });
  }, [actual]); // eslint-disable-line react-hooks/exhaustive-deps -- sólo cuenta cambios de canción

  const terminarTanda = useCallback(() => {
    if (!tanda || terminadaRef.current === tanda.clave) return;
    terminadaRef.current = tanda.clave;
    const { clip } = tanda;
    if (reportar && eventId && token) {
      tvTandaEmitida(eventId, token, clip.id).catch((e) => console.warn("[TV] tanda emitida:", e.message));
    }
    // La rotación avanza aunque el aviso a la base falle.
    setClips((cs) => cs.map((c) => (c.id === clip.id ? { ...c, times_played: (c.times_played ?? 0) + 1 } : c)));
    setTanda(null);
  }, [tanda, reportar, eventId, token]);

  // Red de seguridad: una tanda que no termina sola se suelta igual.
  useEffect(() => {
    if (!tanda) return undefined;
    const { clip } = tanda;
    const desde = Number(clip.trim_start_seconds) || 0;
    const hasta = Number(clip.trim_end_seconds) || Number(clip.duration_seconds) || desde + LARGO_POR_DEFECTO_S;
    const t = setTimeout(terminarTanda, Math.max(5, hasta - desde) * 1000 + MARGEN_MS);
    return () => clearTimeout(t);
  }, [tanda, terminarTanda]);

  // Habilitar / deshabilitar en el Admin con una tanda al aire: se corta.
  useEffect(() => { if (!habilitadas && tanda) setTanda(null); }, [habilitadas, tanda]);

  const clip = tanda?.clip || null;
  const itemTanda = clip?.source_type === "youtube" ? {
    id:                 `tanda:${tanda.clave}`,
    youtube_id:         clip.youtube_id,
    title:              clip.title || "Tanda",
    trim_start_seconds: Number(clip.trim_start_seconds) || 0,
    trim_end_seconds:   clip.trim_end_seconds || null,
    youtube_volume:     clip.volume ?? 100,
  } : null;
  const audioTanda = clip?.source_type === "audio" ? {
    clave:   tanda.clave,
    url:     urlDeAudio(clip.audio_path),
    titulo:  clip.title || "Tanda",
    inicio:  Number(clip.trim_start_seconds) || 0,
    fin:     Number(clip.trim_end_seconds) || null,
    volumen: Math.min(1, Math.max(0, (clip.volume ?? 100) / 100)),
  } : null;

  return { itemTanda, audioTanda, terminarTanda };
}
