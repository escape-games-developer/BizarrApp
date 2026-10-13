import { supabase } from "../lib/supabase";
import { authCallbackUrl } from "../lib/authRedirect";

/**
 * Usuarios del sistema (staff del panel) y Clientes.
 *
 * Perfiles:
 * - Cliente: fila en `profiles`, sin fila en `admin_users`.
 * - Operador: `admin_users.role = 'operator'`; ve sólo `admin_users.sections`.
 * - Administrador: `admin_users.role = 'admin'`; ve todo.
 *
 * Backend: migraciones `20261013150000_admin_roles_y_secciones.sql` y
 * `20261013180000_admin_usuarios_gestion.sql`, y la Edge Function
 * `admin-create-user` (altas con mail de invitación). Los mails
 * viven en `auth.users`, así que los listados salen de RPCs security definer
 * (`admin_list_staff`, `admin_list_clients`) que validan el rol de quien llama.
 * Las secciones filtran el panel; las tablas de cada módulo siguen autorizando
 * con `is_admin()`.
 *
 * Nunca se maneja `service_role` ni se escriben contraseñas.
 */

export const ROLES = { admin: "Administrador", operator: "Operador" };

/** Secciones que nunca se asignan a un operador (podría darse más permisos). */
export const SECCIONES_SOLO_ADMIN = new Set(["usuarios"]);

/** Un usuario es «activo» si se conectó en los últimos DIAS_ACTIVO días. */
export const DIAS_ACTIVO = 30;
export function esActivo(u) {
  return !!u.ultimaConexion && Date.now() - new Date(u.ultimaConexion).getTime() <= DIAS_ACTIVO * 864e5;
}

const MAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function motivoMailInvalido(texto) {
  const t = String(texto ?? "").trim();
  if (!t) return "El mail es obligatorio.";
  if (!MAIL_RE.test(t)) return "Ese mail no es válido.";
  return null;
}

export const NOMBRE_MAX = 24;   // mismo límite que el registro del Cliente

export function motivoNombreInvalido(texto) {
  const t = String(texto ?? "").trim();
  if (!t) return "El nombre es obligatorio.";
  if (t.length > NOMBRE_MAX) return `Máximo ${NOMBRE_MAX} caracteres.`;
  return null;
}

const MIGRACION_FALTANTE = "Falta aplicar en Supabase la migración de roles (20261013150000_admin_roles_y_secciones).";

/** Función RPC inexistente: la migración todavía no está aplicada. */
const faltaRpc = (error) => error?.code === "PGRST202" || error?.code === "42883";

/**
 * Rol y secciones del usuario logueado, para filtrar el panel.
 * Sin la migración aplicada (no existe `role`) todos los usuarios del sistema
 * conservan el acceso completo que tenían: `{ rol: "admin", secciones: [] }`.
 */
export async function leerMiAcceso(uid) {
  const { data, error } = await supabase
    .from("admin_users").select("role, sections").eq("user_id", uid).maybeSingle();
  if (error || !data) return { rol: "admin", secciones: [] };
  return { rol: data.role === "operator" ? "operator" : "admin", secciones: data.sections ?? [] };
}

/** `[{ id, nombre, email, rol, secciones, esYo, creado }]` — sólo para administradores. */
export async function listarUsuariosSistema() {
  const { data: { user }, error: eUser } = await supabase.auth.getUser();
  if (eUser || !user) throw new Error("Tu sesión venció. Volvé a entrar al Admin.");

  const { data, error } = await supabase.rpc("admin_list_staff");
  if (error) {
    if (faltaRpc(error)) throw new Error(MIGRACION_FALTANTE);
    if (error.code === "42501") throw new Error("Sólo un administrador puede ver los usuarios del sistema.");
    throw new Error("No se pudo cargar la lista de usuarios del sistema.");
  }
  return (data || []).map((u) => ({
    id: u.user_id,
    nombre: u.name ?? null,
    email: u.email ?? null,
    rol: u.role,
    secciones: u.sections ?? [],
    esYo: u.user_id === user.id,
    creado: u.created_at,
    emailVerificado: !!u.email_confirmed,
    ultimaConexion: u.last_seen ?? null,
  }));
}

