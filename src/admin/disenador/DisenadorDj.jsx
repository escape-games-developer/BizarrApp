import { useEffect, useMemo, useState } from "react";
import EditorLienzo from "../../lienzo/editor/EditorLienzo";
import { DJ_POR_DEFECTO, PANTALLAS_DJ } from "../../lienzo/juegos/dj";
import { guestUrl } from "../../services/pantallaDj";
import { fetchGifs, fetchTeamScores } from "../../services/pantallaConfig";
import { usePantallaEvent } from "../../hooks/realtime/usePantallaEvent";
import { esKickDual } from "../../constants/kickModos";

/**
 * Diseñador → DJ Democracy: la pantalla gigante del DJ en el editor libre de
 * pantallas (src/lienzo), igual que los juegos. Fila `lienzo_dj`, una sola
 * para el bar (antes el diseño era por evento, en
 * `pantalla_events.tv_canvas_config`: la TV lo sigue usando mientras no se
 * guarde ésta).
 *
 * El editor mira el evento en vivo (Realtime, como la TV):
 *  - muestra lo REAL donde lo hay — la canción al aire, las próximas, el
 *    evento, el estado de la votación, el marcador — y un ejemplo donde no;
 *  - marca con ⚠ lo que hoy no se ve en la TV y por qué (equipos apagados,
 *    votación abierta, Sacar tema en otro modo…), para que el editor nunca
 *    muestre algo «activo» que la pantalla no tiene.
 */

const ESTILO_KICK = { love_hate: "Amor y Odio", guns_roses: "Guns & Roses" };

function avisosDelEvento(ev, { current, candidates, gifsPremio }) {
  if (!ev) return null;
  const a = {};
  if (!current) {
    a.djSonando = "no hay ninguna canción al aire.";
    a.djProgreso = "no hay ninguna canción al aire.";
  }
  if (!candidates.length) a.djProximas = "la lista de próximas está vacía: se ve «Esperando que el DJ cargue la lista…».";
  if (!ev.teams_enabled) a.djEquipos = "los equipos están apagados en el evento (DJ Democracy → Editor → Equipos).";
  if (!ev.voting_disabled) {
    a.djVotacionCerrada = (Number(ev.vote_close_seconds) || 0) > 0
      ? `aparece sola en los últimos ${ev.vote_close_seconds} s de cada canción, con la cuenta regresiva (o si el DJ apaga la votación).`
      : "el cierre automático de la votación está en 0 (DJ Democracy → Editor → Votación): sólo aparece si el DJ apaga la votación.";
  }
  a.djGifPremio = "sólo aparece cuando un cliente usa su poder «GIF a pantalla»."
    + (gifsPremio ? "" : " Además, la galería del DJ no tiene GIFs de premio: nadie puede mandar uno.");
  if (!ev.kick_enabled) a.djContador = "Sacar tema está apagado en el evento.";
  else if (esKickDual(ev.kick_style)) {
    a.djContador = `Sacar tema está en «${ESTILO_KICK[ev.kick_style]}»: en esta caja aparece su medidor, no este contador.`;
  }
  if (!(ev.transition_enabled && ev.transition_gif_url)) a.djTransicion = "la transición entre canciones está apagada (DJ Democracy → Editor → Transición).";
  return a;
}

export default function DisenadorDj() {
  const { event, candidates, current } = usePantallaEvent({ discoverLive: true });
  const [gifs, setGifs] = useState([]);
  const [equipos, setEquipos] = useState(null);

  useEffect(() => {
    if (!event?.id) return;
    fetchGifs(event.id).then((g) => setGifs(g.filter((x) => x.kind === "prize"))).catch(() => setGifs([]));
  }, [event?.id]);

  useEffect(() => {
    if (!event?.id || !event.teams_enabled) { setEquipos(null); return; }
    fetchTeamScores(event.id).then(setEquipos).catch(() => setEquipos(null));
  }, [event?.id, event?.teams_enabled]);

  // Lo real donde existe; `undefined` deja el ejemplo del elemento.
  const datos = useMemo(() => ({
    qrUrl: guestUrl(event?.code || "LDR4X3"),
    evento: event ? { nombre: event.name || "Pantalla Bizarren", codigo: event.code } : undefined,
    sonando: current || undefined,
    proximas: candidates.length ? candidates : undefined,
    progreso: current && event?.tv_duration > 0
      ? { actual: Number(event.tv_current_time) || 0, total: Number(event.tv_duration), al: 0, sonando: false } : undefined,
    enVivo: event ? event.status === "live" : undefined,
    votacion: event ? (event.voting_disabled ? "apagada" : event.voting_frozen ? "congelada" : "abierta") : undefined,
    equipos: equipos || undefined,
    gifEjemplo: gifs[0]?.url || null,
  }), [event, current, candidates, equipos, gifs]);

  const avisos = useMemo(() => avisosDelEvento(event, { current, candidates, gifsPremio: gifs.length }),
    [event, current, candidates, gifs.length]);

  return <EditorLienzo juego="dj" pantallas={PANTALLAS_DJ} porDefecto={DJ_POR_DEFECTO} datos={datos} avisos={avisos}/>;
}
