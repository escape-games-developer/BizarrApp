import { supabase } from "../lib/supabase";
import { authCallbackUrl } from "../lib/authRedirect";

/**
 * Usuarios del sistema (administradores del panel) — lectura y las únicas
 * operaciones que la infraestructura actual permite hacer de forma segura.
 *
 * Modelo REAL (auditado contra la base, 2026-10):
 * - `public.admin_users (user_id uuid PK → auth.users, created_at)`. No hay
 *   columna de rol: ser admin = tener fila acá (`is_admin()`).
 * - RLS de `admin_users`: SELECT sólo de la PROPIA fila (`auth.uid() = user_id`);
 *   sin INSERT/UPDATE/DELETE. Por eso hoy cada admin se ve sólo a sí mismo.
 * - Nombre: `profiles.name` (NOT NULL). Un admin lee todos los perfiles, pero
 *   sólo puede actualizar el suyo.
 * - Email: sólo en `auth.users`. Desde el navegador se conoce el propio (sesión);
 *   el de otro usuario requiere backend (Edge Function con service role).
 * - Contraseña: sin Edge Function/RPC de administración. Lo único seguro es el
 *   mail de recuperación de Supabase (`resetPasswordForEmail`), el mismo que usa
 *   «Olvidé mi contraseña».
 *
 * Nunca se maneja `service_role` ni se escriben contraseñas.
 */

/** Rol a mostrar: el único que existe hoy es «estar en admin_users». */
export const ROL_ADMIN = "Administrador";

export const NOMBRE_MAX = 24;   // mismo límite que el registro del Cliente

export function motivoNombreInvalido(texto) {
  const t = String(texto ?? "").trim();
  if (!t) return "El nombre es obligatorio.";
  if (t.length > NOMBRE_MAX) return `Máximo ${NOMBRE_MAX} caracteres.`;
  return null;
}

/**
 * Lista los usuarios del sistema que la base deja ver.
 * Devuelve `[{ id, nombre, email, rol, esYo, creado }]`; `email` es null cuando
 * no se puede conocer desde el navegador (cualquier usuario que no sea uno).
 */
export async function listarUsuariosSistema() {
  const { data: { user }, error: eUser } = await supabase.auth.getUser();
  if (eUser || !user) throw new Error("Tu sesión venció. Volvé a entrar al Admin.");

  const { data: admins, error: eAdmins } = await supabase
    .from("admin_users")
    .select("user_id, created_at")
    .order("created_at", { ascending: true });
  if (eAdmins) throw new Error("No se pudo cargar la lista de usuarios del sistema.");

  const ids = (admins || []).map((a) => a.user_id);
  let nombres = new Map();
  if (ids.length) {
    const { data: perfiles, error: ePerf } = await supabase
      .from("profiles").select("id, name").in("id", ids);
    if (ePerf) throw new Error("No se pudieron cargar los nombres de los usuarios.");
    nombres = new Map((perfiles || []).map((p) => [p.id, p.name]));
  }

  return (admins || []).map((a) => ({
    id: a.user_id,
    nombre: nombres.get(a.user_id) ?? null,
    email: a.user_id === user.id ? user.email ?? null : null,
    rol: ROL_ADMIN,
    esYo: a.user_id === user.id,
    creado: a.created_at,
  }));
}

/**
 * Cambia `profiles.name`. RLS sólo deja actualizar el perfil propio: si la
 * actualización no afecta filas, no se guardó (nunca se informa éxito sin fila).
 */
export async function actualizarNombre(id, nombre) {
  const motivo = motivoNombreInvalido(nombre);
  if (motivo) throw new Error(motivo);
  const { data, error } = await supabase
    .from("profiles")
    .update({ name: nombre.trim() })
    .eq("id", id)
    .select("id, name");
  if (error) throw new Error(error.code === "42501"
    ? "No tenés permisos para cambiar este nombre."
    : "No se pudo guardar el nombre.");
  if (!data?.length) throw new Error("No se guardó: sólo podés cambiar el nombre de tu propio usuario.");
  return data[0];
}

/**
 * Manda el mail de recuperación de contraseña de Supabase. No toca la
 * contraseña: el usuario la elige desde el link (/auth/callback?next=reset).
 */
export async function enviarMailRecuperacion(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(
    String(email).toLowerCase().trim(),
    { redirectTo: authCallbackUrl("reset") },
  );
  if (error) {
    const msg = String(error.message || "").toLowerCase();
    if (error.status === 429 || msg.includes("rate limit") || msg.includes("security purposes")) {
      throw new Error("Se pidieron demasiados mails seguidos. Esperá unos minutos y probá de nuevo.");
    }
    throw new Error("No se pudo enviar el mail de recuperación.");
  }
}
