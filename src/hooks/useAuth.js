import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { authCallbackUrl, HOME_VIEW } from "../lib/authRedirect";

const SESSION_KEY = "bizarrapp_session";

// Perfil a medio registrar: se guarda cuando Supabase exige confirmar el email
// y todavía no hay sesión para escribir en `profiles`. Se reconcilia cuando el
// cliente vuelve del link del mail. Ver src/views/Auth/AuthCallbackView.jsx.
const PENDING_KEY = "bizarrapp_pending_profile";

const ALREADY_REGISTERED_RE = /already registered|already exists|user_already_exists/i;
const NOT_CONFIRMED_RE      = /email not confirmed|email_not_confirmed/i;

// Supabase Auth devuelve los errores en inglés y crudos. Los pasamos a algo
// que un cliente del bar pueda entender y accionar.
function authErrorMessage(error) {
  const msg = error?.message || "";
  if (ALREADY_REGISTERED_RE.test(msg))
    return "Ese email ya tiene una cuenta. Entrá con tu contraseña desde \"Iniciar sesión\".";
  if (NOT_CONFIRMED_RE.test(msg))
    return "Todavía no confirmaste tu email. Buscá el mail de BizarrApp y tocá el link.";
  if (/password.*(6|short|weak)/i.test(msg))
    return "La contraseña tiene que tener al menos 6 caracteres.";
  if (/invalid.*email|email.*invalid/i.test(msg))
    return "Revisá el email, no parece válido.";
  if (/rate limit|too many|for security purposes/i.test(msg))
    return "Demasiados intentos seguidos. Esperá unos segundos y probá de nuevo.";
  if (/signups? not allowed|signup is disabled/i.test(msg))
    return "El registro está deshabilitado en el servidor. Avisale al staff.";
  if (/same.*password|should be different/i.test(msg))
    return "La contraseña nueva tiene que ser distinta a la anterior.";
  if (/fetch|network|failed to fetch/i.test(msg))
    return "Sin conexión con el servidor. Revisá tu internet y probá de nuevo.";
  return msg || "No se pudo completar la operación. Probá de nuevo.";
}

// ─── Perfil pendiente de confirmación (localStorage) ──────────────────────────

export function savePendingProfile(profile) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(profile)); } catch { /* cuota llena */ }
}
export function readPendingProfile() {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || "null"); } catch { return null; }
}
export function clearPendingProfile() {
  try { localStorage.removeItem(PENDING_KEY); } catch { /* noop */ }
}

// ─── Mapeos perfil ⇄ fila de `profiles` ───────────────────────────────────────

/**
 * Datos que viajan en `raw_user_meta_data` del signUp. El trigger
 * `handle_new_user` los usa para crear la fila de `profiles` aunque el cliente
 * confirme el mail desde otro dispositivo.
 *
 * Estas cinco claves son exactamente las que lee el trigger: no agregar acá
 * nada que el trigger no consuma. `registered` y `geo_ok` los decide el
 * servidor a propósito — el primero lo sube el trigger de confirmación del
 * mail, el segundo se revalida físicamente en el bar con el GPS.
 *
 * photo_url queda afuera también: es un data-URI en base64 y la metadata del
 * usuario se embebe en el JWT de cada request. Se reconcilia desde el
 * localStorage del celular con el que se registró.
 */
export function profileToMetadata(profile) {
  return {
    name:         profile.name || "",
    team:         profile.team || "",
    phone:        profile.phone || "",
    avatar_id:    profile.avatarId || "",
    avatar_emoji: profile.avatarEmoji || "",
  };
}

export function rowToProfile(row, authUser) {
  return {
    id:          authUser?.id ?? row.id,
    email:       authUser?.email ?? null,
    name:        row.name,
    team:        row.team,
    phone:       row.phone,
    avatarId:    row.avatar_id,
    avatarEmoji: row.avatar_emoji,
    photoUrl:    row.photo_url,
    geoOk:       row.geo_ok,
    registered:  row.registered,
  };
}

export function profileToRow(profile, userId) {
  return {
    id:           userId,
    name:         profile.name,
    team:         profile.team        || null,
    avatar_id:    profile.avatarId    || null,
    avatar_emoji: profile.avatarEmoji || null,
    photo_url:    profile.photoUrl    || null,
    phone:        profile.phone       || null,
    geo_ok:       profile.geoOk       || false,
    registered:   true,
  };
}

export function persistSession(profile) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
}

/**
 * Trae la fila de `profiles` del usuario logueado y, si quedó un perfil
 * pendiente en este dispositivo (registro con confirmación de email), completa
 * lo que el trigger no pudo traer — típicamente la foto.
 *
 * Se exporta porque el callback del mail la usa apenas canjea la sesión.
 */
