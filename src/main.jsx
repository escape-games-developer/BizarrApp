import { isClientPreviewPath } from "./preview/previewContract";
import { isTvPreviewPath } from "./preview/tvPreviewContract";

// La ruta se decide ANTES de importar cualquier otra cosa. Los imports
// estáticos se evalúan todos al cargar el módulo, y varias rutas arrastran
// src/lib/supabase.js, que crea el cliente con sesión persistente y
// auto-refresh apenas se importa. El preview del Diseñador Cliente vive en un
// iframe del mismo origen que el Admin: si cargara esas rutas, levantaría la
// sesión del admin. Por eso cada rama carga sólo su propio módulo.
if (isClientPreviewPath(window.location.pathname)) {
  // /designer-preview/client: Cliente con datos de prueba, sin efectos.
  import("./preview/clientPreviewMain");
} else if (isTvPreviewPath(window.location.pathname)) {
  // /designer-preview/tv: pantallas de los juegos con datos de ejemplo. En
  // /designer-preview/* src/lib/supabase.js arranca sin sesión, así que esta
  // ruta puede leer lo público sin tocar la sesión del Admin.
  import("./preview/tvPreviewMain");
} else {
  // Todas las demás rutas, igual que antes (ver src/appRoutes.jsx).
  import("./appRoutes");

  // El aviso de instalación puede llegar antes de que App monte ModoApp
  // (mientras carga el estado): se guarda acá y ModoApp lo toma al montar.
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    window.__bizarrAvisoInstalar = e;
    window.dispatchEvent(new Event("bizarr-instalable"));
  });

  // Registro del Service Worker — habilita las notificaciones push nativas.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => console.warn("[SW] registro falló:", err));
    });
  }
}
