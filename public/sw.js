// public/sw.js
// Service Worker de BizarrApp — maneja las notificaciones push nativas.
// Se registra desde src/main.jsx en la carga de la webapp cliente.

// Activar el SW nuevo sin esperar a que se cierren las pestañas viejas.
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// Tomar control de las pestañas abiertas apenas se activa.
self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

// Recibir el push y mostrar la notificación.
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Bizarren", {
      body:  data.body || "",
      icon:  "/logo.png",
      badge: "/logo.png",
      tag:   data.tag || "bizarren",
      data:  { url: data.url || "/" },
    })
  );
});

// Rutas que no son la app Cliente: una notificación nunca las reutiliza.
const NO_CLIENTE = ["/admin", "/tv", "/pantalla", "/designer", "/auth"];

// Al tocar la notificación: si la app Cliente ya está abierta, enfocarla y
// pedirle que navegue al destino (App escucha "bizarren-navigate"); si no,
// abrir una pestaña nueva directamente en el destino (deep-link `?view=`).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const app = list.find((c) => {
        const path = new URL(c.url).pathname;
        return !NO_CLIENTE.some((p) => path.startsWith(p));
      });
      if (app && "focus" in app) {
        app.postMessage({ type: "bizarren-navigate", url: targetUrl });
        return app.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
