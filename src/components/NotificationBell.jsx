import { useState } from "react";
import { usePushSubscription } from "../hooks/realtime/usePushSubscription";

/**
 * NotificationBell
 * Campana del header. El puntito rojo indica que las notificaciones todavía
 * no están activadas; al tocarla se dispara la suscripción push (la misma
 * que ofrece PushPermissionBanner).
 */
export function NotificationBell({ user, offset = 16 }) {
  const { supported, permission, isSubscribed, loading, subscribe } = usePushSubscription(user?.id);
  const [toast, setToast] = useState(null);

  const showToast = (text, color) => {
    setToast({ text, color });
    setTimeout(() => setToast(null), 3000);
  };

  const pending = supported && !isSubscribed && permission !== "denied";

  const handleClick = async () => {
    if (loading) return;
    if (!supported)        return showToast("Este navegador no soporta notificaciones", "#FF9500");
    if (permission === "denied")
      return showToast("Las notificaciones están bloqueadas en el navegador", "#FF9500");
    if (isSubscribed)      return showToast("Ya tenés las notificaciones activadas", "#00F5A0");
    if (!user?.id)         return showToast("Registrate para activar las notificaciones", "#FF9500");

    try {
      await subscribe();
      showToast("✔ Notificaciones activadas", "#00F5A0");
    } catch (err) {
      console.warn("[NotificationBell] activar falló:", err);
      showToast("No se pudieron activar", "#FF2D78");
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        aria-label={pending ? "Activar notificaciones" : "Notificaciones"}
        style={{
          position: "absolute", right: offset, top: "50%", transform: "translateY(-50%)",
          width: 38, height: 38,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "transparent", border: "none", padding: 0,
          borderRadius: "50%", cursor: "pointer",
          opacity: loading ? .5 : 1,
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <span style={{ fontSize: 22, lineHeight: 1, filter: "drop-shadow(0 0 6px rgba(255,214,0,.45))" }}>
          🔔
        </span>
        {pending && (
          <span aria-hidden="true" style={{
            position: "absolute", top: 3, right: 3,
            width: 9, height: 9, borderRadius: "50%",
            background: "#FF2D78", border: "1.5px solid #0D0700",
            boxShadow: "0 0 6px rgba(255,45,120,.9)",
          }}/>
        )}
      </button>

      {toast && (
        <div style={{
          position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)",
          zIndex: 9999, background: toast.color, color: "#0a0a0a",
          padding: "10px 18px", borderRadius: 999, fontWeight: 800, fontSize: 13,
          fontFamily: "'Space Grotesk', sans-serif", boxShadow: "0 8px 24px rgba(0,0,0,.5)",
          whiteSpace: "nowrap",
        }}>
          {toast.text}
        </div>
      )}
    </>
  );
}

export default NotificationBell;
