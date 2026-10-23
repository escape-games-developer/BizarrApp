import React from "react";
import { createRoot } from "react-dom/client";
import TvPreviewRoute from "./TvPreviewRoute";

// Raíz de /designer-preview/tv. No registra el Service Worker ni importa
// ninguna otra ruta: ver src/main.jsx.
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <TvPreviewRoute />
  </React.StrictMode>
);
