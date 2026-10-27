import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

/**
 * Ronda de Desafío Demente EN PREPARACIÓN — `public.trivia_borradores`
 * (migración 20261026140000), una fila por jornada.
 *
 * Producción elige las preguntas y el cupón; el Anfitrión los ve en su tablet
 * y puede lanzar. Antes vivían en el estado de la pestaña de quien las armaba:
 * otro dispositivo no las veía y un F5 las borraba.
 *
 * La interfaz imita a useState: `setPreguntas(lista | (prev) => lista)`. El
 * cambio se ve al instante y se guarda en la base un momento después (varios
 * clics seguidos son un solo guardado). Lo que cambia otro dispositivo llega
 * por Realtime; mientras hay un guardado propio pendiente se ignora, para que
 * un eco viejo no pise lo último que tocó el operador.
 */

const ESPERA_MS = 300;
const CUPON_POR_DEFECTO = "BEER50";

export function useTriviaBorrador(sessionId) {
  const [preguntas, setPreguntasEstado] = useState([]);
  const [cupon, setCuponEstado] = useState(CUPON_POR_DEFECTO);
  const [error, setError] = useState(null);
  const actual = useRef({ preguntas: [], cupon: CUPON_POR_DEFECTO });
  const timer = useRef(null);
  const enVuelo = useRef(0);

  const aplicar = useCallback((fila) => {
    const p = Array.isArray(fila?.preguntas) ? fila.preguntas : [];
    const c = fila?.cupon || CUPON_POR_DEFECTO;
    actual.current = { preguntas: p, cupon: c };
    setPreguntasEstado(p);
    setCuponEstado(c);
  }, []);

  useEffect(() => {
    aplicar(null);
    if (!sessionId) return undefined;
    let vivo = true;
    supabase.from("trivia_borradores").select("preguntas,cupon").eq("session_id", sessionId).maybeSingle()
      .then(({ data, error: e }) => {
        if (!vivo) return;
        if (e) { console.error("[useTriviaBorrador]", e); setError("No pudimos leer las preguntas de la ronda."); return; }
        if (!timer.current && !enVuelo.current) aplicar(data);
      });
    const canal = supabase
      .channel(`trivia-borrador-${sessionId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "trivia_borradores", filter: `session_id=eq.${sessionId}` },
        ({ new: fila }) => { if (!timer.current && !enVuelo.current && fila) aplicar(fila); })
      .subscribe();
    return () => { vivo = false; supabase.removeChannel(canal); };
  }, [sessionId, aplicar]);

  const escribir = useCallback(async () => {
    timer.current = null;
    if (!sessionId) return;
    enVuelo.current++;
    const { error: e } = await supabase.from("trivia_borradores")
      .upsert({ session_id: sessionId, ...actual.current }, { onConflict: "session_id" });
    enVuelo.current--;
    if (e) {
      console.error("[useTriviaBorrador] guardar", e);
      setError(e.code === "42501" ? "Tu usuario no puede editar la ronda." : "No se pudieron guardar las preguntas de la ronda.");
    } else setError(null);
  }, [sessionId]);

  const guardar = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(escribir, ESPERA_MS);
  }, [escribir]);

  // Salir del panel con un guardado pendiente: se manda ya, no se pierde.
  const escribirRef = useRef(escribir);
  useEffect(() => { escribirRef.current = escribir; }, [escribir]);
  useEffect(() => () => {
    if (timer.current) { clearTimeout(timer.current); escribirRef.current(); }
  }, []);

  const setPreguntas = useCallback((v) => {
    const p = typeof v === "function" ? v(actual.current.preguntas) : v;
    actual.current = { ...actual.current, preguntas: p };
    setPreguntasEstado(p);
    guardar();
  }, [guardar]);

  const setCupon = useCallback((c) => {
    actual.current = { ...actual.current, cupon: c };
    setCuponEstado(c);
    guardar();
  }, [guardar]);

  return { preguntas, setPreguntas, cupon, setCupon, error };
}
