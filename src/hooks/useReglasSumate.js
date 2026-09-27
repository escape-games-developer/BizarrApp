import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * Reglas de configuración de Sumate que Sumamos — `public.sumate_reglas_config`.
 *
 * Mismo contrato que `useReglasRey` sobre `rey_reglas_config`, pero sobre su
 * propia tabla. Es un hook aparte a propósito y no una generalización del de
 * Rey del Orto: ese módulo está CERRADO en V1, y convertirlo en genérico para
 * que Sumate lo reuse significaría editarlo. Dos hooks cortos que no se tocan
 * son más baratos que un hook compartido que obliga a reabrir un módulo
 * congelado cada vez que el otro juego necesita algo.
 *
 * Las filas las define producto vía migración: el Admin SÓLO configura las que
 * existen. La tabla no da INSERT ni DELETE a `authenticated`, y el UPDATE está
 * limitado a nivel de COLUMNA a `enabled`, `value` y `updated_by`.
 * `updated_at` lo mantiene el trigger `sumate_reglas_config_updated_at`.
 *
 * Autoridad: los CHECK de la tabla. Para `participantes_minimos`, `value` tiene
 * que ser exactamente `{"min": <entero 1..100>}` (ninguna clave extra). Lo que
 * valida este hook es la misma regla, pero para avisarle al operador antes de
 * mandar el UPDATE.
 *
 * ⚠️ El mínimo CONFIGURABLE no es el mínimo REAL. `sumate_launch_round` calcula
 * `GREATEST(2, configurado)`: el juego necesita al menos dos números para que
 * exista una suma, y eso no es negociable desde el panel. Configurar 1 es
 * válido para la tabla y el backend igual va a exigir 2.
 *
 * NO inventa valores por defecto. Si la carga falla, `reglas` queda vacío y
 * `error` cuenta por qué.
 */

/** Keys que este panel sabe renderizar. Otras se ignoran, no se rompen. */
export const REGLA_SUMATE_MINIMOS = "participantes_minimos";

/** Mínimo estructural del juego, espejo de `c_min_estructural` en la RPC. */
export const SUMATE_MIN_ESTRUCTURAL = 2;

export const SUMATE_MIN_PISO  = 1;
export const SUMATE_MIN_TECHO = 100;

const COLUMNAS = "id,key,enabled,value,updated_by,created_at,updated_at";

/**
 * Espejo del CHECK `sumate_reglas_config_participantes_minimos_valido`.
 * Trabaja sobre el TEXTO del input, no sobre un número ya convertido: así
 * "2.5", "" y " " se rechazan explícitamente en vez de colarse como NaN o 0.
 */
export function motivoMinimoSumateInvalido(texto) {
  const t = String(texto ?? "").trim();
  if (t === "")         return "Escribí un número.";
  if (!/^\d+$/.test(t)) return "Tiene que ser un número entero, sin decimales.";
  const n = Number(t);
  if (n < SUMATE_MIN_PISO)  return `El mínimo es ${SUMATE_MIN_PISO}.`;
  if (n > SUMATE_MIN_TECHO) return `El máximo es ${SUMATE_MIN_TECHO}.`;
  return null;
}

/** Traduce un error de Postgres. Nunca devuelve el código SQL. */
function mensajeError(e, fallback) {
  switch (e?.code) {
    case "23514":    return "Ese valor no cumple las reglas de la configuración.";
    case "42501":    return "Tu usuario no tiene permisos para cambiar la configuración.";
    case "PGRST116": return "Esa regla ya no existe en la configuración.";
    default:         return fallback;
  }
}

export function useReglasSumate() {
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
      .from("sumate_reglas_config")
      .select(COLUMNAS)
      .order("key", { ascending: true });
    if (!montadoRef.current) return;
    if (e) {
      console.error("[useReglasSumate] fetch error:", e);
      setError("No se pudo cargar la configuración.");
      setReglas([]);          // sin fallback: mejor vacío que un valor inventado
    } else {
      setError(null);
      setReglas(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  /** Siempre por `key`, nunca por posición: el orden de las filas no es contrato. */
  const reglaPorKey = useCallback(
    (key) => reglas.find((r) => r.key === key) || null,
    [reglas],
  );

  /**
   * Actualiza UNA regla, identificada por `key`. Nunca toca las demás filas.
   * Sólo manda `enabled`, `value` y `updated_by`: exactamente las tres columnas
   * que la tabla deja actualizar.
   */
  const actualizarRegla = useCallback(async (key, patch = {}) => {
    const campos = {};
    if ("enabled" in patch) campos.enabled = !!patch.enabled;
    if ("value"   in patch) campos.value   = patch.value;
    if (Object.keys(campos).length === 0) return null;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      throw new Error("Tu sesión venció. Volvé a entrar al Admin para guardar.");
    }
    campos.updated_by = user.id;

    const { data, error: e } = await supabase
      .from("sumate_reglas_config")
      .update(campos)
      .eq("key", key)
      .select(COLUMNAS)
      .single();

    if (e) throw new Error(mensajeError(e, "No pudimos guardar la configuración."));
    // Se guarda lo que devolvió el servidor, no lo que mandamos.
    setReglas((rs) => rs.map((r) => (r.key === key ? data : r)));
    return data;
  }, []);

  return { reglas, loading, error, refresh, reglaPorKey, actualizarRegla };
}
