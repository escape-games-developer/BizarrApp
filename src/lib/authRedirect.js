// ─── Enrutamiento de los mails de Supabase Auth ───────────────────────────────
//
// Los dos mails que Supabase le manda al cliente (confirmar cuenta y recuperar
// contraseña) vuelven SIEMPRE a esta ruta. El parámetro `next` decide qué hace
// la app cuando el cliente aterriza:
//
//   next=novedades → confirma la cuenta y entra al menú Noti (vista Novedades)
//   next=reset     → muestra el formulario de contraseña nueva
//
// Estas URLs tienen que estar cargadas en Supabase → Authentication → URL
// Configuration → Redirect URLs. Ver supabase/AUTH_SETUP.md.

export const AUTH_CALLBACK_PATH = "/auth/callback";

/** Vista del menú a la que vuelve el cliente después de confirmar: Noti. */
export const HOME_VIEW = "novedades";

/** Origen de la app. En el bar puede ser el dominio de Vercel o localhost. */
export function appOrigin() {
  return window.location.origin;
}

/**
 * URL absoluta que se manda como `emailRedirectTo` / `redirectTo`.
 * @param {"novedades"|"reset"} next  qué hace la app al volver del mail
 */
export function authCallbackUrl(next = HOME_VIEW) {
  return `${appOrigin()}${AUTH_CALLBACK_PATH}?next=${encodeURIComponent(next)}`;
}

/**
 * URL de la WebApp abierta en un menú concreto. Después de confirmar la cuenta
 * el cliente cae acá, en Noti, con el cartel de "cuenta confirmada".
 */
export function appViewUrl(view = HOME_VIEW, extra = {}) {
  const qs = new URLSearchParams({ view, ...extra });
  return `${appOrigin()}/?${qs.toString()}`;
}
