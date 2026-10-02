import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * Configuración del sidebar del admin (orden + visibilidad) —
 * `public.admin_ui_config`, fila `key = 'sidebar'`.
 *
 * Contrato (migración 20261002011728_admin_ui_config_sidebar):
 * - `value = { version: 1, items: [{ id, visible }, …] }`. El índice del array
 *   es el orden. `items: []` (el seed) = sin configuración: orden base.
 * - Lee y guarda cualquier usuario con `is_admin()`. RLS no tira error a quien
 *   no es admin: le filtra la fila (SELECT vacío, UPDATE de 0 filas).
 * - Sólo se manda `value`. `updated_at`/`updated_by` los pone el trigger y el
 *   grant no deja escribirlos.
 * - Concurrencia: el UPDATE filtra por el `updated_at` leído. Se guarda y se
 *   reenvía como el TEXTO que devolvió Supabase: pasarlo por `new Date()`
 *   pierde los microsegundos y el filtro no encontraría la fila nunca.
 * - UPDATE con 0 filas = otra sesión guardó antes, o no hay permiso, o la fila
 *   no existe. Se distingue releyendo.
 * - El CHECK `admin_ui_sidebar_valido` rechaza ids repetidos, campos extra,
 *   ids fuera de camelCase y `ajustes` oculto (23514).
 *
 * Sin Realtime, sin polling, sin localStorage: se lee al habilitarse y, después
 * de guardar, se usa lo guardado. Otra sesión ve el cambio al recargar.
 *
 * Si no hay configuración (o la carga falla), `items` es null y el sidebar usa
 * el orden base de SIDEBAR_MENU: nunca se inventa un orden.
 */

const TABLA = "admin_ui_config";
const CLAVE = "sidebar";
const VERSION = 1;

function itemsValidos(value) {
  const items = value?.items;
  return Array.isArray(items) &&
    items.every((it) => it && typeof it.id === "string" && typeof it.visible === "boolean");
}

/** `items` vacío es el seed: equivale a no tener configuración propia. */
const itemsDe = (value) => (value.items.length ? value.items : null);

/** Traduce un error de Postgres/PostgREST. Nunca devuelve el código SQL. */
function mensajeError(e) {
  switch (e?.code) {
    case "42501": return "Tu usuario no tiene permisos para cambiar el menú del panel.";
    case "23514": return "La configuración enviada no es válida.";
    default:      return "No pudimos guardar la configuración.";
  }
}

/** `habilitado`: leer recién cuando hay un admin logueado (sin sesión, RLS no devuelve nada). */
export function useSidebarConfig(habilitado = true) {
  const [items,     setItems]     = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);   // texto crudo de Supabase
  const [existe,    setExiste]    = useState(false);  // la fila 'sidebar' se pudo leer
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const montadoRef = useRef(true);

  useEffect(() => {
    montadoRef.current = true;
    return () => { montadoRef.current = false; };
  }, []);

  const leer = useCallback(() => supabase
    .from(TABLA)
    .select("value, updated_at")
    .eq("key", CLAVE)
    .maybeSingle(), []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error: e } = await leer();
    if (!montadoRef.current) return;
    if (e) {
      console.error("[useSidebarConfig] fetch error:", e);
      setError("No se pudo cargar la configuración del menú.");
      setItems(null);
      setExiste(false);
    } else if (!data) {
      // RLS filtró la fila (no admin) o la fila no existe: orden base.
      setError(null);
      setItems(null);
      setUpdatedAt(null);
      setExiste(false);
    } else if (!itemsValidos(data.value)) {
      console.error("[useSidebarConfig] value con forma inválida:", data.value);
      setError("La configuración guardada del menú no es válida. Se muestra el orden base.");
      setItems(null);
      setUpdatedAt(data.updated_at);
      setExiste(true);
    } else {
      setError(null);
      setItems(itemsDe(data.value));
      setUpdatedAt(data.updated_at);
      setExiste(true);
    }
    setLoading(false);
  }, [leer]);

  useEffect(() => { if (habilitado) refresh(); }, [habilitado, refresh]);

  /**
   * Guarda el orden y la visibilidad completos. Tira con un mensaje legible si
   * no se guardó: quien llama conserva su borrador. En un conflicto se recarga
   * lo que guardó la otra sesión (el borrador sigue intacto), así el próximo
   * «Guardar» usa la versión nueva.
   */
  const guardar = useCallback(async (nuevosItems) => {
    const value = {
      version: VERSION,
      items: nuevosItems.map(({ id, visible }) => ({ id, visible: !!visible })),
    };
    // Sin la versión leída no hay control de concurrencia: no se guarda a ciegas.
    if (updatedAt == null) {
      throw new Error(existe
        ? "No pudimos leer la versión actual del menú. Recargá la configuración antes de guardar."
        : "No se pudo leer la configuración del menú. Recargala antes de guardar.");
    }
    const { data, error: e } = await supabase
      .from(TABLA)
      .update({ value })
      .eq("key", CLAVE)
      .eq("updated_at", updatedAt)
      .select("updated_at");
    if (e) {
      if (e.code === "23514") console.error("[useSidebarConfig] value rechazado por el CHECK:", value);
      throw new Error(mensajeError(e));
    }

    if (Array.isArray(data) && data.length === 1) {
      setItems(itemsDe(value));
      setUpdatedAt(data[0].updated_at);
      setExiste(true);
      setError(null);
      return data[0];
    }

    // 0 filas: releer para saber por qué.
    const { data: actual, error: e2 } = await leer();
    if (e2) throw new Error("No se guardó y no pudimos verificar por qué. Probá de nuevo.");
    if (!actual) {
      throw new Error(existe
        ? "Tu usuario no tiene permisos para cambiar el menú del panel."
        : "La configuración del menú no existe en la base. Avisá a quien administra Supabase.");
    }
    if (montadoRef.current && itemsValidos(actual.value)) {
      setItems(itemsDe(actual.value));
      setUpdatedAt(actual.updated_at);
      setExiste(true);
    }
    throw new Error("Otra sesión guardó el menú antes que vos. Ya cargamos esa versión: revisá tus cambios y guardá de nuevo, o descartalos.");
  }, [updatedAt, existe, leer]);

  return { items, updatedAt, loading, error, refresh, guardar };
}
