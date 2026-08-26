import React from "react";
import { createRoot } from "react-dom/client";
import BizarrApp       from "./App";
import AdminPanel      from "./admin/BizarrApp AdminPanel Festival";
import PantallaGigante from "./bigscreen/BizarrApp PantallaGigante Festival";
import DesignerView    from "./views/Designer/DesignerView";
import ClientHomePreview from "./views/Designer/preview/ClientHomePreview";
import PantallaTV      from "./tv/PantallaTV";

const path = window.location.pathname;

let Component;
if      (path.startsWith("/designer-preview/client/home")) Component = ClientHomePreview;
else if (path.startsWith("/admin"))    Component = AdminPanel;
// /tv es el motor de reproducción del módulo Pantalla/Escenario. Va antes que
// /pantalla porque es otra pantalla física: la gigante de siempre no se toca.
else if (path.startsWith("/tv"))       Component = PantallaTV;
else if (path.startsWith("/pantalla")) Component = PantallaGigante;
else if (path.startsWith("/designer")) Component = DesignerView;
else                                   Component = BizarrApp;

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Component />
  </React.StrictMode>
);

// Registro del Service Worker — habilita las notificaciones push nativas.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => console.warn("[SW] registro falló:", err));
  });
}
