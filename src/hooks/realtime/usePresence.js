import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabase";

// Intervalo de heartbeat: el cliente actualiza last_seen cada 30s
// Si no hay heartbeat en 2 minutos, se considera desconectado
const HEARTBEAT_INTERVAL = 30_000; // 30 segundos
const INACTIVE_THRESHOLD = 120;    // 2 minutos en segundos

/**
 * usePresence
 *
 * Maneja la presencia del usuario en la sesión activa.
 * Se usa para:
 *   1. Registrar que el usuario está en el bar (check-in)
 *   2. Mantener el heartbeat para que el sorteo sepa quiénes están
 *   3. El Admin Panel puede ver cuántos usuarios hay conectados
 *
 * Al montar: hace check-in (INSERT en connected_users)
 * Cada 30s:  actualiza last_seen (heartbeat)
 * Al desmontar: no borra la fila (el admin puede ver historial de la noche)
 */
export function usePresence(sessionId, user) {
  const [isCheckedIn,   setIsCheckedIn]   = useState(false);
  const [connectedCount, setConnectedCount] = useState(0);
  const heartbeatRef = useRef(null);

  const checkIn = useCallback(async () => {
    if (!sessionId || !user?.id || !user?.geoOk) return;

    const { error } = await supabase
      .from("connected_users")
      .upsert(
        {
          session_id:   sessionId,
          user_id:      user.id,
          name:         user.name,
          team:         user.team         || null,
          avatar_id:    user.avatarId     || null,
          avatar_emoji: user.avatarEmoji  || null,
          photo_url:    user.photoUrl     || null,
          last_seen:    new Date().toISOString(),
        },
        { onConflict: "session_id,user_id" }  // update si ya existe
      );

    if (!error) setIsCheckedIn(true);
    else console.error("[usePresence] Check-in error:", error);
  }, [sessionId, user]);

  const heartbeat = useCallback(async () => {
    if (!sessionId || !user?.id) return;
    await supabase
      .from("connected_users")
      .update({ last_seen: new Date().toISOString() })
      .eq("session_id", sessionId)
      .eq("user_id",    user.id);
  }, [sessionId, user?.id]);

  // Check-in al montar
  useEffect(() => {
    checkIn();
  }, [checkIn]);

  // Heartbeat cada 30s
  useEffect(() => {
    if (!isCheckedIn) return;
    heartbeatRef.current = setInterval(heartbeat, HEARTBEAT_INTERVAL);
    return () => clearInterval(heartbeatRef.current);
  }, [isCheckedIn, heartbeat]);

  // Escuchar conteo de usuarios activos (para el admin panel)
  useEffect(() => {
    if (!sessionId) return;

    const fetchCount = async () => {
      const threshold = new Date(Date.now() - INACTIVE_THRESHOLD * 1000).toISOString();
      const { count } = await supabase
        .from("connected_users")
        .select("*", { count: "exact", head: true })
        .eq("session_id", sessionId)
        .gte("last_seen", threshold);
      setConnectedCount(count || 0);
    };

    fetchCount();
    const interval = setInterval(fetchCount, 10_000); // actualizar cada 10s
    return () => clearInterval(interval);
  }, [sessionId]);

  return { isCheckedIn, connectedCount };
}
