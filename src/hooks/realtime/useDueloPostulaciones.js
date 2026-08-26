import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "../../lib/supabase";

/**
 * useDueloPostulaciones
 *
 * Maneja las postulaciones del público al Duelo de Talentos (fase "inviting").
 * Lee/escribe la tabla duelo_postulaciones con Realtime.
 *
 * @param {string|null} sessionId  sesión activa
 * @param {object|null} user       usuario autenticado ({ id, name, avatarId, avatarEmoji, photoUrl })
 * @returns { postulaciones, misPostulacion, loading, error, postularme }
 */
export function useDueloPostulaciones(sessionId, user) {
  const [postulaciones, setPostulaciones] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);

  const channelRef        = useRef(null);
  const mountedRef        = useRef(true);
  const reconnectTimerRef = useRef(null);

  // ── Fetch de todas las postulaciones de la sesión ────────────────────────────
  // Nota: el fetch trae TODA la lista de la sesión y `misPostulacion` se deriva
  // de ahí; por eso depende SOLO de sessionId, no de user.id.
  const fetchAll = useCallback(async () => {
    console.log("[useDueloPostulaciones] fetching", { sessionId });
    if (!sessionId) { setPostulaciones([]); setLoading(false); return; }
    const { data, error: err } = await supabase
      .from("duelo_postulaciones")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (!mountedRef.current) return; // evita clobber si desmontó durante el await
    if (err) {
      console.error("[useDueloPostulaciones] fetch error:", err);
      setError(err.message);
    } else {
      setPostulaciones(data || []);
    }
    setLoading(false);
  }, [sessionId]);

  // ── Suscripción realtime con reconexión backoff 3s ───────────────────────────
  const subscribe = useCallback((sid) => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    const old = channelRef.current;
    channelRef.current = null;
    if (old) supabase.removeChannel(old);

    const channel = supabase
      .channel(`duelo_postulaciones_${sid}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "duelo_postulaciones",
        filter: `session_id=eq.${sid}`,
      }, fetchAll)
      .subscribe((status) => {
        if (
          (status === "CLOSED" || status === "TIMED_OUT") &&
          mountedRef.current && channelRef.current === channel
        ) {
          channelRef.current = null;
          reconnectTimerRef.current = setTimeout(() => {
            if (mountedRef.current) subscribe(sid);
          }, 3000);
        }
      });
    channelRef.current = channel;
  }, [fetchAll]);

  useEffect(() => {
    mountedRef.current = true;
    fetchAll();
    if (sessionId) subscribe(sessionId);
    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      const ch = channelRef.current;
      channelRef.current = null;
      if (ch) supabase.removeChannel(ch);
    };
  }, [sessionId, fetchAll, subscribe]);

  // ── Mi postulación (o null) ──────────────────────────────────────────────────
  const misPostulacion = useMemo(
    () => (user?.id ? postulaciones.find((p) => p.user_id === user.id) || null : null),
    [postulaciones, user?.id]
  );

  useEffect(() => {
    console.log(
      "[useDueloPostulaciones] got", postulaciones.length,
      "misPostulacion:", misPostulacion,
      "| userId:", user?.id, "| sessionId:", sessionId
    );
  }, [postulaciones, misPostulacion, user?.id, sessionId]);

  // ── Postularme ───────────────────────────────────────────────────────────────
  const postularme = useCallback(async () => {
    if (!sessionId || !user?.id) return;
    // Ya está postulado: no repetir (la UNIQUE session_id+user_id igual protege).
    if (postulaciones.some((p) => p.user_id === user.id)) return;

    const { error: err } = await supabase
      .from("duelo_postulaciones")
      .insert({
        session_id:   sessionId,
        user_id:      user.id,
        user_name:    user.name,
        avatar_id:    user.avatarId    || null,
        avatar_emoji: user.avatarEmoji || null,
        photo_url:    user.photoUrl    || null,
      });
    // Error típico: RLS o violación de UNIQUE (ya postulado en otra pestaña).
    if (err) {
      console.error("[useDueloPostulaciones] postularme error:", err);
      setError(err.message);
    }
  }, [sessionId, user, postulaciones]);

  // TODO: retirarPostulacion — la policy de DELETE/UPDATE es solo admin, así que
  // el usuario no puede retirarse por ahora. El admin rechaza (status='rejected').
  // No se expone en el return de esta versión.

  return { postulaciones, misPostulacion, loading, error, postularme };
}
