import React, { useState } from "react";
import { usePushSubscription } from "../hooks/realtime/usePushSubscription";

const DISMISS_KEY = "push_dismissed";
const DISMISS_MS  = 24 * 60 * 60 * 1000; // 24 horas

// ¿El usuario dijo "Ahora no" hace menos de 24hs?
function recentlyDismissed() {
  try {
    const ts = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return ts && (Date.now() - ts) < DISMISS_MS;
  } catch {
    return false;
  }
}

/**
 * PushPermissionBanner
 * Barra flotante que invita a activar las notificaciones push.
 * Se muestra sólo si el navegador las soporta, el permiso está en "default"
 * y el usuario no está suscripto ni la descartó en las últimas 24hs.
 */
export function PushPermissionBanner({ user }) {
  const { supported, permission, isSubscribed, subscribe } = usePushSubscription(user?.id);
  const [dismissed, setDismissed] = useState(recentlyDismissed());
  const [toast,     setToast]     = useState(false);

  // Sin usuario logueado no tiene sentido mostrar el banner (el insert requiere user_id).
  if (!user?.id) return null;

  const shouldShow = supported && permission === "default" && !isSubscribed && !dismissed;

  const handleActivate = async () => {
    try {
      if (!user?.id) throw new Error("Necesitás iniciar sesión primero");
      await subscribe();
      setToast(true);
      setTimeout(() => setToast(false), 3000);
    } catch (err) {
      console.warn("[PushPermissionBanner] activar falló:", err);
    }
  };

  const handleDismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* noop */ }
    setDismissed(true);
  };

  // Mini-toast de confirmación (aparece incluso cuando el banner ya se ocultó)
  if (toast) {
    return (
      <div style={{
        position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)",
        zIndex: 9999, background: "#00F5A0", color: "#0a0a0a",
        padding: "10px 18px", borderRadius: 999, fontWeight: 800, fontSize: 13,
        fontFamily: "'Space Grotesk', sans-serif", boxShadow: "0 8px 24px rgba(0,245,160,.4)",
        whiteSpace: "nowrap",
      }}>
        ✔ Notificaciones activadas
      </div>
    );
  }

  if (!shouldShow) return null;

  return (
    <div style={{
      position: "fixed", bottom: 84, left: "50%", transform: "translateX(-50%)",
      zIndex: 9998, width: "calc(100% - 24px)", maxWidth: 420,
      background: "#ff2d95", color: "#fff",
      padding: "14px 16px", borderRadius: 16,
      boxShadow: "0 10px 30px rgba(255,45,149,.45)",
      display: "flex", alignItems: "center", gap: 12,
      fontFamily: "'Space Grotesk', sans-serif",
    }}>
      <div style={{ flex: 1, lineHeight: 1.3 }}>
        <div style={{ fontWeight: 800, fontSize: 14 }}>¿Te avisamos qué pasa en el bar?</div>
        <div style={{ fontSize: 11.5, opacity: 0.9, marginTop: 2 }}>
          Activá las notificaciones y no te pierdas los juegos ni los sorteos.
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
        <button onClick={handleActivate} style={{
          background: "#fff", color: "#ff2d95", border: "none",
          padding: "8px 14px", borderRadius: 999, fontWeight: 800, fontSize: 12.5,
          cursor: "pointer", whiteSpace: "nowrap",
        }}>
          🔔 Activar
        </button>
        <button onClick={handleDismiss} style={{
          background: "transparent", color: "rgba(255,255,255,.85)",
          border: "1px solid rgba(255,255,255,.4)",
          padding: "6px 14px", borderRadius: 999, fontWeight: 600, fontSize: 11.5,
          cursor: "pointer", whiteSpace: "nowrap",
        }}>
          Ahora no
        </button>
      </div>
    </div>
  );
}

export default PushPermissionBanner;
