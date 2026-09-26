import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * Biblioteca de premios de Rey del Orto.
 *
 * Gemelo de `useBibliotecaPalabras`, contra `public.rey_premios_biblioteca`:
 * tabla GLOBAL (sin session_id ni jornada) que sobrevive al F5, al cambio de
 * módulo, al cierre del Admin y al cambio de computadora.
 *
 * Reglas y quién las hace cumplir:
 *   · largo 2–80 y sin espacios en los bordes → `validarNombre` acá (UX) y los
 *     CHECK `..._nombre_length` / `..._nombre_trim` en la tabla (autoridad).
 *   · sin duplicados → `existe()` acá (UX) y el índice único
 *     `rey_premios_biblioteca_nombre_norm_key` (autoridad). El 23505 se
 *     traduce a castellano, nunca se muestra el código.
 *   · sólo admin escribe → RLS `is_admin()`. El panel no lo chequea.
 *
 * Sin Realtime: la tabla no está en la publicación y para V1 no hace falta.
 * `refresh()` es la puesta al día si dos admins la editan a la vez.
 *
 * Las acciones TIRAN con un mensaje ya escrito para el operador, que es lo que
 * espera el helper del panel (try → setActionError(e.message)).
 */

const DUPLICADO = "Ese premio ya está en la biblioteca.";

const COLUMNAS = "id,nombre,detalle,created_by,created_at,updated_at";

export const PREMIO_MIN = 2;
export const PREMIO_MAX = 80;

/**
 * Clave de comparación, espejo del índice único de Postgres:
 * `lower(regexp_replace(nombre, '\s+', ' ', 'g'))`.
 *
 * Es SÓLO para comparar. El texto que se guarda no se transforma: si el
 * operador escribe "2 Tragos", en la base queda "2 Tragos".
 */
export function normalizarPremio(nombre) {
  return (nombre || "").trim().replace(/\s+/g, " ").toLowerCase();
}

/** Espejo de los CHECK de la tabla. Devuelve el motivo, o null si sirve. */
export function motivoPremioInvalido(nombre) {
  const n = (nombre || "").trim();
  if (n.length < PREMIO_MIN) return `El premio necesita al menos ${PREMIO_MIN} caracteres.`;
  if (n.length > PREMIO_MAX) return `Máximo ${PREMIO_MAX} caracteres.`;
  return null;
}

export function premioValido(nombre) {
  return motivoPremioInvalido(nombre) === null;
}

/** Alfabético, ignorando mayúsculas: es como el operador busca en una lista. */
const ordenar = (lista) =>
  [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));

/**
 * Traduce un error de Postgres a algo que el operador pueda leer.
 * Nunca devuelve el código SQL ni el texto crudo de la base.
 */
function mensajeError(e, fallback) {
  switch (e?.code) {
    case "23505":    return DUPLICADO;                                       // índice único normalizado
    case "23514":    return `El premio debe tener entre ${PREMIO_MIN} y ${PREMIO_MAX} caracteres, sin espacios al principio ni al final.`;
    case "42501":    return "Tu usuario no tiene permisos para editar la biblioteca de premios.";
    case "PGRST116": return "Ese premio ya no está en la biblioteca.";       // 0 filas afectadas
    default:         return fallback;
  }
}

/**
 * Prepara lo que se va a guardar: recorta los bordes (lo exige el CHECK
 * `nombre = btrim(nombre)`) y valida el largo. NO toca mayúsculas ni los
 * espacios internos. Tira con el motivo concreto.
 */
function prepararNombre(nombre) {
  const n = (nombre || "").trim();
  const motivo = motivoPremioInvalido(n);
  if (motivo) throw new Error(motivo);
  return n;
}

/** El detalle es opcional: vacío viaja como NULL, no como cadena vacía. */
function prepararDetalle(detalle) {
  const d = (detalle || "").trim();
  return d === "" ? null : d;
}

export function useBibliotecaPremiosRey() {
  const [premios, setPremios] = useState([]);
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
      .from("rey_premios_biblioteca")
      .select(COLUMNAS)
      .order("nombre", { ascending: true });
    if (!montadoRef.current) return;
    if (e) {
      console.error("[useBibliotecaPremiosRey] fetch error:", e);
      setError("No pudimos cargar la biblioteca de premios.");
      setPremios([]);
    } else {
      setError(null);
      setPremios(ordenar(data || []));
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  /**
   * ¿Ya está cargado? Sólo para la UX (avisar antes de mandar el INSERT).
   * Compara con la MISMA clave normalizada que usa el índice único, así el
   * aviso del panel y el rechazo del servidor coinciden.
   * `exceptoId` permite editar un premio sin que choque consigo mismo.
   */
  const existe = useCallback((nombre, exceptoId = null) => {
    const clave = normalizarPremio(nombre);
    if (!clave) return false;
    return premios.some((p) => normalizarPremio(p.nombre) === clave && p.id !== exceptoId);
  }, [premios]);

  const agregar = useCallback(async (nombre, detalle = null) => {
    const n = prepararNombre(nombre);
    // Mismo patrón que useBibliotecaPalabras / useInternalPlaylists: el id del
    // admin sale de la sesión que ya tiene el cliente, sin prop drilling.
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error: e } = await supabase
      .from("rey_premios_biblioteca")
      .insert({ nombre: n, detalle: prepararDetalle(detalle), created_by: user?.id ?? null })
      .select(COLUMNAS)
      .single();

    if (e) throw new Error(mensajeError(e, "No pudimos agregar el premio."));
    setPremios((ps) => ordenar([...ps, data]));
    return data;
  }, []);

  const editar = useCallback(async (id, nombre, detalle = null) => {
    const n = prepararNombre(nombre);
    const { data, error: e } = await supabase
      .from("rey_premios_biblioteca")
      .update({ nombre: n, detalle: prepararDetalle(detalle) })
      .eq("id", id)
      .select(COLUMNAS)
      .single();

    if (e) throw new Error(mensajeError(e, "No pudimos guardar el cambio."));
    // Los sorteos ya jugados guardan el premio como TEXTO copiado
    // (`game_state.raffle_prize` y, más adelante, `rey_ganadores.prize_snapshot`),
    // así que editar acá no reescribe ningún historial.
    setPremios((ps) => ordenar(ps.map((p) => (p.id === id ? data : p))));
    return data;
  }, []);

  /** DELETE real: el historial guarda el premio como texto, no como FK. */
  const eliminar = useCallback(async (id) => {
    const { error: e } = await supabase
      .from("rey_premios_biblioteca")
      .delete()
      .eq("id", id);

    if (e) throw new Error(mensajeError(e, "No pudimos eliminar el premio."));
    setPremios((ps) => ps.filter((p) => p.id !== id));
  }, []);

  return { premios, loading, error, existe, agregar, editar, eliminar, refresh };
}
