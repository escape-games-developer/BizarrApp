import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * Ajustes → General — `admin_ui_config` fila `key='general'`
 * (migración 20261021150000_ajustes_general).
 *
 * `value = { version: 1, geoObligatoria: bool, modoInvitado: bool }`:
 *   geoObligatoria → Juegos / Escenario / Pantalla piden la ubicación
 *                    verificada. Apagada, alcanza con estar logueado.
 *   modoInvitado   → el login muestra «Entrar como invitado».
 *
 * Mismo contrato que useRegistroConfig: el cliente lee por RPC pública y el
 * Admin guarda con control de concurrencia sobre el `updated_at` crudo.
 */

const TABLA = "admin_ui_config";
const CLAVE = "general";
const VERSION = 1;

/** Lo que había antes de que existiera la configuración. */
export const GENERAL_POR_DEFECTO = Object.freeze({ geoObligatoria: true, modoInvitado: true });

function normalizar(value) {
  if (!value || typeof value.geoObligatoria !== "boolean" || typeof value.modoInvitado !== "boolean") return null;
  return { geoObligatoria: value.geoObligatoria, modoInvitado: value.modoInvitado };
}

/** Cliente: ajustes vigentes. Mientras carga, o si falla, usa el comportamiento de siempre. */
export function useGeneralConfig() {
  const [config, setConfig] = useState(GENERAL_POR_DEFECTO);
  const [cargando, setCargando] = useState(true);
  useEffect(() => {
    let vivo = true;
    supabase.rpc("general_config").then(({ data, error }) => {
      if (!vivo) return;
      if (error) console.error("[useGeneralConfig]", error);
      setConfig(normalizar(data) ?? GENERAL_POR_DEFECTO);
      setCargando(false);
    });
    return () => { vivo = false; };
  }, []);
  return { config, cargando };
}

/** Admin (Ajustes): lee la fila y guarda cambios. */
export function useGeneralConfigAdmin() {
  const [config, setConfig] = useState(null);       // null = cargando o sin fila
  const [updatedAt, setUpdatedAt] = useState(null);  // texto crudo de Supabase
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setError(null);
    const { data, error: e } = await supabase
      .from(TABLA).select("value, updated_at").eq("key", CLAVE).maybeSingle();
    if (e || !data) {
      if (e) console.error("[useGeneralConfigAdmin]", e);
      setConfig(null);
      setError(e
        ? "No se pudo cargar la configuración general."
        : "Falta aplicar en Supabase la migración 20261021150000_ajustes_general.");
      return;
    }
    setConfig(normalizar(data.value) ?? GENERAL_POR_DEFECTO);
    setUpdatedAt(data.updated_at);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  /** Guarda la configuración entera. Tira con un mensaje legible si no se guardó. */
  const guardar = useCallback(async (nueva) => {
    const value = { version: VERSION, geoObligatoria: !!nueva.geoObligatoria, modoInvitado: !!nueva.modoInvitado };
    const { data, error: e } = await supabase
      .from(TABLA).update({ value }).eq("key", CLAVE).eq("updated_at", updatedAt)
      .select("value, updated_at");
    if (e) {
      throw new Error(e.code === "42501"
        ? "Tu usuario no tiene permisos para cambiar esta configuración."
        : "No se pudo guardar la configuración general.");
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
