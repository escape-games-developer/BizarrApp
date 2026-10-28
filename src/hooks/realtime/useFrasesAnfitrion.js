import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

/**
 * Frases del Anfitrión, agrupadas en bibliotecas con nombre —
 * `anfitrion_frases_bibliotecas` + `anfitrion_frases` (migraciones
 * 20261028140000 y 20261028150000). Cada frase es 'aliento' o 'desaliento'.
 *
 * La tablet usa las frases de las bibliotecas EN USO (`activa`): una o varias,
 * mezcladas. Ajustes → General las edita, marca cuáles se usan y arma
 * bibliotecas nuevas copiando frases de las otras. Lo que cambia otro
 * dispositivo llega por Realtime. Las acciones TIRAN con un mensaje legible.
 */

export const TIPOS_FRASE = ["aliento", "desaliento"];
export const FRASE_MIN = 3;
export const FRASE_MAX = 200;
export const NOMBRE_BIBLIOTECA_MAX = 40;

const limpiar = (t) => String(t || "").trim().replace(/\s+/g, " ");

function traducir(e, fallback) {
  if (e?.code === "23505") return fallback.duplicado || "Ya existe.";
  if (e?.code === "23514") return fallback.invalido || "El texto no es válido.";
  if (e?.code === "42501") return "Tu usuario no puede editar las frases.";
  return fallback.general;
}

function validarFrase(texto) {
  const t = limpiar(texto);
  if (t.length < FRASE_MIN || t.length > FRASE_MAX) throw new Error(`La frase tiene que tener entre ${FRASE_MIN} y ${FRASE_MAX} caracteres.`);
  return t;
}

