import React from "react";
import { createRoot } from "react-dom/client";
import ClientPreviewRoute from "./ClientPreviewRoute";

// Raíz de /designer-preview/client. No registra el Service Worker ni importa
// ninguna otra ruta: ver src/main.jsx.
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ClientPreviewRoute />
  </React.StrictMode>
);
