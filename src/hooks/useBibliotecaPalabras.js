import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  normalizarPalabra,
  palabraValida,
  motivoPalabraInvalida,
} from "./realtime/useArmaPalabraRound";

/**
 * Biblioteca de palabras de Arma la Palabra.
 *
 * Reemplaza la lista temporal que el panel guardaba en `useState`: ahora la
 * fuente de verdad es `public.palabra_biblioteca`, una tabla GLOBAL (sin
 * session_id) que sobrevive al F5, al cambio de sección, al cierre del Admin,
 * al cambio de computadora y al cambio de jornada.
 *
 * Reglas y quién las hace cumplir:
 *   · forma de la palabra  → `palabraValida` acá (UX) y el CHECK
 *     `arma_palabra_valida(word)` en la tabla (autoridad).
 *   · sin duplicados       → `existe()` acá (UX) y `UNIQUE (word)` en la tabla
 *     (autoridad). El 23505 se traduce a castellano, nunca se muestra el código.
 *   · sólo admin escribe   → RLS `is_admin()`. El panel no lo chequea.
 *
 * No hay Realtime sobre la tabla: la biblioteca la edita el operador en su
 * propia pestaña y el resultado se refleja al instante en la lista local. Si
 * dos admins la editan a la vez, `refresh()` es la puesta al día.
 *
 * Las acciones TIRAN con un mensaje ya escrito para el operador, que es lo que
 * espera el helper `correr()` del panel (try → setErr(e.message)).
 */

const DUPLICADA = "Esa palabra ya está en la biblioteca.";

const COLUMNAS = "id,word,created_by,created_at,updated_at";

/** Alfabético: es como el operador busca una palabra en una lista. */
const ordenar = (lista) =>
  [...lista].sort((a, b) => a.word.localeCompare(b.word, "es"));

/**
 * Traduce un error de Postgres a algo que el operador pueda leer.
 * Nunca devuelve el código SQL ni el texto crudo de la base.
 */
function mensajeError(e, fallback) {
  switch (e?.code) {
    case "23505":    return DUPLICADA;                                   // UNIQUE (word)
    case "23514":    return "Esa palabra no cumple las reglas del juego."; // CHECK arma_palabra_valida
    case "42501":    return "Tu usuario no tiene permisos para editar la biblioteca.";
    case "PGRST116": return "Esa palabra ya no está en la biblioteca.";   // 0 filas afectadas
    default:         return fallback;
  }
}

/**
 * Normaliza y valida con el MISMO criterio que el servidor.
 *
 * No duplica reglas: reusa las tres funciones que ya son espejo de
 * `arma_palabra_normalizar` / `arma_palabra_valida` en Postgres. Tira con el
 * motivo concreto para que el operador no se quede mirando un botón gris.
 */
function preparar(word) {
  const w = normalizarPalabra(word);
  if (!palabraValida(w)) {
    throw new Error(motivoPalabraInvalida(w) || "Esa palabra no sirve para jugar.");
  }
  return w;
}

export function useBibliotecaPalabras() {
  const [palabras, setPalabras] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const montadoRef = useRef(true);

  useEffect(() => {
    montadoRef.current = true;
    return () => { montadoRef.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error: e } = await supabase
      .from("palabra_biblioteca")
      .select(COLUMNAS)
      .order("word", { ascending: true });
    if (!montadoRef.current) return;
    if (e) {
      console.error("[useBibliotecaPalabras] fetch error:", e);
      setError("No pudimos cargar la biblioteca de palabras.");
      setPalabras([]);
    } else {
      setError(null);
      setPalabras(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  /**
   * ¿Ya está cargada? Sólo para la UX del panel (avisar antes de mandar el
   * INSERT). `exceptoId` permite editar una palabra sin que choque consigo misma.
   */
  const existe = useCallback((word, exceptoId = null) => {
    const w = normalizarPalabra(word);
    return palabras.some((p) => p.word === w && p.id !== exceptoId);
  }, [palabras]);

  const agregar = useCallback(async (word) => {
    const w = preparar(word);
    // Mismo patrón que `createPlaylist` en useInternalPlaylists: el id del admin
    // sale de la sesión que ya tiene el cliente de Supabase, sin prop drilling.
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error: e } = await supabase
      .from("palabra_biblioteca")
      .insert({ word: w, created_by: user?.id ?? null })
      .select(COLUMNAS)
      .single();

    if (e) throw new Error(mensajeError(e, "No pudimos agregar la palabra."));
    setPalabras((ps) => ordenar([...ps, data]));
    return data;
  }, []);

  const editar = useCallback(async (id, word) => {
    const w = preparar(word);
    const { data, error: e } = await supabase
      .from("palabra_biblioteca")
      .update({ word: w })
      .eq("id", id)
      .select(COLUMNAS)
      .single();

    if (e) throw new Error(mensajeError(e, "No pudimos guardar el cambio."));
    // Las rondas ya jugadas guardan la palabra como TEXTO copiado, así que
    // editar acá no toca ni una fila del historial.
    setPalabras((ps) => ordenar(ps.map((p) => (p.id === id ? data : p))));
    return data;
  }, []);

  /** DELETE real: el historial vive en `arma_palabra_rounds.target_word`. */
  const eliminar = useCallback(async (id) => {
    const { error: e } = await supabase
      .from("palabra_biblioteca")
      .delete()
      .eq("id", id);

    if (e) throw new Error(mensajeError(e, "No pudimos eliminar la palabra."));
    setPalabras((ps) => ps.filter((p) => p.id !== id));
  }, []);

  return { palabras, loading, error, existe, agregar, editar, eliminar, refresh };
}
