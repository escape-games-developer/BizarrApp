import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabase";

// Intervalo de heartbeat: el cliente actualiza last_seen cada 30s
// Si no hay heartbeat en 2 minutos, se considera desconectado (useConectados)
const HEARTBEAT_INTERVAL = 30_000; // 30 segundos

/**
 * usePresence
 *
 * Maneja la presencia del usuario en la sesión activa.
 * Se usa para:
 *   1. Registrar que el usuario está en el bar (check-in)
 *   2. Mantener el heartbeat para que el sorteo sepa quiénes están
 *   3. El Admin Panel puede ver cuántos usuarios hay conectados (useConectados)
 *
 * Al montar: hace check-in (INSERT en connected_users)
 * Cada 30s:  actualiza last_seen (heartbeat)
 * Al desmontar: no borra la fila (el admin puede ver historial de la noche)
 *
 * `isGuest` entra en la guarda del check-in: el invitado no tiene `geoOk`
 * (nunca se lo persistimos a propósito) y sin esto quedaba fuera de
 * connected_users — invisible en el contador del admin y afuera del sorteo.
 * No afecta al kick: el umbral lo calcula `pantalla__active_count` sobre
 * `pantalla_participants`, donde el invitado ya entra por su propia vía.
 */
export function usePresence(sessionId, user, isGuest = false, sinGeo = false) {
  const [isCheckedIn,   setIsCheckedIn]   = useState(false);
  const heartbeatRef = useRef(null);

  const checkIn = useCallback(async () => {
    // `sinGeo`: Ajustes → General con la ubicación no obligatoria.
    if (!sessionId || !user?.id || (!user?.geoOk && !isGuest && !sinGeo)) return;

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
  }, [sessionId, user, isGuest, sinGeo]);

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

  // El conteo de conectados del Admin vive en useConectados (Realtime): acá
  // cada celular lo consultaba cada 10 s sin usarlo.
  return { isCheckedIn };
}
