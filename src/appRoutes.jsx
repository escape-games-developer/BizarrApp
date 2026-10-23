import React from "react";
import { createRoot } from "react-dom/client";
import BizarrApp       from "./App";
import AdminPanel      from "./admin/BizarrApp AdminPanel Festival";
import PantallaGigante from "./bigscreen/BizarrApp PantallaGigante Festival";
import PantallaTV      from "./tv/PantallaTV";
import AuthCallbackView from "./views/Auth/AuthCallbackView";

// Rutas de la app (todas menos /designer-preview/client y /designer-preview/tv,
// que resuelve main.jsx antes de cargar este módulo).
const path = window.location.pathname;

let Component;
// /auth/callback es la URL que reciben los mails de Supabase (confirmar cuenta
// y recuperar contraseña). Va primero: no debe caer en ninguna otra vista.
if      (path.startsWith("/auth/callback")) Component = AuthCallbackView;
else if (path.startsWith("/admin"))    Component = AdminPanel;
// /tv es el motor de reproducción del módulo Pantalla/Escenario. Va antes que
// /pantalla porque es otra pantalla física: la gigante de siempre no se toca.
else if (path.startsWith("/tv"))       Component = PantallaTV;
// Pantalla Telepronter: espejo mudo de /tv para el participante en escenario.
else if (path.startsWith("/telepronter")) Component = function PantallaTelepronter() {
  return <PantallaTV modo="telepronter" />;
};
else if (path.startsWith("/pantalla")) Component = PantallaGigante;
else                                   Component = BizarrApp;

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Component />
  </React.StrictMode>
);
