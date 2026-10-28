import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

/**
 * Premio de Rey del Orto EN PREPARACIÓN — `public.rey_borradores`
 * (migración 20261028120000), una fila por jornada.
 *
 * Producción lo elige en la biblioteca y el Anfitrión lo ve en su tablet antes
 * del sorteo. Elegir no lanza: el premio recién viaja a `game_state` con
 * LANZAR. Mismo contrato que useTriviaBorrador: el cambio se ve al instante,
 * se guarda un momento después y, mientras hay un guardado propio pendiente,
 * se ignora el eco de Realtime para que no pise lo último que se tocó.
 *
 * `premio` = { id, nombre, detalle } | null.
 */

const ESPERA_MS = 300;

const desdeFila = (fila) => (fila?.premio_nombre
  ? { id: fila.premio_id || null, nombre: fila.premio_nombre, detalle: fila.premio_detalle || "" }
  : null);

export function useReyBorrador(sessionId) {
  const [premio, setPremioEstado] = useState(null);
  const [error, setError] = useState(null);
  const actual = useRef(null);
  const timer = useRef(null);
  const enVuelo = useRef(0);

  const aplicar = useCallback((fila) => {
    actual.current = desdeFila(fila);
    setPremioEstado(actual.current);
  }, []);

  useEffect(() => {
    aplicar(null);
    if (!sessionId) return undefined;
    let vivo = true;
    supabase.from("rey_borradores").select("premio_id,premio_nombre,premio_detalle")
      .eq("session_id", sessionId).maybeSingle()
      .then(({ data, error: e }) => {
        if (!vivo) return;
        if (e) { console.error("[useReyBorrador]", e); setError("No pudimos leer el premio elegido."); return; }
        if (!timer.current && !enVuelo.current) aplicar(data);
      });
    const canal = supabase
      .channel(`rey-borrador-${sessionId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "rey_borradores", filter: `session_id=eq.${sessionId}` },
        ({ new: fila }) => { if (!timer.current && !enVuelo.current && fila) aplicar(fila); })
      .subscribe();
    return () => { vivo = false; supabase.removeChannel(canal); };
  }, [sessionId, aplicar]);

  const escribir = useCallback(async () => {
    timer.current = null;
    if (!sessionId) return;
    const p = actual.current;
    enVuelo.current++;
    const { error: e } = await supabase.from("rey_borradores").upsert({
      session_id: sessionId,
      premio_id: p?.id || null,
      premio_nombre: p?.nombre || null,
      premio_detalle: p?.detalle || null,
    }, { onConflict: "session_id" });
    enVuelo.current--;
    if (e) {
      console.error("[useReyBorrador] guardar", e);
      setError(e.code === "42501" ? "Tu usuario no puede elegir el premio." : "No se pudo guardar el premio elegido.");
    } else setError(null);
  }, [sessionId]);

  // Salir del panel con un guardado pendiente: se manda ya, no se pierde.
  const escribirRef = useRef(escribir);
  useEffect(() => { escribirRef.current = escribir; }, [escribir]);
  useEffect(() => () => {
    if (timer.current) { clearTimeout(timer.current); escribirRef.current(); }
  }, []);

  const setPremio = useCallback((p) => {
    actual.current = p ? { id: p.id || null, nombre: p.nombre, detalle: p.detalle || "" } : null;
    setPremioEstado(actual.current);
    clearTimeout(timer.current);
    timer.current = setTimeout(escribir, ESPERA_MS);
  }, [escribir]);

  return { premio, setPremio, error };
}
