import { supabase } from "../lib/supabase";

/**
 * Diseño activo por sección de la app Cliente — `public.client_design_active`
 * (migración 20261005230302_client_design_active).
 *
 * - Una fila por sección, creada por migración. Todos leen (con o sin sesión).
 * - Sólo un admin (`is_admin()`) puede cambiar `design_key`. RLS no tira error a
 *   quien no es admin: el UPDATE afecta 0 filas.
 * - `updated_at`/`updated_by` los pone el trigger.
 *
 * El catálogo de diseños vive en el código; un `design_key` desconocido lo
 * resuelve cada sección a su Vista Original ("original").
 */
export const CLIENT_DESIGN_TABLE = "client_design_active";

/** `design_key` activo de una sección, o null (sin fila o tabla inexistente). */
export async function fetchActiveDesign(section, client = supabase) {
  const { data, error } = await client
    .from(CLIENT_DESIGN_TABLE)
    .select("design_key")
    .eq("section", section)
    .maybeSingle();
  if (error) throw error;
  return data?.design_key ?? null;
}

/** `{ [section]: design_key }` de todas las secciones con fila. */
export async function fetchActiveDesigns(client = supabase) {
  const { data, error } = await client.from(CLIENT_DESIGN_TABLE).select("section, design_key");
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r) => [r.section, r.design_key]));
}

/** Traduce un error de Postgres/PostgREST. Nunca devuelve el código SQL. */
function mensajeError(e) {
  switch (e?.code) {
    case "42501": return "Tu usuario no tiene permisos para cambiar el diseño del Cliente.";
    case "23514": return "El diseño elegido no es válido.";
    case "42P01":
    case "PGRST205": return "Falta aplicar la migración client_design_active en Supabase.";
    default:      return "No pudimos activar el diseño.";
  }
}

/** Activa `designKey` en `section` (UPDATE de la fila existente; updated_* los pone el trigger). Tira con un mensaje legible si no se guardó. */
export async function activateDesign(section, designKey, client = supabase) {
  const { data, error } = await client
    .from(CLIENT_DESIGN_TABLE)
    .update({ design_key: designKey })
    .eq("section", section)
    .select("design_key");
  if (error) throw new Error(mensajeError(error));
  if (!Array.isArray(data) || data.length !== 1) {
    throw new Error("No se guardó: tu usuario no tiene permisos o la sección no existe en la base.");
  }
  return data[0].design_key;
}
