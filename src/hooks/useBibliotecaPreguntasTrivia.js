import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * Biblioteca de preguntas de Desafío Demente — `public.trivia_preguntas_biblioteca`
 * (migración `20260929023450_trivia_preguntas_biblioteca_v1`).
 *
 * Catálogo PERSISTENTE y reutilizable, distinto de `trivia_questions` (las
 * preguntas de UNA ronda, por session_id + round_id + question_idx). Usar una
 * pregunta copia sus datos al editor: la ronda nunca depende de esta fila.
 *
 * Contrato (V1 `20260929023450` + edición `20260929025312`):
 *   · SELECT  `id,question_text,options,correct_option,created_at`, por created_at.
 *   · INSERT  sólo `question_text`, `options`, `correct_option`. `created_by`
 *             lo pone la base (auth.uid()) y la policy lo exige: no se manda.
 *   · UPDATE  sólo esas mismas tres columnas (grant por columna).
 *   · DELETE  por id.
 *   UPDATE/DELETE bloqueados por RLS, o sobre una fila que otro admin ya
 *   borró, NO dan error: afectan 0 filas. Por eso ambos piden la fila de
 *   vuelta y sólo cuentan como éxito si vuelve EXACTAMENTE una.
 *   Concurrencia: el último admin que guarda gana (sin versionado).
 *   · options: 2–4 strings no vacíos · correct_option: índice 0-based.
 *   · Duplicados: UNIQUE sobre el texto normalizado → 23505.
 * Sólo admin lee y escribe (RLS is_admin()).
 *
 * Sin localStorage ni datos de ejemplo: si la carga falla, la lista queda
 * vacía y `error` lo dice.
 */

export const TABLA_BIBLIOTECA_TRIVIA = "trivia_preguntas_biblioteca";
const COLUMNAS = "id,question_text,options,correct_option,created_at";

/** Fila de la tabla → forma que usa el panel (la misma que `qs`). */
const desdeFila = (f) => ({
  id:      f.id,
  text:    f.question_text,
  opts:    Array.isArray(f.options) ? f.options : [],
  correct: f.correct_option,
});

/** Pregunta del editor → payload del INSERT. created_by lo pone la base. */
const haciaFila = (q) => ({
  question_text:  q.text,
  options:        q.opts,
  correct_option: q.correct,
});

/** Traduce un error de Postgres/PostgREST. Nunca devuelve SQL crudo. */
function mensajeError(e, fallback) {
  switch (e?.code) {
    case "23505":    return "Esa pregunta ya existe en la biblioteca.";
    case "23514":    return "La pregunta no cumple las reglas de la biblioteca: revisá el texto, las opciones (2 a 4, sin vacías) y la correcta.";
    case "42501":    return "No tenés permisos para modificar la biblioteca.";
    case "PGRST301": return "Tu sesión venció. Volvé a entrar al Admin.";
    default:         return fallback;
  }
}

export function useBibliotecaPreguntasTrivia() {
  const [preguntas, setPreguntas] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [guardando, setGuardando] = useState(false);
  const guardandoRef = useRef(false);
  const montadoRef   = useRef(true);

  useEffect(() => {
    montadoRef.current = true;
    return () => { montadoRef.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error: e } = await supabase
      .from(TABLA_BIBLIOTECA_TRIVIA)
      .select(COLUMNAS)
      .order("created_at", { ascending: true });
    if (!montadoRef.current) return;
    if (e) {
      console.error("[useBibliotecaPreguntasTrivia] fetch error:", e);
      setError("No pudimos cargar la biblioteca de preguntas.");
      setPreguntas([]);       // sin fallback: mejor vacío que preguntas inventadas
    } else {
      setError(null);
      setPreguntas((data || []).map(desdeFila));
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  /**
   * INSERT de una pregunta ya validada y normalizada por el panel. Candado con
   * ref: dos clics en el mismo tick no generan dos INSERT. Después del alta se
   * vuelve a leer la biblioteca desde Supabase.
   */
  const guardar = useCallback(async (q) => {
    if (guardandoRef.current) return null;
    guardandoRef.current = true;
    setGuardando(true);
    try {
      const { data, error: e } = await supabase
        .from(TABLA_BIBLIOTECA_TRIVIA)
        .insert(haciaFila(q))
        .select(COLUMNAS)
        .single();
      if (e) {
        console.error("[useBibliotecaPreguntasTrivia] insert error:", e);
        throw new Error(mensajeError(e, "No pudimos guardar la pregunta en la biblioteca."));
      }
      await refresh();
      return desdeFila(data);
    } finally {
      guardandoRef.current = false;
      if (montadoRef.current) setGuardando(false);
    }
  }, [refresh]);

  /**
   * UPDATE de pregunta + opciones + correcta. Éxito sólo con EXACTAMENTE una
   * fila devuelta: 0 = sin permiso efectivo o ya no existe.
   * No toca las preguntas ya copiadas a una ronda: la ronda guarda una copia.
   */
  const editar = useCallback(async (id, q) => {
    if (guardandoRef.current) return null;
    guardandoRef.current = true;
    setGuardando(true);
    try {
      const { data, error: e } = await supabase
        .from(TABLA_BIBLIOTECA_TRIVIA)
        .update(haciaFila(q))
        .eq("id", id)
        .select(COLUMNAS);
      if (e) {
        console.error("[useBibliotecaPreguntasTrivia] update error:", e);
        throw new Error(mensajeError(e, "No pudimos guardar los cambios de la pregunta."));
      }
      const filas = data || [];
      if (filas.length === 0) {
        await refresh();
        throw new Error("No se pudo actualizar la pregunta. Puede haber sido modificada o eliminada.");
      }
      if (filas.length > 1) {
        await refresh();
        throw new Error("La actualización afectó más de una pregunta. Recargá la biblioteca y revisá.");
      }
      await refresh();
      return desdeFila(filas[0]);
    } finally {
      guardandoRef.current = false;
      if (montadoRef.current) setGuardando(false);
    }
  }, [refresh]);

  /** DELETE por id. Éxito sólo con EXACTAMENTE una fila borrada. */
  const eliminar = useCallback(async (id) => {
    if (guardandoRef.current) return false;
    guardandoRef.current = true;
    setGuardando(true);
    try {
      const { data, error: e } = await supabase
        .from(TABLA_BIBLIOTECA_TRIVIA)
        .delete()
        .eq("id", id)
        .select("id");
      if (e) {
        console.error("[useBibliotecaPreguntasTrivia] delete error:", e);
        throw new Error(mensajeError(e, "No pudimos eliminar la pregunta."));
      }
      const filas = data || [];
      await refresh();
      if (filas.length === 0) {
        throw new Error("No se pudo eliminar. La pregunta puede haber sido eliminada previamente.");
      }
      if (filas.length > 1) {
        throw new Error("El borrado afectó más de una pregunta. Recargá la biblioteca y revisá.");
      }
      return true;
    } finally {
      guardandoRef.current = false;
      if (montadoRef.current) setGuardando(false);
    }
  }, [refresh]);

  return { preguntas, loading, error, guardando, refresh, guardar, editar, eliminar };
}