export async function hydrateProfile(authUser) {
  const { data: row } = await supabase
    .from("profiles").select("*").eq("id", authUser.id).maybeSingle();

  const pending = readPendingProfile();
  const pendingIsMine =
    !!pending && (!pending.email || pending.email.toLowerCase() === (authUser.email || "").toLowerCase());

  // Sin fila: el trigger no corrió (proyecto sin la migración aplicada). La
  // creamos con lo que tengamos a mano en vez de dejar la cuenta inservible.
  if (!row) {
    if (!pendingIsMine) return null;
    const { error } = await supabase.from("profiles").upsert(profileToRow(pending, authUser.id));
    if (error) {
      console.error("[useAuth] No se pudo crear el perfil tras confirmar:", error);
      return null;
    }
    clearPendingProfile();
    const profile = { ...pending, id: authUser.id, email: authUser.email, registered: true };
    persistSession(profile);
    return profile;
  }

  // Reconciliación de lo que el trigger no pudo dejar listo.
  const patch = {};

  // `registered` es lo que la app usa como "tiene cuenta" (isLoggedIn). El
  // trigger crea el perfil en false y lo sube a true recién cuando confirma el
  // mail. Si el mail ya está confirmado y la fila todavía dice false — porque
  // la leímos antes de que el trigger commitee, o porque el proyecto no tiene
  // la migración aplicada — lo subimos desde acá. Sin esto el cliente confirma
  // el mail y vuelve a caer en la pantalla de login, en loop.
  const emailConfirmed = !!(authUser.email_confirmed_at || authUser.confirmed_at);
  if (emailConfirmed && row.registered !== true) patch.registered = true;

  // La foto quedó en este celular: el data-URI no viaja en la metadata.
  if (pendingIsMine && pending.photoUrl && !row.photo_url) patch.photo_url = pending.photoUrl;

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from("profiles").update(patch).eq("id", authUser.id);
    if (error) console.error("[useAuth] No se pudo reconciliar el perfil:", error);
    else Object.assign(row, patch);
  }

  if (pendingIsMine) clearPendingProfile();

  const profile = rowToProfile(row, authUser);
  persistSession(profile);
  return profile;
}

