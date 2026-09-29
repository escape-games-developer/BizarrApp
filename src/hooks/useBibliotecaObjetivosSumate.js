import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * Biblioteca de objetivos de Sumate que Sumamos — `public.sumate_objetivos_biblioteca`.
 *
 * Hook propio a propósito, gemelo de `useBibliotecaPalabras` pero sin
 * generalizarlo: Arma la Palabra y Rey del Orto están cerrados y no se reabren
 * para que Sumate reuse su código.
 *
 * Contrato (tabla real, aplicada por backend):
 *   · id uuid · target integer · created_by · created_at
 *   · SELECT `id,target` ordenado por target ascendente
 *   · INSERT sólo `target` (created_by lo resuelve el servidor)
 *   · DELETE por `id`
 *   · NO hay UPDATE: un objetivo se borra y se vuelve a cargar.
 *
 * Autoridad: los CHECK / UNIQUE / RLS de la tabla. La validación de acá
 * (entero 3..45) es sólo UX para avisar antes de mandar el INSERT.
 *
 * Sin Realtime, sin localStorage: se lee al montar y cada alta/baja actualiza
 * la lista en memoria con lo que devolvió el servidor. `refresh()` es la
 * puesta al día si dos admins la editan a la vez.
 *
 * La SELECCIÓN de un objetivo no vive acá: es estado operativo local del panel.
 */

export const OBJETIVO_MIN = 3;
export const OBJETIVO_MAX = 45;

const COLUMNAS = "id,target";

const ordenar = (lista) => [...lista].sort((a, b) => a.target - b.target);

/**
 * Espejo UX del CHECK de la tabla. Trabaja sobre el TEXTO del input para que
 * "", " ", "2.5" o "1e2" se rechacen explícitamente en vez de colarse como NaN.
 */
export function motivoObjetivoInvalido(texto) {
  const t = String(texto ?? "").trim();
  if (t === "")         return "Escribí un número.";
  if (!/^\d+$/.test(t)) return "Tiene que ser un número entero, sin decimales.";
  const n = Number(t);
  if (n < OBJETIVO_MIN) return `El mínimo es ${OBJETIVO_MIN}.`;
  if (n > OBJETIVO_MAX) return `El máximo es ${OBJETIVO_MAX}.`;
  return null;
}

/** Traduce un error de Postgres. Nunca devuelve el código ni el texto SQL. */
function mensajeError(e, fallback) {
  switch (e?.code) {
    case "23505":    return "Este objetivo ya existe en la biblioteca.";
    case "23514":    return `Ese objetivo no es válido: tiene que ser un entero entre ${OBJETIVO_MIN} y ${OBJETIVO_MAX}.`;
    case "42501":    return "No tenés permisos para modificar la biblioteca.";
    case "PGRST301": return "Tu sesión venció. Volvé a entrar al Admin.";
    default:         return fallback;
  }
}

export function useBibliotecaObjetivosSumate() {
  const [objetivos, setObjetivos] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const montadoRef = useRef(true);

  useEffect(() => {
    montadoRef.current = true;
    return () => { montadoRef.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error: e } = await supabase
      .from("sumate_objetivos_biblioteca")
      .select(COLUMNAS)
      .order("target", { ascending: true });
    if (!montadoRef.current) return;
    if (e) {
      console.error("[useBibliotecaObjetivosSumate] fetch error:", e);
      setError("No pudimos cargar la biblioteca de objetivos.");
      setObjetivos([]);       // sin fallback: mejor vacío que objetivos inventados
    } else {
      setError(null);
      setObjetivos(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  /** ¿Ya está cargado? Sólo UX: la autoridad es el UNIQUE de la tabla. */
  const existe = useCallback(
    (target) => objetivos.some((o) => o.target === Number(target)),
    [objetivos],
  );

  /** INSERT de `target` y nada más. Tira con un mensaje listo para el operador. */
  const agregar = useCallback(async (texto) => {
    const motivo = motivoObjetivoInvalido(texto);
    if (motivo) throw new Error(motivo);
    const target = Number(String(texto).trim());

    const { data, error: e } = await supabase
      .from("sumate_objetivos_biblioteca")
      .insert({ target })
      .select(COLUMNAS)
      .single();

    if (e) {
      console.error("[useBibliotecaObjetivosSumate] insert error:", e);
      throw new Error(mensajeError(e, "No pudimos agregar el objetivo."));
    }
    setObjetivos((os) => ordenar([...os, data]));
    return data;
  }, []);

  /**
   * DELETE por id. Se pide la fila borrada de vuelta: con RLS, un DELETE que
   * no alcanza ninguna fila NO da error, y el operador creería que se borró.
   */
  const eliminar = useCallback(async (id) => {
    const { data, error: e } = await supabase
      .from("sumate_objetivos_biblioteca")
      .delete()
      .eq("id", id)
      .select("id");

    if (e) {
      console.error("[useBibliotecaObjetivosSumate] delete error:", e);
      throw new Error(mensajeError(e, "No pudimos eliminar el objetivo."));
    }
    if (!data || data.length === 0) {
      throw new Error("No se pudo eliminar: el objetivo ya no estaba o no tenés permisos.");
    }
    setObjetivos((os) => os.filter((o) => o.id !== id));
  }, []);

  return { objetivos, loading, error, refresh, existe, agregar, eliminar };
}
