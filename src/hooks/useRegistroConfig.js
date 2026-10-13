import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * Modalidades de registro de clientes — `admin_ui_config` fila `key='registro'`
 * (migración 20261013200000_registro_modalidades).
 *
 * `value = { version: 1, completo: bool, mailPrimero: bool }`:
 *   completo    → formulario entero con contraseña y mail de confirmación.
 *   mailPrimero → sólo el mail; el link lleva al formulario con el mail fijo.
 *   Las dos apagadas = registro cerrado.
 *
 * `useRegistroConfig` lo lee la app del cliente (RPC pública, sin sesión).
 * `useRegistroConfigAdmin` lo lee y guarda Ajustes, con el mismo control de
 * concurrencia que el sidebar: el UPDATE filtra por el `updated_at` leído,
 * guardado como el TEXTO crudo de Supabase (ver useSidebarConfig).
 */

const TABLA = "admin_ui_config";
const CLAVE = "registro";
const VERSION = 1;

/** Lo que había antes de que existiera la configuración: sólo el registro completo. */
export const REGISTRO_POR_DEFECTO = Object.freeze({ completo: true, mailPrimero: false });

function normalizar(value) {
  if (!value || typeof value.completo !== "boolean" || typeof value.mailPrimero !== "boolean") return null;
  return { completo: value.completo, mailPrimero: value.mailPrimero };
}

/** Cliente: modalidades activas. Mientras carga, o si falla, usa el registro de siempre. */
export function useRegistroConfig() {
  const [config, setConfig] = useState(REGISTRO_POR_DEFECTO);
  const [cargando, setCargando] = useState(true);
  useEffect(() => {
    let vivo = true;
    supabase.rpc("registro_config").then(({ data, error }) => {
      if (!vivo) return;
      if (error) console.error("[useRegistroConfig]", error);
      setConfig(normalizar(data) ?? REGISTRO_POR_DEFECTO);
      setCargando(false);
    });
    return () => { vivo = false; };
  }, []);
  return { config, cargando };
}

/** Admin (Ajustes): lee la fila y guarda cambios. */
export function useRegistroConfigAdmin() {
  const [config, setConfig] = useState(null);       // null = cargando o sin fila
  const [updatedAt, setUpdatedAt] = useState(null);  // texto crudo de Supabase
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setError(null);
    const { data, error: e } = await supabase
      .from(TABLA).select("value, updated_at").eq("key", CLAVE).maybeSingle();
    if (e || !data) {
      if (e) console.error("[useRegistroConfigAdmin]", e);
      setConfig(null);
      setError(e
        ? "No se pudo cargar la configuración del registro."
        : "Falta aplicar en Supabase la migración 20261013200000_registro_modalidades.");
      return;
    }
    setConfig(normalizar(data.value) ?? REGISTRO_POR_DEFECTO);
    setUpdatedAt(data.updated_at);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  /** Guarda la configuración entera. Tira con un mensaje legible si no se guardó. */
  const guardar = useCallback(async (nueva) => {
    const value = { version: VERSION, completo: !!nueva.completo, mailPrimero: !!nueva.mailPrimero };
    const { data, error: e } = await supabase
      .from(TABLA).update({ value }).eq("key", CLAVE).eq("updated_at", updatedAt)
      .select("value, updated_at");
    if (e) {
      throw new Error(e.code === "42501"
        ? "Tu usuario no tiene permisos para cambiar el registro."
        : "No se pudo guardar la configuración del registro.");
    }
    if (!data?.length) {
      // Otra sesión guardó antes (o no hay permiso): se recarga lo vigente.
      await cargar();
      throw new Error("Otra persona cambió esta configuración recién. Se recargó lo vigente: revisalo y probá de nuevo.");
    }
    setConfig(normalizar(data[0].value));
    setUpdatedAt(data[0].updated_at);
  }, [updatedAt, cargar]);

  return { config, error, guardar, recargar: cargar };
}