export function useAuth() {
  const [user,    setUser]    = useState(() => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
    catch { return null; }
  });
  const [regStep, setRegStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // ── Restaurar sesión al recargar ────────────────────────────────────────────
  useEffect(() => {
    const restoreSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // No hay sesión activa en Supabase → limpiar localStorage
        localStorage.removeItem(SESSION_KEY);
        setUser(null);
        setRegStep(1);
        return;
      }

      const profile = await hydrateProfile(session.user);

      if (profile) {
        setUser(profile);
        setRegStep(profile.registered ? 5 : 1);
      } else {
        // Sesión válida pero sin perfil ni datos para reconstruirlo.
        // No tiramos error: limpiamos sesión y tratamos al user como deslogueado.
        console.warn("[useAuth] Sesión sin perfil asociado — limpiando sesión");
        localStorage.removeItem(SESSION_KEY);
        setUser(null);
        setRegStep(1);
      }
    };

    restoreSession();

    // Escuchar cambios de sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (event === "SIGNED_OUT") {
          localStorage.removeItem(SESSION_KEY);
          setUser(null);
          setRegStep(1);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // ── Registro ────────────────────────────────────────────────────────────────
  const register = useCallback(async (profile, password) => {
    setLoading(true);
    try {
      const email = profile.email.toLowerCase().trim();

      // 1. Crear usuario en Supabase Auth.
      //    - emailRedirectTo: adónde vuelve el link del mail de confirmación.
      //    - data: el perfil viaja en la metadata para que el trigger
      //      `handle_new_user` cree la fila de `profiles` del lado del server,
      //      aunque el cliente confirme desde otro dispositivo.
      let { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: authCallbackUrl(HOME_VIEW),
          data:            profileToMetadata(profile),
        },
      });

      // El email ya existe en Auth. Puede ser el mismo cliente reintentando
      // porque el guardado del perfil falló la vez anterior: probamos login con
      // la contraseña que acaba de tipear. Si coincide, seguimos el registro
      // normalmente; si no, es otra persona y avisamos.
      if (error && ALREADY_REGISTERED_RE.test(error.message)) {
        const retry = await supabase.auth.signInWithPassword({ email, password });
        if (retry.error) {
          // Credenciales correctas pero falta confirmar: no es "email ocupado".
          if (NOT_CONFIRMED_RE.test(retry.error.message)) {
            savePendingProfile({ ...profile, email });
            return { ok: true, pendingConfirmation: true, email, error: null };
          }
          return { ok: false, error: authErrorMessage(error) };
        }
        data  = retry.data;
        error = null;
      }

      if (error) return { ok: false, error: authErrorMessage(error) };

      const userId = data.user?.id;
      if (!userId) return { ok: false, error: "No se pudo crear la cuenta. Probá de nuevo." };

      // Sin sesión = el proyecto exige confirmar el email. No es un error: el
      // perfil ya viajó en la metadata y guardamos una copia local (con foto)
      // para completar la fila cuando vuelva del link.
      if (!data.session) {
        savePendingProfile({ ...profile, email });
        return { ok: true, pendingConfirmation: true, email, error: null };
      }

      // 2. Upsert perfil en tabla profiles (id = userId, no user_id)
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(profileToRow(profile, userId));

      // Sin fila en profiles el usuario queda inservible: restoreSession lo
      // desloguea en la próxima recarga. Es un fallo de registro, no un aviso.
      if (profileError) {
        console.error("[useAuth] Error guardando perfil:", profileError);
        return {
          ok: false,
          error: `No pudimos guardar tu perfil (${profileError.message}). Tocá "Crear mi cuenta" de nuevo.`,
        };
      }

      // 3. Guardar sesión local
      const fullProfile = { ...profile, id: userId, registered: true };
      clearPendingProfile();
      persistSession(fullProfile);
      setUser(fullProfile);
      setRegStep(5);

      return { ok: true, pendingConfirmation: false, user: fullProfile, error: null };
    } catch (e) {
      return { ok: false, error: e.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Reenviar el mail de confirmación ────────────────────────────────────────
  const resendConfirmation = useCallback(async (email) => {
    const { error } = await supabase.auth.resend({
      type:    "signup",
      email:   email.toLowerCase().trim(),
      options: { emailRedirectTo: authCallbackUrl(HOME_VIEW) },
    });
    if (error) return { ok: false, error: authErrorMessage(error) };
    return { ok: true };
  }, []);

  // ── Olvidé mi contraseña: dispara el mail de recuperación ───────────────────
  const requestPasswordReset = useCallback(async (email) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.toLowerCase().trim(),
        { redirectTo: authCallbackUrl("reset") },
      );
      // Supabase responde ok aunque el email no exista (evita que alguien
      // averigüe qué emails están registrados). El mensaje al cliente es el
      // mismo en los dos casos, a propósito.
      if (error) return { ok: false, error: authErrorMessage(error) };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fijar contraseña nueva (requiere sesión: la del link de recuperación) ────
  const updatePassword = useCallback(async (newPassword) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session)
        return { ok: false, error: "El link venció. Pedí uno nuevo desde \"Olvidé mi contraseña\"." };

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { ok: false, error: authErrorMessage(error) };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Cambiar contraseña desde el perfil (verifica la actual) ─────────────────
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email)
        return { ok: false, error: "Tu sesión venció. Volvé a iniciar sesión." };

      // Reautenticamos antes de cambiarla: si el celular quedó abierto en la
      // mesa, un tercero no puede secuestrar la cuenta sin saber la actual.
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email:    session.user.email,
        password: currentPassword,
      });
      if (reauthError) return { ok: false, error: "La contraseña actual no es correcta." };

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { ok: false, error: authErrorMessage(error) };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Login ───────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error) {
        // Un fallo de red no es una credencial mala: no lo disfracemos.
        if (/fetch|network/i.test(error.message))
          return { ok: false, error: "Sin conexión con el servidor. Revisá tu internet." };
        // Falta confirmar el email: es accionable, no es "contraseña mala".
        if (NOT_CONFIRMED_RE.test(error.message))
          return { ok: false, needsConfirmation: true, error: authErrorMessage(error) };
        return { ok: false, error: "Email o contraseña incorrectos." };
      }

      const profile = await hydrateProfile(data.user);
      const fullProfile = profile ?? {
        id:         data.user.id,
        email:      email.toLowerCase().trim(),
        registered: false,
      };

      persistSession(fullProfile);
      setUser(fullProfile);
      setRegStep(fullProfile.registered ? 5 : 1);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Actualizar perfil ───────────────────────────────────────────────────────
  const updateUser = useCallback(async (updates) => {
    setUser((prev) => {
      const next = { ...prev, ...updates };
      persistSession(next);
      return next;
    });

    if (user?.id) {
      const dbUpdates = {};
      if (updates.name         !== undefined) dbUpdates.name         = updates.name;
      if (updates.team         !== undefined) dbUpdates.team         = updates.team;
      if (updates.avatarId     !== undefined) dbUpdates.avatar_id    = updates.avatarId;
      if (updates.avatarEmoji  !== undefined) dbUpdates.avatar_emoji = updates.avatarEmoji;
      if (updates.photoUrl     !== undefined) dbUpdates.photo_url    = updates.photoUrl;
      if (updates.phone        !== undefined) dbUpdates.phone        = updates.phone;
      if (updates.geoOk        !== undefined) dbUpdates.geo_ok       = updates.geoOk;
      if (updates.registered   !== undefined) dbUpdates.registered   = updates.registered;

      if (Object.keys(dbUpdates).length > 0) {
        // Clave es id, no user_id
        await supabase.from("profiles").update(dbUpdates).eq("id", user.id);
      }
    }
  }, [user?.id]);

  // ── Logout ──────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    localStorage.removeItem(SESSION_KEY);
    clearPendingProfile();
    setUser(null);
    setRegStep(1);
  }, []);

  return {
    user,
    regStep,
    setRegStep,
    register,
    login,
    updateUser,
    logout,
    resendConfirmation,
    requestPasswordReset,
    updatePassword,
    changePassword,
    loading,
    isLoggedIn: !!user?.registered,
  };
}
