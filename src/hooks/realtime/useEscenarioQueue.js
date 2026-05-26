import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabase";

/**
 * useEscenarioQueue
 * Maneja la cola de inscriptos al escenario.
 * - Usuario: inscribirse, salir de la cola
 * - Admin: ver la lista, seleccionar participante
 */
export function useEscenarioQueue(sessionId, type) {
  const [queue,     setQueue]     = useState([]);
  const [myEntry,   setMyEntry]   = useState(null);
  const [loading,   setLoading]   = useState(false);
  const channelRef = useRef(null);

  const fetchQueue = useCallback(async () => {
    if (!sessionId || !type) return;
    const { data } = await supabase
      .from("escenario_queue")
      .select("*")
      .eq("session_id", sessionId)
      .eq("type", type)
      .eq("status", "waiting")
      .order("position", { ascending: true });
    setQueue(data || []);
  }, [sessionId, type]);

  // Suscribir Realtime
  useEffect(() => {
    fetchQueue();
    if (!sessionId || !type) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    const channel = supabase
      .channel(`escenario-queue-${sessionId}-${type}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "escenario_queue",
        filter: `session_id=eq.${sessionId}`,
      }, fetchQueue)
      .subscribe();

    channelRef.current = channel;
    return () => supabase.removeChannel(channel);
  }, [sessionId, type, fetchQueue]);

  // Inscribirse
  const enroll = useCallback(async (user, ytId = null, ytTitle = null) => {
    if (!sessionId || !user?.id) return { error: "Sin sesión o usuario" };
    setLoading(true);
    const { data, error } = await supabase
      .from("escenario_queue")
      .insert({
        session_id:   sessionId,
        type,
        user_id:      user.id,
        user_name:    user.name,
        avatar_id:    user.avatarId    || null,
        avatar_emoji: user.avatarEmoji || null,
        yt_id:        ytId,
        yt_title:     ytTitle,
        status:       "waiting",
        position:     queue.length + 1,
      })
      .select()
      .single();
    setLoading(false);
    if (!error) setMyEntry(data);
    return { error };
  }, [sessionId, type, queue.length]);

  // Salir de la cola
  const leave = useCallback(async () => {
    if (!myEntry?.id) return;
    await supabase
      .from("escenario_queue")
      .update({ status: "cancelled" })
      .eq("id", myEntry.id);
    setMyEntry(null);
  }, [myEntry]);

  const isEnrolled = !!myEntry;

  return { queue, myEntry, isEnrolled, loading, enroll, leave };
}