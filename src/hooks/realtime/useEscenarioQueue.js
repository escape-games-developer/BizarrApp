import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "../../lib/supabase";

/**
 * useEscenarioQueue
 * Maneja la cola de inscriptos al escenario (FTL / PT / Karaoke).
 * - Usuario: inscribirse, salir de la cola
 * - Admin: ver la lista, llamar al escenario, terminar el turno
 *
 * `userId` es opcional y sólo lo pasa el cliente. Con él, "estoy inscripto"
 * se deriva de la fila que hay en la base y no de un useState: sin eso un F5
 * borraba la inscripción de la pantalla, el usuario volvía a apretar y el
 * INSERT chocaba contra UNIQUE (session_id, type, user_id) — botón muerto.
 *
 * Estados reales de la tabla: 'waiting' | 'called' | 'done' | 'left'.
 */
export function useEscenarioQueue(sessionId, type, userId = null) {
  const [queue,     setQueue]     = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const channelRef = useRef(null);

  const fetchQueue = useCallback(async () => {
    if (!sessionId || !type) return;
    const { data } = await supabase
      .from("escenario_queue")
      .select("*")
      .eq("session_id", sessionId)
      .eq("type", type)
      .in("status", ["waiting","called"])
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

  // Mi fila, derivada de la cola que vino de la base. Sobrevive al F5 y la
  // actualiza el mismo Realtime que ya escucha la tabla: cuando el admin me
  // llama al escenario, mi pantalla pasa sola de "inscripto" a "te toca".
  const myEntry = useMemo(
    () => (userId ? queue.find((q) => q.user_id === userId) || null : null),
    [queue, userId],
  );
  const isEnrolled = !!myEntry;

  // Inscribirse
  const enroll = useCallback(async (user, ytId = null, ytTitle = null) => {
    if (!sessionId || !user?.id) {
      const msg = "Todavía no hay una sesión activa. Probá de nuevo en unos segundos.";
      setError(msg);
      return { error: msg };
    }
    setLoading(true);
    setError(null);
    const { data, error: insErr } = await supabase
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
    if (!insErr) {
      setLoading(false);
      await fetchQueue();
      return { data, error: null };
    }

    // 23505 = UNIQUE (session_id, type, user_id). Ya hay una fila mía en esta
    // sesión (me salí, o ya subí una vez): la reactivo en lugar de insertar
    // otra. Sin esto el botón quedaba muerto para siempre después del primer
    // "salir de la cola".
    if (insErr.code === "23505") {
      const { data: reData, error: reErr } = await supabase
        .from("escenario_queue")
        .update({
          status:       "waiting",
          yt_id:        ytId,
          yt_title:     ytTitle,
          avatar_id:    user.avatarId    || null,
          avatar_emoji: user.avatarEmoji || null,
          position:     queue.length + 1,
        })
        .eq("session_id", sessionId)
        .eq("type", type)
        .eq("user_id", user.id)
        .select()
        .single();
      setLoading(false);
      if (reErr) { setError(reErr.message); return { error: reErr.message }; }
      await fetchQueue();
      return { data: reData, error: null };
    }

    setLoading(false);
    setError(insErr.message);
    return { error: insErr.message };
  }, [sessionId, type, queue.length, fetchQueue]);

  // Salir de la cola. 'left' es el estado real de la tabla — 'cancelled' no
  // pasa el CHECK y el UPDATE volvía con error mientras la pantalla ya se
  // había puesto en "no inscripto": el usuario quedaba en la cola sin saberlo.
  const leave = useCallback(async () => {
    if (!myEntry?.id) return { error: null };
    setError(null);
    const { error: upErr } = await supabase
      .from("escenario_queue")
      .update({ status: "left" })
      .eq("id", myEntry.id);
    if (upErr) { setError(upErr.message); return { error: upErr.message }; }
    await fetchQueue();
    return { error: null };
  }, [myEntry, fetchQueue]);

  // Admin. Devuelven { error: string|null } — el panel los muestra; ninguno
  // puede quedar en un console.error que el operador no ve.
  const call = useCallback(async (entryId) => {
    if (!entryId) return { error: "Sin participante" };
    const { error: upErr } = await supabase
      .from("escenario_queue")
      .update({ status: "called" })
      .eq("id", entryId);
    if (upErr) return { error: upErr.message };
    await fetchQueue();
    return { error: null };
  }, [fetchQueue]);

  const finish = useCallback(async (entryId) => {
    if (!entryId) return { error: "Sin participante" };
    const { error: upErr } = await supabase
      .from("escenario_queue")
      .update({ status: "done" })
      .eq("id", entryId);
    if (upErr) return { error: upErr.message };
    await fetchQueue();
    return { error: null };
  }, [fetchQueue]);

  return { queue, myEntry, isEnrolled, loading, error, setError,
           refresh: fetchQueue, enroll, leave, call, finish };
}