export function useFrasesAnfitrion() {
  const [bibliotecas, setBibliotecas] = useState([]);
  const [frases, setFrases] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const canalId = useRef(Math.random().toString(36).slice(2));

  const leer = useCallback(async () => {
    const [b, f] = await Promise.all([
      supabase.from("anfitrion_frases_bibliotecas").select("id,nombre,activa,created_at").order("created_at"),
      supabase.from("anfitrion_frases").select("id,biblioteca_id,tipo,texto,created_at").order("created_at"),
    ]);
    const e = b.error || f.error;
    if (e) {
      console.error("[useFrasesAnfitrion]", e);
      setError(e.code === "42P01" || e.code === "42703"
        ? "Falta aplicar en Supabase las migraciones de frases del Anfitrión."
        : "No se pudieron cargar las frases.");
    } else { setError(null); setBibliotecas(b.data || []); setFrases(f.data || []); }
    setCargando(false);
  }, []);

  useEffect(() => {
    leer();
    const canal = supabase.channel(`anfitrion-frases-${canalId.current}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "anfitrion_frases" }, () => { leer(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "anfitrion_frases_bibliotecas" }, () => { leer(); })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [leer]);

  // ── Bibliotecas ──────────────────────────────────────────────────────────
  const crearBiblioteca = useCallback(async (nombre) => {
    const n = limpiar(nombre);
    if (n.length < 2 || n.length > NOMBRE_BIBLIOTECA_MAX) throw new Error(`El nombre tiene que tener entre 2 y ${NOMBRE_BIBLIOTECA_MAX} caracteres.`);
    const { data, error: e } = await supabase.from("anfitrion_frases_bibliotecas")
      .insert({ nombre: n }).select("id").single();
    if (e) throw new Error(traducir(e, { duplicado: "Ya hay una biblioteca con ese nombre.", general: "No se pudo crear la biblioteca." }));
    await leer();
    return data.id;
  }, [leer]);

  const renombrarBiblioteca = useCallback(async (id, nombre) => {
    const n = limpiar(nombre);
    if (n.length < 2 || n.length > NOMBRE_BIBLIOTECA_MAX) throw new Error(`El nombre tiene que tener entre 2 y ${NOMBRE_BIBLIOTECA_MAX} caracteres.`);
    const { error: e } = await supabase.from("anfitrion_frases_bibliotecas").update({ nombre: n }).eq("id", id);
    if (e) throw new Error(traducir(e, { duplicado: "Ya hay una biblioteca con ese nombre.", general: "No se pudo renombrar." }));
    await leer();
  }, [leer]);

  const usarBiblioteca = useCallback(async (id, activa) => {
    const { error: e } = await supabase.from("anfitrion_frases_bibliotecas").update({ activa }).eq("id", id);
    if (e) throw new Error(traducir(e, { general: "No se pudo cambiar la biblioteca en uso." }));
    await leer();
  }, [leer]);

  const eliminarBiblioteca = useCallback(async (id) => {
    const { error: e } = await supabase.from("anfitrion_frases_bibliotecas").delete().eq("id", id);
    if (e) throw new Error(traducir(e, { general: "No se pudo borrar la biblioteca." }));
    await leer();
  }, [leer]);

  // ── Frases ───────────────────────────────────────────────────────────────
  const agregar = useCallback(async (bibliotecaId, tipo, texto) => {
    const t = validarFrase(texto);
    const { error: e } = await supabase.from("anfitrion_frases").insert({ biblioteca_id: bibliotecaId, tipo, texto: t });
    if (e) throw new Error(traducir(e, { duplicado: "Esa frase ya está cargada.", invalido: `La frase tiene que tener entre ${FRASE_MIN} y ${FRASE_MAX} caracteres.`, general: "No se pudo agregar la frase." }));
    await leer();
  }, [leer]);

  const editar = useCallback(async (id, texto) => {
    const t = validarFrase(texto);
    const { error: e } = await supabase.from("anfitrion_frases").update({ texto: t }).eq("id", id);
    if (e) throw new Error(traducir(e, { duplicado: "Esa frase ya está cargada.", invalido: `La frase tiene que tener entre ${FRASE_MIN} y ${FRASE_MAX} caracteres.`, general: "No se pudo guardar la frase." }));
    await leer();
  }, [leer]);

  const eliminar = useCallback(async (id) => {
    const { error: e } = await supabase.from("anfitrion_frases").delete().eq("id", id);
    if (e) throw new Error(traducir(e, { general: "No se pudo borrar la frase." }));
    await leer();
  }, [leer]);

  /** Copia frases de otras bibliotecas a `bibliotecaId`. Las que ya tiene se saltean. */
  const copiar = useCallback(async (bibliotecaId, ids) => {
    const yaTiene = new Set(frases.filter((f) => f.biblioteca_id === bibliotecaId).map((f) => `${f.tipo}|${f.texto.toLowerCase()}`));
    const filas = frases.filter((f) => ids.includes(f.id) && !yaTiene.has(`${f.tipo}|${f.texto.toLowerCase()}`))
      .map((f) => ({ biblioteca_id: bibliotecaId, tipo: f.tipo, texto: f.texto }));
    if (!filas.length) return 0;
    const { error: e } = await supabase.from("anfitrion_frases").insert(filas);
    if (e) throw new Error(traducir(e, {
      duplicado: "Supabase todavía no deja repetir una frase en dos bibliotecas: falta aplicar el índice por biblioteca (ver migración 20261028150000).",
      general: "No se pudieron copiar las frases." }));
    await leer();
    return filas.length;
  }, [frases, leer]);

  // Lo que usa la tablet: las frases de las bibliotecas en uso, sin repetir.
  const enUso = useMemo(() => {
    const activas = new Set(bibliotecas.filter((b) => b.activa).map((b) => b.id));
    const de = (tipo) => [...new Set(frases.filter((f) => f.tipo === tipo && activas.has(f.biblioteca_id)).map((f) => f.texto))];
    return { aliento: de("aliento"), desaliento: de("desaliento") };
  }, [bibliotecas, frases]);

  return {
    bibliotecas, frases, cargando, error, enUso, recargar: leer,
    crearBiblioteca, renombrarBiblioteca, usarBiblioteca, eliminarBiblioteca,
    agregar, editar, eliminar, copiar,
  };
}
