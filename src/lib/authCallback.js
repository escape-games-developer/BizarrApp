import { supabase } from "./supabase";
import { HOME_VIEW } from "./authRedirect";

// ─── Lectura y canje del link que llega por mail ──────────────────────────────
//
// Supabase puede entregar la credencial de tres formas distintas según cómo
// esté configurado el proyecto y la plantilla del mail. Soportamos las tres
// para que el link funcione sin importar la config del dashboard:
//
//   1. Implícito (default)  → #access_token=...&refresh_token=...&type=signup
//   2. PKCE                 → ?code=...
//   3. Plantilla con hash   → ?token_hash=...&type=signup|recovery
//
// Y el caso de error, que también vuelve por el fragmento:
//   #error=access_denied&error_code=otp_expired&error_description=...

/** Junta los parámetros del query string y del fragmento en un solo objeto. */
export function readAuthParams() {
  const search = new URLSearchParams(window.location.search);
  const hash   = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const get    = (k) => search.get(k) ?? hash.get(k);

  return {
    code:         get("code"),
    tokenHash:    get("token_hash"),
    accessToken:  get("access_token"),
    refreshToken: get("refresh_token"),
    type:         get("type"),                      // signup | recovery | invite | magiclink | email_change
    next:         search.get("next") || HOME_VIEW,  // novedades | reset
    errorCode:    get("error_code") || get("error"),
    errorDesc:    get("error_description"),
  };
}

/** ¿Vale la pena intentar canjear algo, o el link llegó pelado? */
export function hasAuthPayload(p) {
  return !!(p.code || p.tokenHash || p.accessToken || p.errorCode);
}

/** ¿El link es de recuperación de contraseña? */
export function isRecovery(p) {
  return p.type === "recovery" || p.next === "reset";
}

/** Borra tokens y códigos de la barra de direcciones sin recargar. */
export function clearAuthParamsFromUrl() {
  const url = new URL(window.location.href);
  ["code","token_hash","type","access_token","refresh_token","expires_in","expires_at",
   "token_type","provider_token","error","error_code","error_description"]
    .forEach((k) => url.searchParams.delete(k));
  url.hash = "";
  window.history.replaceState({}, document.title, url.pathname + url.search);
}

// Los códigos de error de Supabase llegan crudos y en inglés. Los traducimos a
// algo que un cliente del bar pueda entender y, sobre todo, accionar.
function callbackErrorMessage(code, desc) {
  const raw = `${code || ""} ${desc || ""}`;
  if (/otp_expired|expired/i.test(raw))
    return "El link del mail venció. Pedí uno nuevo y usalo dentro de la hora.";
  if (/access_denied/i.test(raw))
    return "Ese link ya se usó o fue cancelado. Pedí uno nuevo.";
  if (/invalid|not found|bad_code|flow_state/i.test(raw))
    return "El link no es válido. Puede que se haya cortado al copiarlo del mail. Pedí uno nuevo.";
  if (/email_not_confirmed/i.test(raw))
    return "Todavía falta confirmar el email. Revisá tu casilla.";
  return desc || "No pudimos validar el link. Pedí uno nuevo.";
}

/**
 * Canjea lo que haya venido en la URL por una sesión activa.
 * @returns {Promise<{ok:boolean, session?:object, user?:object, error?:string}>}
 */
export async function consumeAuthCallback(params) {
  if (params.errorCode)
    return { ok: false, error: callbackErrorMessage(params.errorCode, params.errorDesc) };

  try {
    // 1. Flujo implícito: los tokens vienen listos en el fragmento.
    if (params.accessToken && params.refreshToken) {
      const { data, error } = await supabase.auth.setSession({
        access_token:  params.accessToken,
        refresh_token: params.refreshToken,
      });
      if (error) return { ok: false, error: callbackErrorMessage(error.code, error.message) };
      return { ok: true, session: data.session, user: data.user ?? data.session?.user };
    }

    // 2. Plantilla con token_hash (la más robusta: no viaja el token por la URL).
    if (params.tokenHash) {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: params.tokenHash,
        type:       params.type || (params.next === "reset" ? "recovery" : "signup"),
      });
      if (error) return { ok: false, error: callbackErrorMessage(error.code, error.message) };
      return { ok: true, session: data.session, user: data.user ?? data.session?.user };
    }

    // 3. PKCE.
    if (params.code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
      if (error) return { ok: false, error: callbackErrorMessage(error.code, error.message) };
      return { ok: true, session: data.session, user: data.user ?? data.session?.user };
    }

    // 4. Nada en la URL: puede que el SDK ya la haya consumido en otra pestaña,
    //    o que el cliente haya entrado a /auth/callback a mano.
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return { ok: true, session, user: session.user };

    return { ok: false, error: "El link no traía datos de validación. Pedí uno nuevo desde la app." };
  } catch (e) {
    return { ok: false, error: e?.message || "No pudimos validar el link." };
  }
}
