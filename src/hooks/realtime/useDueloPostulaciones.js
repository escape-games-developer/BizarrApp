import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "../../lib/supabase";

/**
 * useDueloPostulaciones — postulaciones al Duelo de Talentos (`duelo_postulaciones`).
 *
 * Contrato del backend (migración 20260930005253):
 *  · El cliente sólo inserta SU fila, en 'waiting', en la sesión activa.
 *  · Nombre, avatar y foto los completa el trigger `duelo_postulacion_identidad`
 *    desde `profiles`: el cliente NO los manda (lo que mandara se pisa).
 *  · UNIQUE (session_id, user_id): una postulación por persona y sesión.
 *  · Cambiar el estado o borrar filas es sólo de admin.
 *  · `duelo_launch_round` pasa a 'selected' a los dos elegidos; el resto sigue
 *    'waiting' y queda disponible para los próximos duelos.
 *
 * @param {string|null} sessionId
 * @param {object|null} user   usuario autenticado (sólo se usa `id`)
 */
function makeInstanceId() {
  return Math.random().toString(36).slice(2, 8);
}

/** Traduce el rechazo del INSERT a un mensaje para el público. */
function mensajePostulacion(err) {
  if (err?.code === "23505") return null; // ya estaba postulado: el refetch lo muestra
  if (err?.code === "23514" || /PROFILE_REQUIRED|perfil/i.test(err?.message || "")) {
    return "Completá tu perfil para poder postularte.";
  }
  if (err?.code === "42501") return "Las postulaciones no están abiertas en este momento.";
  return "No pudimos registrar tu postulación. Probá de nuevo en unos segundos.";
}

export function useDueloPostulaciones(sessionId, user) {
  const [postulaciones, setPostulaciones] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);

  const channelRef        = useRef(null);
  const mountedRef        = useRef(true);
  const reconnectTimerRef = useRef(null);
  const instanceIdRef     = useRef(makeInstanceId());

  const fetchAll = useCallback(async () => {
    if (!sessionId) { setPostulaciones([]); setLoading(false); return; }
    const { data, error: err } = await supabase
      .from("duelo_postulaciones")
      .select("id,session_id,user_id,user_name,avatar_id,avatar_emoji,photo_url,status,created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (!mountedRef.current) return;
    if (err) console.error("[useDueloPostulaciones] fetch error:", err);
    else setPostulaciones(data || []);
    setLoading(false);
  }, [sessionId]);

  // Suscripción con reconexión a los 3 s. El nombre lleva un id de instancia:
  // Admin y Cliente pueden convivir en la misma pestaña (preview).
  const subscribe = useCallback((sid) => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    const old = channelRef.current;
    channelRef.current = null;
    if (old) supabase.removeChannel(old);

    const channel = supabase
      .channel(`duelo_postulaciones_${sid}_${instanceIdRef.current}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "duelo_postulaciones",
        filter: `session_id=eq.${sid}`,
      }, fetchAll)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") fetchAll();
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

  const misPostulacion = useMemo(
    () => (user?.id ? postulaciones.find((p) => p.user_id === user.id) || null : null),
    [postulaciones, user?.id]
  );

  // ── Cliente: postularme ───────────────────────────────────────────────────
  // Sólo se manda lo mínimo que exige la policy. La identidad la pone el
  // trigger desde `profiles`.
  const postularme = useCallback(async () => {
    if (!sessionId || !user?.id) return;
    if (postulaciones.some((p) => p.user_id === user.id)) return;
    setError(null);
    const { error: err } = await supabase
      .from("duelo_postulaciones")
      .insert({ session_id: sessionId, user_id: user.id, status: "waiting" });
    if (err) {
      console.error("[useDueloPostulaciones] postularme error:", err);
      setError(mensajePostulacion(err));
    }
    fetchAll();
  }, [sessionId, user?.id, postulaciones, fetchAll]);

  // ── Admin ─────────────────────────────────────────────────────────────────
  // Devuelven `{ error }` con mensaje legible; el panel lo muestra.
  const quitar = useCallback(async (id) => {
    const { error: err } = await supabase.from("duelo_postulaciones").delete().eq("id", id);
    if (err) return { error: err.code === "42501" ? "Tu usuario no puede quitar postulantes." : err.message };
    fetchAll();
    return {};
  }, [fetchAll]);

  const reactivar = useCallback(async (id) => {
    const { error: err } = await supabase
      .from("duelo_postulaciones").update({ status: "waiting" }).eq("id", id);
    if (err) return { error: err.code === "42501" ? "Tu usuario no puede cambiar postulantes." : err.message };
    fetchAll();
    return {};
  }, [fetchAll]);

  /** Vacía la lista de la sesión, salvo los ids indicados (duelistas en juego). */
  const vaciar = useCallback(async (exceptIds = []) => {
    if (!sessionId) return {};
    let q = supabase.from("duelo_postulaciones").delete().eq("session_id", sessionId);
    const keep = exceptIds.filter(Boolean);
    if (keep.length) q = q.not("id", "in", `(${keep.join(",")})`);
    const { error: err } = await q;
    if (err) return { error: err.code === "42501" ? "Tu usuario no puede quitar postulantes." : err.message };
    fetchAll();
    return {};
  }, [sessionId, fetchAll]);

  return { postulaciones, misPostulacion, loading, error, postularme, quitar, reactivar, vaciar };
}
