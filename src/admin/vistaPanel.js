/**
 * Con qué perfil se ve el panel (/admin).
 *
 * Cada cuenta entra con el suyo (`admin_users.role`). El Administrador general
 * además elige en el login cómo ingresar — Administrador, Producción o
 * Anfitrión — para revisar cada panel sin crear otra cuenta, y lo cambia
 * después desde el encabezado. Lo elegido queda en este navegador.
 *
 * Mirar como otro perfil sólo cambia lo que se muestra: el backend autoriza
 * igual que siempre (`is_admin()`).
 */

export const VISTAS = [
  { id: "admin",      label: "Administrador", icono: "🛡️" },
  { id: "produccion", label: "Producción",    icono: "🎛️" },
  { id: "anfitrion",  label: "Anfitrión",     icono: "🎮" },
];

const CLAVE = "bizarr_admin_vista";
const valida = (v) => VISTAS.some((x) => x.id === v);

export function leerVistaElegida() {
  try {
    const v = localStorage.getItem(CLAVE);
    return valida(v) ? v : "admin";
  } catch { return "admin"; }
}

export function guardarVistaElegida(v) {
  if (!valida(v)) return;
  try { localStorage.setItem(CLAVE, v); } catch { /* sin storage: vale para esta sesión */ }
}

/** La vista con que se dibuja el panel: la elegida si es administrador, si no la de su perfil. */
export function vistaEfectiva(acceso, elegida) {
  if (!acceso) return null;
  return acceso.rol === "admin" ? (valida(elegida) ? elegida : "admin") : acceso.rol;
}
