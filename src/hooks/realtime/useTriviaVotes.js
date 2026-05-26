import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabase";


/**
 * useTriviaVotes
 *
 * Para la Pantalla Gigante y el Admin Panel.
 * Escucha votos de trivia en tiempo real y agrega los totales.
 *
 * Con 180 usuarios votando simultáneamente pueden llegar hasta
 * 180 eventos en ~15 segundos. Usamos debounce de 300ms para
 * hacer un solo re-fetch por ráfaga de votos → pantalla suave.
 */
export function useTriviaVotes(sessionId, questionIdx) {
  const [totals,  setTotals]  = useState(null);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef(null);
  const channelRef  = useRef(null);

  // Fetch de totales desde la vista agregada
  const fetchTotals = useCallback(async () => {
    if (!sessionId) return;
    const { data } = await supabase
      .from("trivia_totals")
      .select("*")
      .eq("session_id", sessionId)
      .eq("question_idx", questionIdx)
      .single();
    setTotals(data || { batata_votes:0, membrillo_votes:0, opt_0:0, opt_1:0, opt_2:0, opt_3:0, total_votes:0 });
    setLoading(false);
  }, [sessionId, questionIdx]);

  // Fetch con debounce — evita 180 re-fetches cuando llegan 180 votos a la vez
  const debouncedFetch = useCallback(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchTotals, 300);
  }, [fetchTotals]);

  useEffect(() => {
    fetchTotals();
  }, [fetchTotals]);

  // Suscribir Realtime a nuevos votos
  useEffect(() => {
    if (!sessionId) return;

    if (channelRef.current) supabase.removeChannel(channelRef.current);

    const channel = supabase
      .channel(`trivia-votes-${sessionId}-q${questionIdx}`)
      .on(
        "postgres_changes",
        {
          event:  "INSERT",
          schema: "public",
          table:  "trivia_votes",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          // Solo nos importan los votos de la pregunta actual
          if (payload.new.question_idx === questionIdx) {
            debouncedFetch();
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [sessionId, questionIdx, debouncedFetch]);

  // Porcentajes calculados
  const pcts = totals
    ? {
        batata:    totals.total_votes > 0 ? Math.round(totals.batata_votes    / totals.total_votes * 100) : 50,
        membrillo: totals.total_votes > 0 ? Math.round(totals.membrillo_votes / totals.total_votes * 100) : 50,
        opts:      [0,1,2,3].map((i) =>
                     totals.total_votes > 0
                       ? Math.round(totals[`opt_${i}`] / totals.total_votes * 100)
                       : 0
                   ),
      }
    : null;

  return { totals, pcts, loading };
}


/**
 * useTriviaVoter
 *
 * Para los celulares del público.
 * Maneja el envío del voto de un usuario con:
 *   - Optimistic UI: deshabilita el botón inmediatamente
 *   - Insert en Supabase con UNIQUE constraint (previene doble voto)
 *   - Rollback silencioso si el insert falla
 */
export function useTriviaVoter(sessionId, questionIdx, userId, team) {
  const [myVote,   setMyVote]   = useState(null);  // null = no votó
  const [sending,  setSending]  = useState(false);

  // Resetear voto al cambiar de pregunta
  useEffect(() => {
    setMyVote(null);
  }, [questionIdx]);

  const vote = useCallback(async (optionIdx) => {
    if (myVote !== null || sending) return;  // ya votó o está enviando

    // Optimistic: deshabilitar inmediatamente sin esperar al servidor
    setMyVote(optionIdx);
    setSending(true);

    const { error } = await supabase
      .from("trivia_votes")
      .insert({
        session_id:   sessionId,
        question_idx: questionIdx,
        user_id:      userId,
        team,
        option_idx:   optionIdx,
      });

    if (error) {
      // El UNIQUE constraint rechaza votos duplicados silenciosamente
      // Para otros errores, no hacer rollback — el usuario ya vio su voto
      console.warn("[useTriviaVoter] Vote error (probablemente duplicado):", error.code);
    }

    setSending(false);
  }, [myVote, sending, sessionId, questionIdx, userId, team]);

  return { myVote, vote, hasVoted: myVote !== null };
}


/**
 * useTriviaAccumulated
 *
 * Para la Pantalla Gigante y el Admin Panel.
 * Totales acumulados de TODAS las preguntas de la sesión.
 * Determina qué equipo va ganando en general.
 */
export function useTriviaAccumulated(sessionId) {
  const [accumulated, setAccumulated] = useState({ batata: 0, membrillo: 0 });

  const fetchAll = useCallback(async () => {
    if (!sessionId) return;
    const { data } = await supabase
      .from("trivia_totals")
      .select("batata_votes, membrillo_votes")
      .eq("session_id", sessionId);

    if (!data) return;
    const totals = data.reduce(
      (acc, row) => ({
        batata:    acc.batata    + (row.batata_votes    || 0),
        membrillo: acc.membrillo + (row.membrillo_votes || 0),
      }),
      { batata: 0, membrillo: 0 }
    );
    setAccumulated(totals);
  }, [sessionId]);

  useEffect(() => {
    fetchAll();
    // Refetch cuando llegan nuevos votos
    const channel = supabase
      .channel(`trivia-accumulated-${sessionId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "trivia_votes",
        filter: `session_id=eq.${sessionId}`,
      }, fetchAll)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [sessionId, fetchAll]);

  const total   = accumulated.batata + accumulated.membrillo || 1;
  const bataPct = Math.round(accumulated.batata    / total * 100);
  const membPct = Math.round(accumulated.membrillo / total * 100);
  const leader  = bataPct >= membPct ? "batata" : "membrillo";

  return { accumulated, bataPct, membPct, leader };
}
