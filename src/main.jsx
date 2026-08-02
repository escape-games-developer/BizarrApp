import React from "react";
import { createRoot } from "react-dom/client";
import BizarrApp       from "./App";
import AdminPanel      from "./admin/BizarrApp AdminPanel Festival";
import PantallaGigante from "./bigscreen/BizarrApp PantallaGigante Festival";

const path = window.location.pathname;

let Component;
if      (path.startsWith("/admin"))    Component = AdminPanel;
else if (path.startsWith("/pantalla")) Component = PantallaGigante;
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