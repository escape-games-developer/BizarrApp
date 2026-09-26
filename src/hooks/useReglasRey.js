import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * Reglas de configuración de Rey del Orto — `public.rey_reglas_config`.
 *
 * Las filas las define producto vía migración: el Admin SÓLO configura las que
 * existen. La tabla no da INSERT ni DELETE a `authenticated`, y el UPDATE está
 * limitado a nivel de COLUMNA a `enabled`, `value` y `updated_by` — `key`,
 * `created_at` y `updated_at` no se pueden tocar desde acá aunque se intente.
 * `updated_at` lo mantiene el trigger `rey_reglas_config_updated_at`.
 *
 * Autoridad: los CHECK de la tabla. Para `participantes_minimos`, `value` tiene
 * que ser exactamente `{"min": <entero 1..100>}` (ninguna clave extra); para
 * `bloquear_ganadores_repetidos`, exactamente `{}`. Lo que valida este hook es
 * la misma regla, pero para avisarle al operador antes de mandar el UPDATE.
 *
 * Sin Realtime, sin polling, sin localStorage: se lee al montar y después de
 * cada guardado se actualiza la fila en memoria con lo que devolvió el server.
 *
 * NO inventa valores por defecto. Si la carga falla, `reglas` queda vacío y
 * `error` cuenta por qué: mostrar "ON / 5" cuando no sabemos qué hay guardado
 * sería mentirle al operador sobre la configuración real.
 */

/** Keys que este panel sabe renderizar. Otras se ignoran, no se rompen. */
export const REGLA_PARTICIPANTES_MINIMOS   = "participantes_minimos";
export const REGLA_BLOQUEAR_REPETIDOS      = "bloquear_ganadores_repetidos";
export const REGLAS_CONOCIDAS = Object.freeze([
  REGLA_PARTICIPANTES_MINIMOS,
  REGLA_BLOQUEAR_REPETIDOS,
]);

/** Etiqueta legible por key, para el aviso de configuración incompleta. */
export const NOMBRE_REGLA = Object.freeze({
  [REGLA_PARTICIPANTES_MINIMOS]: "Participantes mínimos",
  [REGLA_BLOQUEAR_REPETIDOS]:    "Bloquear ganadores repetidos",
});

export const MIN_PARTICIPANTES_PISO  = 1;
export const MIN_PARTICIPANTES_TECHO = 100;

const COLUMNAS = "id,key,enabled,value,updated_by,created_at,updated_at";

/**
 * Espejo del CHECK `rey_reglas_config_participantes_minimos_valido`.
 * Trabaja sobre el TEXTO del input, no sobre un número ya convertido: así
 * "2.5", "" y " " se rechazan explícitamente en vez de colarse como NaN o 0.
 */
export function motivoMinimoInvalido(texto) {
  const t = String(texto ?? "").trim();
  if (t === "")            return "Escribí un número.";
  if (!/^\d+$/.test(t))    return "Tiene que ser un número entero, sin decimales.";
  const n = Number(t);
  if (n < MIN_PARTICIPANTES_PISO)  return `El mínimo es ${MIN_PARTICIPANTES_PISO}.`;
  if (n > MIN_PARTICIPANTES_TECHO) return `El máximo es ${MIN_PARTICIPANTES_TECHO}.`;
  return null;
}

export function minimoValido(texto) {
  return motivoMinimoInvalido(texto) === null;
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

export function useReglasRey() {
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
      .from("rey_reglas_config")
      .select(COLUMNAS)
      .order("key", { ascending: true });
    if (!montadoRef.current) return;
    if (e) {
      console.error("[useReglasRey] fetch error:", e);
      setError("No se pudo cargar la configuración.");
      setReglas([]);          // sin fallback: mejor vacío que un valor inventado
    } else {
      setError(null);
      setReglas(data || []);  // se conservan las keys desconocidas; las ignora la UI
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
   *
   * `patch` admite `enabled` y/o `value`. Sólo se mandan esas dos columnas más
   * `updated_by`, que son exactamente las tres que la tabla deja actualizar.
   *
   * Sin usuario autenticado NO guarda: tira. Escribir con `updated_by = null`
   * dejaría un cambio sin autor, y el operador creería que se guardó bien.
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
      .from("rey_reglas_config")
      .update(campos)
      .eq("key", key)
      .select(COLUMNAS)
      .single();

    if (e) throw new Error(mensajeError(e, "No pudimos guardar la configuración."));
    // Se guarda lo que devolvió el servidor, no lo que mandamos: si un CHECK o
    // un trigger normalizó algo, la pantalla muestra lo que quedó de verdad.
    setReglas((rs) => rs.map((r) => (r.key === key ? data : r)));
    return data;
  }, []);

  return { reglas, loading, error, refresh, reglaPorKey, actualizarRegla };
}
