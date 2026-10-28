import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

/**
 * Duelistas LLAMADOS del Duelo de Talentos — `public.duelo_borradores`
 * (migración 20261028130000), una fila por jornada.
 *
 * Producción elige quién va de P1 y de P2 y el Anfitrión los ve en su tablet
 * para llamarlos al escenario. Elegir no lanza: la ronda la crea
 * `duelo_launch_round`. Mismo contrato que useReyBorrador: el cambio se ve al
 * instante, se guarda un momento después y, mientras hay un guardado propio
 * pendiente, se ignora el eco de Realtime.
 *
 * `selP1` / `selP2` = id de `duelo_postulaciones` | null.
 */

const ESPERA_MS = 300;

export function useDueloBorrador(sessionId) {
  const [sel, setSelEstado] = useState({ p1: null, p2: null });
  const actual = useRef({ p1: null, p2: null });
  const timer = useRef(null);
  const enVuelo = useRef(0);

  const aplicar = useCallback((fila) => {
    actual.current = { p1: fila?.p1_postulacion_id || null, p2: fila?.p2_postulacion_id || null };
    setSelEstado(actual.current);
  }, []);

  useEffect(() => {
    aplicar(null);
    if (!sessionId) return undefined;
    let vivo = true;
    supabase.from("duelo_borradores").select("p1_postulacion_id,p2_postulacion_id")
      .eq("session_id", sessionId).maybeSingle()
      .then(({ data, error }) => {
        if (!vivo) return;
        if (error) { console.error("[useDueloBorrador]", error); return; }
        if (!timer.current && !enVuelo.current) aplicar(data);
      });
    const canal = supabase
      .channel(`duelo-borrador-${sessionId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "duelo_borradores", filter: `session_id=eq.${sessionId}` },
        ({ new: fila }) => { if (!timer.current && !enVuelo.current && fila) aplicar(fila); })
      .subscribe();
    return () => { vivo = false; supabase.removeChannel(canal); };
  }, [sessionId, aplicar]);

  const escribir = useCallback(async () => {
    timer.current = null;
    if (!sessionId) return;
    enVuelo.current++;
    const { error } = await supabase.from("duelo_borradores").upsert({
      session_id: sessionId,
      p1_postulacion_id: actual.current.p1,
      p2_postulacion_id: actual.current.p2,
    }, { onConflict: "session_id" });
    enVuelo.current--;
    if (error) console.error("[useDueloBorrador] guardar", error);
  }, [sessionId]);

  // Salir del panel con un guardado pendiente: se manda ya, no se pierde.
  const escribirRef = useRef(escribir);
  useEffect(() => { escribirRef.current = escribir; }, [escribir]);
  useEffect(() => () => {
    if (timer.current) { clearTimeout(timer.current); escribirRef.current(); }
  }, []);

  const poner = useCallback((lado, id) => {
    actual.current = { ...actual.current, [lado]: id || null };
    setSelEstado(actual.current);
    clearTimeout(timer.current);
    timer.current = setTimeout(escribir, ESPERA_MS);
  }, [escribir]);
  const setSelP1 = useCallback((id) => poner("p1", id), [poner]);
  const setSelP2 = useCallback((id) => poner("p2", id), [poner]);

  return { selP1: sel.p1, selP2: sel.p2, setSelP1, setSelP2 };
}
