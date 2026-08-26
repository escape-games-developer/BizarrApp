import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  joinEvent, heartbeat, castVote, clearVote, castSuperVote,
  getKickStatus, toggleKickVote, sendReaction,
  fetchMyVotes, fetchVotePowers,
} from "../../services/pantallaDj";

const HEARTBEAT_MS = 30_000;   // mismo intervalo que usePresence

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
  const [myVotes,  setMyVotes]  = useState([]);
  const [powers,   setPowers]   = useState([]);
  const [kick,     setKick]     = useState(null);
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
        await refreshVotes();
        await refreshKick();
      } catch (err) {
        console.error("[usePantallaClient] join:", err);
        if (!cancelled) setError(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, [canPlay, eventId, refreshVotes, refreshKick]);

  // Heartbeat: mantiene "activo" al invitado para el cálculo del kick.
  useEffect(() => {
    if (!joined) return;
    beatRef.current = setInterval(() => { heartbeat(eventId).catch(() => {}); }, HEARTBEAT_MS);
    return () => clearInterval(beatRef.current);
  }, [joined, eventId]);

  // Los votos propios llegan por realtime: la RLS filtra los ajenos, así que
  // esta suscripción sólo trae las filas de este usuario.
  useEffect(() => {
    if (!canPlay) return;
    const channel = supabase
      .channel(`pantalla-mine-${eventId}-${userId}-${canalId.current}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "pantalla_votes", filter: `event_id=eq.${eventId}` },
        refreshVotes)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [canPlay, eventId, userId, refreshVotes]);

  // El kick se recalcula cuando cambia la canción (los votos son por tema).
  useEffect(() => { refreshKick(); }, [event?.current_item_id, refreshKick]);

  const powerOf = useCallback((voteType) => {
    const row = powers.find((p) => p.role === role && p.vote_type === voteType);
    return row || { enabled: false, value: 0 };
  }, [powers, role]);

  const voteOn = useCallback((itemId) => {
    const v = myVotes.find((x) => x.item_id === itemId && (x.vote_type === "up" || x.vote_type === "down"));
    return v?.vote_type ?? null;
  }, [myVotes]);

  const superUsed = useMemo(
    () => myVotes.some((v) => v.vote_type === "super_up" || v.vote_type === "super_down"),
    [myVotes],
  );

  /** Envuelve una acción: marca el tema como ocupado y expone el error real. */
  const run = useCallback(async (itemId, fn) => {
    setBusy(itemId); setError(null);
    try { await fn(); await refreshVotes(); }
    catch (err) { setError(err.message); }
    finally { setBusy(null); }
  }, [refreshVotes]);

  const vote = useCallback((itemId, type = "up") => run(itemId, async () => {
    // Volver a tocar el mismo botón quita el voto, como en el original.
    if (voteOn(itemId) === type) await clearVote(eventId, itemId, type);
    else                         await castVote(eventId, itemId, type);
  }), [run, voteOn, eventId]);

  const superVote = useCallback((itemId) =>
    run(itemId, () => castSuperVote(eventId, itemId, "super_up")), [run, eventId]);

  const toggleKick = useCallback(async () => {
    setError(null);
    try { setKick(await toggleKickVote(eventId)); await refreshKick(); }
    catch (err) { setError(err.message); }
  }, [eventId, refreshKick]);

  const react = useCallback(async (emoji) => {
    try { await sendReaction(eventId, userId, emoji); }
    catch (err) { console.error("[usePantallaClient] reaccion:", err); }
  }, [eventId, userId]);

  return {
    role, joined, myVotes, powers, kick, busy, error,
    powerOf, voteOn, superUsed,
    vote, superVote, toggleKick, react,
    clearError: () => setError(null),
  };
}
