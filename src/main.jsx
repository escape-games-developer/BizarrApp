import { isClientPreviewPath } from "./preview/previewContract";

// La ruta se decide ANTES de importar cualquier otra cosa. Los imports
// estáticos se evalúan todos al cargar el módulo, y varias rutas arrastran
// src/lib/supabase.js, que crea el cliente con sesión persistente y
// auto-refresh apenas se importa. El preview del Diseñador Cliente vive en un
// iframe del mismo origen que el Admin: si cargara esas rutas, levantaría la
// sesión del admin. Por eso cada rama carga sólo su propio módulo.
if (isClientPreviewPath(window.location.pathname)) {
  // /designer-preview/client: Cliente con datos de prueba, sin efectos.
  import("./preview/clientPreviewMain");
} else {
  // Todas las demás rutas, igual que antes (ver src/appRoutes.jsx).
  import("./appRoutes");

  // Registro del Service Worker — habilita las notificaciones push nativas.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => console.warn("[SW] registro falló:", err));
    });
  }
}
