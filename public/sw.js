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

// Al tocar la notificación: enfocar una pestaña existente o abrir una nueva.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(targetUrl) && "focus" in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
