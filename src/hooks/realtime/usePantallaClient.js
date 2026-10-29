import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  joinEvent, heartbeat, castVote, clearVote, castSuperVote,
  getKickStatus, toggleKickVote, votarKickFijo, sendReaction,
  fetchMyVotes, fetchVotePowers, fetchMyParticipant,
} from "../../services/pantallaDj";
import { fetchEmojiPackForRole, EMOJIS_POR_DEFECTO } from "../../services/pantallaConfig";
import { sonarPop } from "../../components/pantalla/sonidoPop";

const HEARTBEAT_MS = 30_000;   // mismo intervalo que usePresence
const KICK_RELEER_MS = 30_000;  // el mínimo de conectados cambia con la gente

/**
 * Lo que el cliente puede hacer dentro del evento.
 *
 * Diferencia central con DJ Democracy: la identidad es el usuario REAL de
 * BizarrApp (auth.users), no una sesión anónima. Limpiar el localStorage no
 * genera una identidad nueva ni permite votar de nuevo.
 *
 * El cliente sólo vota, super-vota, reacciona y participa del kick. No busca,
 * no pide ni agrega canciones: eso lo curó el admin.
 */
export function usePantallaClient(event, user) {
  const eventId = event?.id ?? null;
  const userId  = user?.id ?? null;
  const canPlay = Boolean(eventId && userId && event?.status === "live");

  const [role,     setRole]     = useState("guest");
  // Fila propia de pantalla_participants: súper votos usados y extras ganados.
  const [yo,       setYo]       = useState(null);
  const [myVotes,  setMyVotes]  = useState([]);
  const [powers,   setPowers]   = useState([]);
  const [kick,     setKick]     = useState(null);
  const [emojis,   setEmojis]   = useState(EMOJIS_POR_DEFECTO);
  const [joined,   setJoined]   = useState(false);
  const [busy,     setBusy]     = useState(null);   // id del tema en curso
  const [error,    setError]    = useState(null);
  const beatRef = useRef(null);
  // Sufijo propio de esta instancia: dos componentes con el mismo nombre de
  // canal reusarian el de Supabase y el segundo .on() falla tras subscribe().
  const canalId = useRef(Math.random().toString(36).slice(2, 8));

  const refreshVotes = useCallback(async () => {
    if (!canPlay) return;
    try { setMyVotes(await fetchMyVotes(eventId, userId)); }
    catch (err) { console.error("[usePantallaClient] votos:", err); }
  }, [canPlay, eventId, userId]);

  // Rol y súper votos salen de la fila propia del invitado. Se relee al
  // entrar y cada vez que esa fila cambia (el DJ le cambia el rol, gana un
  // súper voto extra, usa uno desde otro dispositivo).
  const refreshYo = useCallback(async () => {
    if (!canPlay) return;
    try {
      const fila = await fetchMyParticipant(eventId, userId);
      if (!fila) return;
      setYo(fila);
      setRole(fila.role || "guest");
    } catch (err) { console.error("[usePantallaClient] participante:", err); }
  }, [canPlay, eventId, userId]);

  const refreshKick = useCallback(async () => {
    if (!canPlay) return;
    try { setKick(await getKickStatus(eventId)); }
    catch (err) { console.error("[usePantallaClient] kick:", err); }
  }, [canPlay, eventId]);

  // Alta en el evento + poderes + estado inicial.
  useEffect(() => {
    if (!canPlay) { setJoined(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await joinEvent(eventId);
        if (cancelled) return;
        setRole(res?.role || "guest");
        setJoined(true);
        setPowers(await fetchVotePowers(eventId));
        await refreshYo();
        await refreshVotes();
        await refreshKick();
      } catch (err) {
        console.error("[usePantallaClient] join:", err);
        if (!cancelled) setError(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, [canPlay, eventId, refreshVotes, refreshKick, refreshYo]);

  // El pack de emojis depende del rol: se pide de nuevo si el DJ lo cambia.
  useEffect(() => {
    if (!joined) return;
    let cancelado = false;
    fetchEmojiPackForRole(eventId, role)
      .then((e) => { if (!cancelado) setEmojis(e); })
      .catch((err) => console.error("[usePantallaClient] emojis:", err));
    return () => { cancelado = true; };
  }, [joined, eventId, role]);

  // La fila propia por realtime (la RLS sólo deja ver la suya): un cambio de
  // rol o de súper votos llega solo, sin recargar.
  useEffect(() => {
    if (!canPlay) return;
    const channel = supabase
      .channel(`pantalla-yo-${eventId}-${userId}-${canalId.current}`)
      .on("postgres_changes",
        // Filtrado por usuario: con `event_id` cada latido de cualquier invitado
        // pasaba por Realtime (y por la RLS) para cada celular.
        { event: "*", schema: "public", table: "pantalla_participants", filter: `user_id=eq.${userId}` },
        (payload) => {
          const fila = payload.new && Object.keys(payload.new).length ? payload.new : payload.old;
          if (fila?.user_id === userId && fila?.event_id === eventId) refreshYo();
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [canPlay, eventId, userId, refreshYo]);

  // Heartbeat: mantiene "activo" al invitado para el cálculo del kick.
  useEffect(() => {
    if (!joined) return;
    beatRef.current = setInterval(() => { heartbeat(eventId).catch(() => {}); }, HEARTBEAT_MS);
    return () => clearInterval(beatRef.current);
  }, [joined, eventId]);

  // Los votos propios llegan por realtime. El filtro es por usuario (no por
  // evento): con `event_id`, cada voto de cualquiera se evaluaba contra la RLS
  // para cada celular y contaba en el tope de mensajes por segundo del
  // proyecto. Un voto propio de otro evento sólo dispara una relectura.
  useEffect(() => {
    if (!canPlay) return;
    const channel = supabase
      .channel(`pantalla-mine-${eventId}-${userId}-${canalId.current}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "pantalla_votes", filter: `user_id=eq.${userId}` },
        refreshVotes)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [canPlay, eventId, userId, refreshVotes]);

  // El kick se recalcula cuando cambia la canción (los votos son por tema),
  // cuando el admin toca las reglas de Sacar Tema o entra un voto (la fila del
  // evento llega por realtime) y cada 30 s: si aparece o se muestra depende de
  // cuántos invitados hay activos (mínimo de conectados), que cambia sin que
  // cambie la canción.
  useEffect(() => { refreshKick(); }, [
    event?.current_item_id, event?.kick_enabled, event?.kick_style, event?.kick_min_connected,
    event?.kick_min_votes, event?.kick_threshold_pct, event?.kick_button_text,
    event?.kick_votes_current, event?.kick_meter, refreshKick,
  ]);
  useEffect(() => {
    if (!joined) return undefined;
    const id = setInterval(refreshKick, KICK_RELEER_MS);
    return () => clearInterval(id);
  }, [joined, refreshKick]);

  // «Sonido al votar/reaccionar» (Reglas de votación): un pop al tocar.
  const sonido = event?.vote_sound_enabled !== false;
  const pop = useCallback(() => { if (sonido) sonarPop(); }, [sonido]);

  const powerOf = useCallback((voteType) => {
    const row = powers.find((p) => p.role === role && p.vote_type === voteType);
    return row || { enabled: false, value: 0 };
  }, [powers, role]);

  const voteOn = useCallback((itemId) => {
    const v = myVotes.find((x) => x.item_id === itemId && (x.vote_type === "up" || x.vote_type === "down"));
    return v?.vote_type ?? null;
  }, [myVotes]);

  // Cupo de súper votos (Súper Voto y Súper Hate comparten el mismo cupo, igual
  // que en el servidor): los del evento + los extra ganados − los usados.
  const superQuota = (event?.super_votes_per_user ?? 1) + (yo?.extra_super_votes ?? 0);
  const superLeft  = Math.max(0, superQuota - (yo?.super_votes_used ?? 0));
  const superUsed  = superLeft === 0;

  /** Súper voto ya puesto en este tema (super_up | super_down | null). */
  const superOn = useCallback((itemId) => {
    const v = myVotes.find((x) => x.item_id === itemId && (x.vote_type === "super_up" || x.vote_type === "super_down"));
    return v?.vote_type ?? null;
  }, [myVotes]);

  /** Envuelve una acción: marca el tema como ocupado y expone el error real. */
  const run = useCallback(async (itemId, fn) => {
    setBusy(itemId); setError(null);
    try { await fn(); await refreshVotes(); }
    catch (err) { setError(err.message); }
    finally { setBusy(null); }
  }, [refreshVotes]);

  const vote = useCallback((itemId, type = "up") => run(itemId, async () => {
    pop();
    // Volver a tocar el mismo botón quita el voto, como en el original.
    if (voteOn(itemId) === type) await clearVote(eventId, itemId, type);
    else                         await castVote(eventId, itemId, type);
  }), [run, voteOn, eventId, pop]);

  const superVote = useCallback((itemId, type = "super_up") =>
    run(itemId, async () => { pop(); await castSuperVote(eventId, itemId, type); await refreshYo(); }),
  [run, eventId, refreshYo, pop]);

  const toggleKick = useCallback(async () => {
    setError(null); pop();
    try { setKick(await toggleKickVote(eventId, event?.current_item_id)); await refreshKick(); }
    catch (err) { setError(err.message); }
  }, [eventId, event?.current_item_id, refreshKick, pop]);

  // Amor y Odio / Guns & Roses: un voto por tema, +1 o −1, sin cambiarlo.
  const voteKickFijo = useCallback(async (value) => {
    setError(null); pop();
    try { await votarKickFijo(eventId, value, event?.current_item_id); await refreshKick(); }
    catch (err) { setError(err.message); await refreshKick(); }
  }, [eventId, event?.current_item_id, refreshKick, pop]);

  const react = useCallback(async (emoji) => {
    pop();
    try { await sendReaction(eventId, userId, emoji); }
    catch (err) { console.error("[usePantallaClient] reaccion:", err); }
  }, [eventId, userId, pop]);

  // Apagado en el panel: se oculta ya, sin esperar la relectura. Staff y DJ no
  // cuentan como activos para el kick, así que tampoco lo votan (lo rechaza
  // también el servidor).
  const kickVisible = kick && (event?.kick_enabled === false || role === "staff" || role === "dj")
    ? { ...kick, enabled: false } : kick;

  return {
    role, joined, myVotes, powers, kick: kickVisible, busy, error, emojis,
    powerOf, voteOn, superUsed, superLeft, superQuota, superOn,
    vote, superVote, toggleKick, voteKickFijo, react,
    clearError: () => setError(null),
  };
}
