import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";

// Convierte la VAPID public key (base64url) al Uint8Array que espera
// pushManager.subscribe({ applicationServerKey }).
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = atob(base64);
  const output  = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

/**
 * usePushSubscription
 *
 * Maneja la suscripción del navegador a las notificaciones push nativas.
 * Guarda / borra la suscripción en la tabla push_subscriptions.
 *
 * @param {string|null} userId  id del usuario autenticado (auth.users.id)
 * @returns { supported, permission, isSubscribed, loading, error, subscribe, unsubscribe }
 */
export function usePushSubscription(userId) {
  const supported = typeof navigator !== "undefined" &&
    "serviceWorker" in navigator && "PushManager" in window;

  const [permission,   setPermission]   = useState(
    supported && "Notification" in window ? Notification.permission : "denied"
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);

  // ── Detectar si ya hay una suscripción activa y registrada en la DB ──────────
  const refresh = useCallback(async () => {
    if (!supported) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) { setIsSubscribed(false); return; }

      // Confirmar que el endpoint existe en push_subscriptions
      const { data } = await supabase
        .from("push_subscriptions")
        .select("endpoint")
        .eq("endpoint", sub.endpoint)
        .maybeSingle();
      setIsSubscribed(!!data);
    } catch (err) {
      console.warn("[usePushSubscription] refresh:", err);
      setIsSubscribed(false);
    }
  }, [supported]);

  useEffect(() => { refresh(); }, [refresh, userId]);

  // ── Suscribirse ──────────────────────────────────────────────────────────────
  const subscribe = useCallback(async () => {
    if (!supported) throw new Error("Este navegador no soporta notificaciones push");
    if (!VAPID_PUBLIC_KEY) throw new Error("Falta VITE_VAPID_PUBLIC_KEY");
    // Guard antes de pedir permiso: no gastar el prompt si el insert va a fallar.
    if (!userId) throw new Error("userId requerido para suscribirse");
    setLoading(true);
    setError(null);
    try {
      // 1. Pedir permiso
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") throw new Error("Permiso de notificaciones no concedido");

      // 2. SW listo
      const reg = await navigator.serviceWorker.ready;

      // 3. Suscribir en el navegador
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // 4. Extraer claves
      const json = sub.toJSON();
      const endpoint = json.endpoint;
      const p256dh   = json.keys?.p256dh;
      const auth     = json.keys?.auth;

      // 5. Persistir en la DB (upsert por endpoint)
      const { error: dbError } = await supabase
        .from("push_subscriptions")
        .upsert(
          {
            user_id:      userId || null,
            endpoint,
            p256dh,
            auth,
            user_agent:   navigator.userAgent,
            last_used_at: new Date().toISOString(),
          },
          { onConflict: "endpoint" }
        );
      if (dbError) throw dbError;

      setIsSubscribed(true);
      return true;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [supported, userId]);

  // ── Desuscribirse ──────────────────────────────────────────────────────────────
  const unsubscribe = useCallback(async () => {
    if (!supported) return;
    setLoading(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
      }
      setIsSubscribed(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [supported]);

  return { supported, permission, isSubscribed, loading, error, subscribe, unsubscribe };
}
