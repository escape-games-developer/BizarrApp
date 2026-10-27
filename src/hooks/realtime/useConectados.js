import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";

// Misma ventana que el sorteo: sin heartbeat en 2 minutos, ya no cuenta.
export const PRESENCIA_MS = 2 * 60 * 1000;
export const estaActivo = (c) => Date.now() - new Date(c.last_seen).getTime() < PRESENCIA_MS;

const porUltimoVisto = (a, b) => new Date(b.last_seen) - new Date(a.last_seen);

/**
 * useConectados — filas de `connected_users` de la sesión, en vivo (Admin).
 *
 * Una lectura inicial y después Realtime: cada check-in o heartbeat llega
 * como INSERT/UPDATE y se aplica a la lista sin volver a consultar. Un DELETE
 * (raro: las filas quedan como historial de la noche) relee todo.
 *
 * Quién está activo depende del reloj, no de un evento: el que deja de mandar
 * heartbeat no avisa. Por eso `ahora` se renueva cada 10 s y los que usan
 * `estaActivo` se recalculan solos.
 *
 * `filas`: null mientras carga. `recargar`: para el ↻ y después de un rechazo.
 */
export function useConectados(sessionId) {
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState(null);
  const [, setAhora] = useState(0);

  const recargar = useCallback(async () => {
    if (!sessionId) { setFilas(null); return; }
    const { data, error: e } = await supabase
      .from("connected_users")
      .select("user_id,name,avatar_emoji,last_seen")
      .eq("session_id", sessionId);
    if (e) { setError("No pudimos leer los conectados."); return; }
    setError(null);
    setFilas((data || []).sort(porUltimoVisto));
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) { setFilas(null); return; }
    recargar();
    const canal = supabase
      .channel(`conectados-${sessionId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "connected_users", filter: `session_id=eq.${sessionId}` },
        ({ eventType, new: fila }) => {
          if (eventType === "DELETE") { recargar(); return; }
          setFilas((prev) => [fila, ...(prev || []).filter((c) => c.user_id !== fila.user_id)].sort(porUltimoVisto));
        })
      // Al (re)conectarse se relee: lo que pasó con el canal caído no llegó.
      .subscribe((estado) => { if (estado === "SUBSCRIBED") recargar(); });
    return () => { supabase.removeChannel(canal); };
  }, [sessionId, recargar]);

  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  return { filas, error, recargar };
}
