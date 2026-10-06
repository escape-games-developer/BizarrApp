/**
 * Datos del shell del Cliente (logo + navegación inferior): definición única,
 * compartida por App y por la ruta de preview del Diseñador Cliente (que no
 * monta App).
 *
 * Datos puros: quién decide `isLoggedIn` e `isRestricted` es quien los usa.
 */

export const CLIENT_LOGO_URL = "/logo.png";

/** Botón de la navegación que corresponde a cada sección diseñable (CLIENT_DESIGN_SECTIONS). */
export const NAV_ID_BY_DESIGN_SECTION = Object.freeze({
  novedades: "novedades", menu: "menu", pantalla: "pantalla",
  juegos: "games", escenario: "escenario", profile: "profile",
});

/** Vistas que se bloquean sin ubicación verificada (gate de geo). */
export const RESTRICTED_VIEWS = ["games", "escenario", "pantalla"];

/** Ítems de la navegación, en orden, listos para ClientShell. */
export function clientNavItems({ isLoggedIn, isRestricted }) {
  return [
    { id: "novedades", icon: "📣", label: "Bienvenidos", image: "/botones/Noti.png"     },
    { id: "menu",      icon: "🍹", label: "Menú",        image: "/botones/Menu.png"     },
    { id: "pantalla",  icon: "📺", label: "Pantalla",    image: "/botones/Pantalla.png" },
    { id: "games",     icon: "🎮", label: "Juegos",      image: "/botones/Juegos.png"   },
    { id: "escenario", icon: "🎤", label: "Escenario",   image: "/botones/Escenario.png" },
    { id: "profile",   icon: "👤", label: isLoggedIn ? "Perfil" : "Registro", image: "/botones/Perfil.png" },
  ].map(n => ({ ...n, locked: isRestricted && RESTRICTED_VIEWS.includes(n.id) }));
}