/** `[{ id, nombre, email, team, telefono, creado }]` — admin u operador con «clientes». */
export async function listarClientes() {
  const { data, error } = await supabase.rpc("admin_list_clients");
  if (error) {
    if (faltaRpc(error)) throw new Error(MIGRACION_FALTANTE);
    if (error.code === "42501") throw new Error("No tenés permiso para ver los clientes.");
    throw new Error("No se pudo cargar la lista de clientes.");
  }
  return (data || []).map((c) => ({
    id: c.id,
    nombre: c.name ?? null,
    email: c.email ?? null,
    team: c.team ?? null,
    telefono: c.phone ?? null,
    creado: c.created_at,
    emailVerificado: !!c.email_confirmed,
    ultimaConexion: c.last_seen ?? null,
  }));
}

/** Guarda rol y secciones. Para un administrador las secciones se ignoran. */
export async function guardarAcceso(id, rol, secciones) {
  const { data, error } = await supabase.rpc("admin_set_staff_access", {
    p_user_id: id, p_role: rol, p_sections: rol === "operator" ? secciones : [],
  });
  if (error) {
    if (faltaRpc(error)) throw new Error(MIGRACION_FALTANTE);
    const msg = String(error.message || "");
    if (msg.includes("self_demote")) throw new Error("No podés quitarte a vos mismo el rol de administrador.");
    if (msg.includes("not_staff")) throw new Error("Ese usuario ya no es usuario del sistema.");
    if (msg.includes("forbidden_section") || msg.includes("invalid_section")) throw new Error("Hay una sección que no se puede asignar.");
    if (error.code === "42501") throw new Error("Sólo un administrador puede cambiar permisos.");
    throw new Error("No se pudieron guardar los permisos.");
  }
  const fila = Array.isArray(data) ? data[0] : data;
  if (!fila) throw new Error("No se guardaron los permisos.");
  return { rol: fila.role, secciones: fila.sections ?? [] };
}

const ERRORES_ALTA = {
  forbidden: "No tenés permiso para crear este tipo de usuario.",
  invalid_email: "Ese mail no es válido.",
  invalid_name: `El nombre es obligatorio (máximo ${NOMBRE_MAX} caracteres).`,
  invalid_section: "Hay una sección que no se puede asignar.",
  email_exists: "Ya existe una cuenta con ese mail.",
  already_staff: "Ese mail ya es un usuario del sistema.",
  rate_limit: "Se mandaron demasiados mails seguidos. Esperá unos minutos y probá de nuevo.",
};

/**
 * Da de alta un usuario y le manda el mail de invitación para validarse.
 * `tipo`: "cliente" | "operator" | "admin". Devuelve `{ id, existente, invitado }`:
 * `existente` = la cuenta ya existía y sólo se le dio el rol (sin mail).
 */
export async function crearUsuario({ tipo, email, nombre, team = null, telefono = null, secciones = [] }) {
  const { data, error } = await supabase.functions.invoke("admin-create-user", {
    body: {
      tipo, email: String(email).trim().toLowerCase(), nombre: String(nombre).trim(),
      team, telefono, secciones: tipo === "operator" ? secciones : [],
      redirectTo: authCallbackUrl("invite"),
    },
  });
  if (error) {
    let codigo = null;
    try { codigo = (await error.context?.json?.())?.error ?? null; } catch { /* sin cuerpo */ }
    if (!codigo && /not found|failed to send/i.test(String(error.message))) {
      throw new Error("Falta desplegar la Edge Function admin-create-user en Supabase.");
    }
    throw new Error(ERRORES_ALTA[codigo] || "No se pudo crear el usuario.");
  }
  return data;
}

/** Elimina la cuenta (auth.users) y todo lo que cuelga de ella. No se deshace. */
export async function eliminarUsuario(id) {
  const { error } = await supabase.rpc("admin_delete_user", { p_user_id: id });
  if (error) {
    if (faltaRpc(error)) throw new Error("Falta aplicar en Supabase la migración 20261013180000_admin_usuarios_gestion.");
    const msg = String(error.message || "");
    if (msg.includes("self_delete")) throw new Error("No podés eliminar tu propio usuario.");
    if (msg.includes("not_found")) throw new Error("Ese usuario ya no existe.");
    if (error.code === "42501") throw new Error("No tenés permiso para eliminar este usuario.");
    throw new Error("No se pudo eliminar el usuario.");
  }
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
