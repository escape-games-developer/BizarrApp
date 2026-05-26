import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, getActiveSession } from "../../lib/supabase";


/**
 * useGameState
 *
 * El hook central de BizarrApp. Sincroniza el estado del juego
 * entre el Admin Panel, la Pantalla Gigante y todos los celulares.
 *
 * Flujo:
 *   1. Al montar: obtiene la sesión activa y el game_state actual
 *   2. Suscribe un canal Realtime a cambios en game_state
 *   3. Cualquier UPDATE que haga el admin se propaga a todos los suscriptores
 *   4. Al desmontar: limpia la suscripción
 *
 * Uso:
 *   const { gameState, session, loading } = useGameState();
 *   // gameState.active_game  → "rey del orto" | "trivia" | null
 *   // gameState.raffle_state → "idle" | "launched" | "winner"
 */
export function useGameState() {
  const [session,   setSession]   = useState(null);
  const [gameState, setGameState] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const channelRef = useRef(null);

  // Cargar estado inicial
  const loadInitial = useCallback(async () => {
    try {
      setLoading(true);

      // Obtener sesión activa
      const sess = await getActiveSession();
      setSession(sess);

      // Obtener game_state actual
      const { data, error: gsError } = await supabase
        .from("game_state")
        .select("*")
        .eq("session_id", sess.id)
        .single();

      if (gsError) throw gsError;
      setGameState(data);

    } catch (err) {
      setError(err.message);
      console.error("[useGameState] Error cargando estado:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Suscribir Realtime
  const subscribe = useCallback((sessionId) => {
    // Limpiar suscripción anterior si existe
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`game-state-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event:  "UPDATE",
          schema: "public",
          table:  "game_state",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          // Merge del nuevo estado — no reemplazar todo el objeto
          // para evitar flickers en campos que no cambiaron
          setGameState((prev) => ({ ...prev, ...payload.new }));
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.info("[useGameState] Realtime conectado");
        }
        if (status === "CHANNEL_ERROR") {
          console.error("[useGameState] Error en canal Realtime");
          setError("Error de conexión en tiempo real");
        }
      });

    channelRef.current = channel;
  }, []);

  useEffect(() => {
    loadInitial();
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [loadInitial]);

  // Suscribir cuando tengamos la sesión
  useEffect(() => {
    if (session?.id) subscribe(session.id);
  }, [session?.id, subscribe]);

  return { session, gameState, loading, error };
}


/**
 * useAdminControls
 *
 * Solo para el Admin Panel.
 * Expone funciones para actualizar el game_state.
 * Cada función hace un UPDATE en Supabase que se propaga
 * automáticamente a todos los dispositivos via Realtime.
 */
export function useAdminControls(sessionId) {
  const update = useCallback(async (updates) => {
    if (!sessionId) return { error: "Sin sesión activa" };
    const { error } = await supabase
      .from("game_state")
      .update(updates)
      .eq("session_id", sessionId);
    if (error) console.error("[useAdminControls] Update error:", error);
    return { error };
  }, [sessionId]);

  // ── Módulo 3: Juegos ──────────────────────────────────────────────────────
  // Anunciar juego con placa previa (antes de lanzarlo)
  const announceGame = useCallback((game) =>
    update({ active_placa: `game_${game}`, active_game: null }),
  [update]);

  const activateGame = useCallback((game) =>
    update({ active_game: game, active_placa: null }),
  [update]);

  const deactivateGame = useCallback(() =>
    update({ active_game: null, active_placa: null }),
  [update]);

  // Zócalo de mensajes
  const toggleZocalo = useCallback((on) =>
    update({ zocalo_active: on }),
  [update]);

  // Placas de pantalla entera
  const sendPlaca = useCallback((placaId, customData = null) =>
    update({ active_placa: placaId, active_game: null,
             active_escenario: null, placa_custom: customData }),
  [update]);

  const clearPlaca = useCallback(() =>
    update({ active_placa: null, placa_custom: null }),
  [update]);

  // ── Rey del Orto ──────────────────────────────────────────────────────────
  const launchRaffle = useCallback(async (prize, excludePrevious = false) => {
    // 1. Marcar como "launched" → todos los celulares arrancan el strobe
    await update({ raffle_state: "launched", active_game: "rey del orto" });

    // 2. Llamar Edge Function para seleccionar ganador en el servidor
    //    (se llama después de los 10 segundos del strobe)
    return async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/launch-raffle`,
        {
          method:  "POST",
          headers: {
            "Content-Type":  "application/json",
            "Authorization": `Bearer ${session.access_token}`,
            "apikey":        import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            session_id:        sessionId,
            prize,
            exclude_previous:  excludePrevious,
          }),
        }
      );
      return res.json();
    };
  }, [sessionId, update]);

  const resetRaffle = useCallback(() =>
    update({ raffle_state: "idle", raffle_winner_id: null, raffle_winner_name: null }),
  [update]);

  // ── Desafío Demente ───────────────────────────────────────────────────────
  const startTrivia = useCallback((coupon) =>
    update({
      active_game:    "trivia",
      trivia_state:   "active",
      trivia_question: 0,
      trivia_coupon:  coupon,
      trivia_winner_team: null,
    }),
  [update]);

  const revealTriviaAnswer = useCallback(() =>
    update({ trivia_state: "revealed" }),
  [update]);

  const nextTriviaQuestion = useCallback((currentQ) =>
    update({ trivia_question: currentQ + 1, trivia_state: "active" }),
  [update]);

  const finishTrivia = useCallback((winnerTeam) =>
    update({ trivia_state: "finished", trivia_winner_team: winnerTeam }),
  [update]);

  const resetTrivia = useCallback(() =>
    update({
      trivia_state:       "idle",
      trivia_question:    0,
      trivia_winner_team: null,
      active_game:        null,
    }),
  [update]);

  // ── Módulo 4: Escenario ───────────────────────────────────────────────────
  const activateEscenario = useCallback((type) =>
    update({ active_escenario: type }),
  [update]);

  const deactivateEscenario = useCallback(() =>
    update({ active_escenario: null }),
  [update]);

  // ── Duelo de Talentos ─────────────────────────────────────────────────────
  const startDuelo = useCallback(() =>
    update({
      active_escenario: "duelo",
      duelo_state:      "voting",
      duelo_votes_a:    0,
      duelo_votes_b:    0,
    }),
  [update]);

  const revealDuelo = useCallback(() =>
    update({ duelo_state: "revealed" }),
  [update]);

  // ── Escenario queue management ─────────────────────────────────────────────
  // Duelo de Talentos: placa → inscripción → selección → video → votación → ganador

  const openDueloInvitation = useCallback(() =>
    // Lanza placa a pantalla + abre invitación en todos los celulares
    update({ active_placa: "duelo", active_escenario: null,
             duelo_state: "inviting", duelo_slot1: null, duelo_slot2: null }),
  [update]);

  const selectDueloParticipant = useCallback((slot, participant) =>
    // slot: 1 o 2 — admin elige de la lista de espera
    update({ [`duelo_slot${slot}`]: participant }),
  [update]);

  const launchDueloVideo = useCallback((ytId, ytTitle) =>
    // Lanza el video a pantalla y activa votación en celulares
    update({ active_escenario: "duelo", active_placa: null,
             duelo_state: "active", duelo_video: { ytId, ytTitle } }),
  [update]);

  const closeDuelo = useCallback((winnerId) =>
    update({ duelo_state: "finished", duelo_winner: winnerId,
             active_escenario: null }),
  [update]);

  // FTL / PT / Karaoke: placa → inscripción → activar con video
  const openEscenarioInvitation = useCallback((type) =>
    update({ active_placa: `escenario_${type}`, active_escenario: null,
             escenario_invite_type: type }),
  [update]);

  const launchEscenario = useCallback((type, participant, ytId, ytTitle) =>
    update({ active_escenario: type, active_placa: null,
             escenario_participant: participant,
             escenario_video: ytId ? { ytId, ytTitle } : null }),
  [update]);

  // Suma / Palabra: lanzamiento directo (sin video, sin cola)
  const launchMinijuego = useCallback((type, payload) =>
    // payload: { target_number } para suma, { target_word } para palabra
    update({ active_game: type, active_placa: null, minijuego_payload: payload }),
  [update]);

  return {
    gameState,
    // Juegos
    announceGame, activateGame, deactivateGame,
    launchRaffle, resetRaffle,
    startTrivia, revealTriviaAnswer, nextTriviaQuestion, finishTrivia, resetTrivia,
    // Escenario
    openDueloInvitation, selectDueloParticipant, launchDueloVideo, closeDuelo,
    openEscenarioInvitation, launchEscenario,
    launchMinijuego,
    // Pantalla
    toggleZocalo, sendPlaca, clearPlaca,
  };
}
