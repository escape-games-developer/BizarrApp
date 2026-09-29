import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * Reglas de configuración de Arma la Palabra — `public.arma_palabra_reglas_config`.
 *
 * Mismo contrato que `useReglasRey` / `useReglasSumate`, pero sobre su propia
 * tabla. Hook aparte a propósito: Rey del Orto y Sumate están CERRADOS en V1 y
 * generalizarlos obligaría a reabrirlos.
 *
 * Las filas las define producto vía migración (`20260928233131_arma_palabra_reglas_v1`):
 * el Admin SÓLO configura las que existen. La tabla no da INSERT ni DELETE a
 * `authenticated`, y el UPDATE está limitado a nivel de COLUMNA a `enabled`,
 * `value` y `updated_by`. `updated_at` lo mantiene un trigger.
 *
 * Autoridad: el CHECK de la tabla. Para `participantes_minimos`, `value` tiene
 * que ser exactamente `{"min": <entero 1..100>}`. Lo que valida este hook es la
 * misma regla, pero para avisarle al operador antes de mandar el UPDATE.
 *
 * ⚠️ El mínimo CONFIGURABLE no es el mínimo REAL. `arma_palabra_launch_round`
 * calcula `GREATEST(length(palabra), min)` con la regla ON, y `length(palabra)`
 * con la regla OFF: cada letra tiene que estar en manos de alguien. Este hook
 * no decide si se puede lanzar — eso lo decide el servidor.
 *
 * NO inventa valores por defecto. Si la carga falla, `reglas` queda vacío y
 * `error` cuenta por qué.
 */

/** Keys que este panel sabe renderizar. Otras se ignoran, no se rompen. */
export const REGLA_ARMA_MINIMOS = "participantes_minimos";

export const ARMA_MIN_PISO  = 1;
export const ARMA_MIN_TECHO = 100;

const COLUMNAS = "id,key,enabled,value,updated_by,created_at,updated_at";

/**
 * Espejo del CHECK `arma_palabra_reglas_config_participantes_minimos_valido`.
 * Trabaja sobre el TEXTO del input, no sobre un número ya convertido: así
 * "2.5", "" y " " se rechazan explícitamente en vez de colarse como NaN o 0.
 */
export function motivoMinimoArmaInvalido(texto) {
  const t = String(texto ?? "").trim();
  if (t === "")         return "Escribí un número.";
  if (!/^\d+$/.test(t)) return "Tiene que ser un número entero, sin decimales.";
  const n = Number(t);
  if (n < ARMA_MIN_PISO)  return `El mínimo es ${ARMA_MIN_PISO}.`;
  if (n > ARMA_MIN_TECHO) return `El máximo es ${ARMA_MIN_TECHO}.`;
  return null;
}

/** Traduce un error de Postgres. Nunca devuelve el código SQL. */
function mensajeError(e, fallback) {
  switch (e?.code) {
    case "23514":    return "Ese valor no cumple las reglas de la configuración.";
    case "42501":    return "Tu usuario no tiene permisos para cambiar la configuración.";
    case "PGRST116": return "Esa regla ya no existe en la configuración.";
    case "PGRST301": return "Tu sesión venció. Volvé a entrar al Admin para guardar.";
    default:         return fallback;
  }
}

export function useReglasArma() {
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
      .from("arma_palabra_reglas_config")
      .select(COLUMNAS)
      .order("key", { ascending: true });
    if (!montadoRef.current) return;
    if (e) {
      console.error("[useReglasArma] fetch error:", e);
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
   * que la tabla deja actualizar. Apagar manda SÓLO `enabled`, así el `min`
   * guardado se conserva.
   *
   * Sin usuario autenticado NO guarda: tira.
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
      .from("arma_palabra_reglas_config")
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
