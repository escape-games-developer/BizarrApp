import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  DUELO_DURACION_MIN, DUELO_DURACION_MAX, DUELO_APLAUSOS_MIN, DUELO_APLAUSOS_MAX,
} from "../services/duelo";

/**
 * Reglas del Duelo de Talentos — `public.duelo_reglas_config`.
 *
 * Mismo contrato que useReglasSumate / useReglasArma, sobre su propia tabla
 * (hook aparte a propósito: esos módulos están cerrados).
 *
 * Las filas las crea la migración; el Admin sólo las edita. La tabla da
 * UPDATE únicamente sobre `enabled` y `value` — `updated_by` y `updated_at`
 * los pone el trigger `duelo_reglas_config_touch`, por eso NO se mandan.
 *
 * Autoridad: los CHECK de la tabla.
 *   duracion_votacion    → value = {"segundos": 10..600}; enabled ON/OFF
 *                          (apagada conserva el valor).
 *   max_aplausos_usuario → value = {"max": 10..1000}; siempre enabled.
 */

const COLUMNAS = "id,key,enabled,value,updated_at";

function motivoEntero(texto, min, max) {
  const t = String(texto ?? "").trim();
  if (t === "")         return "Escribí un número.";
  if (!/^\d+$/.test(t)) return "Tiene que ser un número entero.";
  const n = Number(t);
  if (n < min) return `El mínimo es ${min}.`;
  if (n > max) return `El máximo es ${max}.`;
  return null;
}
export const motivoDuracionInvalida = (t) => motivoEntero(t, DUELO_DURACION_MIN, DUELO_DURACION_MAX);
export const motivoAplausosInvalido = (t) => motivoEntero(t, DUELO_APLAUSOS_MIN, DUELO_APLAUSOS_MAX);

function mensajeError(e, fallback) {
  switch (e?.code) {
    case "23514":    return "Ese valor no cumple las reglas de la configuración.";
    case "42501":    return "Tu usuario no tiene permisos para cambiar la configuración.";
    case "PGRST116": return "Esa regla no existe o no tenés permiso para editarla.";
    default:         return fallback;
  }
}

export function useReglasDuelo() {
  const [reglas,  setReglas]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const montadoRef = useRef(true);

  useEffect(() => {
    montadoRef.current = true;
    return () => { montadoRef.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error: e } = await supabase
      .from("duelo_reglas_config").select(COLUMNAS).order("key", { ascending: true });
    if (!montadoRef.current) return;
    if (e) {
      console.error("[useReglasDuelo] fetch error:", e);
      setError("No se pudo cargar la configuración.");
      setReglas([]);
    } else {
      setError(null);
      setReglas(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const reglaPorKey = useCallback(
    (key) => reglas.find((r) => r.key === key) || null,
    [reglas],
  );

  const actualizarRegla = useCallback(async (key, patch = {}) => {
    const campos = {};
    if ("enabled" in patch) campos.enabled = !!patch.enabled;
    if ("value"   in patch) campos.value   = patch.value;
    if (Object.keys(campos).length === 0) return null;

    const { data, error: e } = await supabase
      .from("duelo_reglas_config")
      .update(campos)
      .eq("key", key)
      .select(COLUMNAS)
      .single();
    if (e) throw new Error(mensajeError(e, "No pudimos guardar la configuración."));
    // Lo que quedó es lo que devolvió el servidor, no lo que mandamos.
    setReglas((rs) => rs.map((r) => (r.key === key ? data : r)));
    return data;
  }, []);

  return { reglas, loading, error, refresh, reglaPorKey, actualizarRegla };
}
