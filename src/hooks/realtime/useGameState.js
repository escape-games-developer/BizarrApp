import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, supabaseAnon } from "../../lib/supabase";

export function useGameState() {
  const [session,   setSession]   = useState(null);
  const [gameState, setGameState] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const channelRef        = useRef(null);
  const mountedRef        = useRef(true);
  const reconnectTimerRef = useRef(null);

  const loadInitial = useCallback(async () => {
    try {
      setLoading(true);
      // supabaseAnon: sin sesión auth, evita AuthApiError en /pantalla
      const { data: sess, error: sessError } = await supabaseAnon
        .from("sessions")
        .select("id, label, date")
        .eq("is_active", true)
        .maybeSingle();
      if (sessError) throw sessError;
      if (!sess) {
        console.info("[useGameState] No hay sesión activa — esperando");
        setSession(null);
        setGameState(null);
        return;
      }
      setSession(sess);
      const { data, error: gsError } = await supabaseAnon
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

  const subscribe = useCallback((sessionId) => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    // Limpiar ref ANTES de removeChannel para que el CLOSED del canal viejo no reconecte.
    const old = channelRef.current;
    channelRef.current = null;
    if (old) supabaseAnon.removeChannel(old);

    const channel = supabaseAnon
      .channel(`game-state-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event:  "UPDATE",
          schema: "public",
          table:  "game_state",
        },
        (payload) => {
          console.info("[useGameState] 📡 Realtime payload .new:", payload.new); // [DEBUG-LOG]
          if (payload.new?.session_id === sessionId) {
            setGameState((prev) => ({ ...prev, ...payload.new }));
          }
        }
      )
      .subscribe((status) => {
        console.info("[useGameState] 🔌 Canal status:", status); // [DEBUG-LOG]
        if (status === "SUBSCRIBED") {
          console.info("[useGameState] Realtime conectado");
          // Re-fetch por si llegó un update mientras el canal estaba caído.
          supabaseAnon
            .from("game_state")
            .select("*")
            .eq("session_id", sessionId)
            .single()
            .then(({ data }) => {
              if (data && mountedRef.current) setGameState(data);
            });
        }
        if (
          (status === "CLOSED" || status === "TIMED_OUT") &&
          mountedRef.current &&
          channelRef.current === channel
        ) {
          console.warn(`[useGameState] Canal ${status} — reconectando en 3s`);
          channelRef.current = null;
          reconnectTimerRef.current = setTimeout(() => {
            if (mountedRef.current) subscribe(sessionId);
          }, 3000);
        }
        if (status === "CHANNEL_ERROR") {
          console.error("[useGameState] Error en canal Realtime");
          setError("Error de conexión en tiempo real");
        }
      });
    channelRef.current = channel;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadInitial();
    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      const ch = channelRef.current;
      channelRef.current = null;
      if (ch) supabaseAnon.removeChannel(ch);
    };
  }, [loadInitial]);

  useEffect(() => {
    if (session?.id) subscribe(session.id);
  }, [session?.id, subscribe]);

  return { session, gameState, loading, error };
}

export function useAdminControls(sessionId) {
  const update = useCallback(async (updates) => {
    if (!sessionId) return { error: "Sin sesión activa" };
    console.info("[useAdminControls] 🎛️ update game_state →", updates); // [DEBUG-LOG]
    const { error } = await supabase
      .from("game_state")
      .update(updates)
      .eq("session_id", sessionId);
    if (error) console.error("[useAdminControls] Update error:", error);
    return { error };
  }, [sessionId]);

  // Dismissa cualquier video launched de la sesión (otra tabla: video_requests).
  // Se llama al salir de placa/juego/escenario para que el video previo no resurface.
  const dismissActiveVideo = useCallback(async () => {
    if (!sessionId) return;
    console.info("[useAdminControls] 🎬 dismissActiveVideo → video_requests status=dismissed"); // [DEBUG-LOG]
    await supabase.from("video_requests")
      .update({ status: "dismissed" })
      .eq("session_id", sessionId)
      .eq("status", "launched");
  }, [sessionId]);

  // ── Juegos ────────────────────────────────────────────────────────────────
  const announceGame = useCallback(async (game) => {
    await dismissActiveVideo();
    return update({ active_placa: `game_${game}`, active_game: null });
  }, [update, dismissActiveVideo]);

  const activateGame = useCallback(async (game) => {
    await dismissActiveVideo();
    return update({ active_game: game, active_placa: null,
                    active_escenario: null, placa_custom: null });
  }, [update, dismissActiveVideo]);

  const deactivateGame = useCallback(async () => {
    await dismissActiveVideo();
    return update({ active_game: null, active_placa: null });
  }, [update, dismissActiveVideo]);

  const toggleZocalo = useCallback((on) =>
    update({ zocalo_active: on }),
  [update]);

  const sendPlaca = useCallback(async (placaId, customData = null) => {
    await dismissActiveVideo();
    return update({ active_placa: placaId, active_game: null,
                    active_escenario: null, placa_custom: customData });
  }, [update, dismissActiveVideo]);

  const clearPlaca = useCallback(async () => {
    await dismissActiveVideo();
    return update({ active_placa: null, placa_custom: null });
  }, [update, dismissActiveVideo]);

  // ── Rey del Orto ──────────────────────────────────────────────────────────
  const launchRaffle = useCallback(async (prize, excludePrevious = false) => {
    await dismissActiveVideo();
    await update({ raffle_state: "launched", active_game: "rey del orto" });
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
            session_id:       sessionId,
            prize,
            exclude_previous: excludePrevious,
          }),
        }
      );
      return res.json();
    };
  }, [sessionId, update, dismissActiveVideo]);

  const resetRaffle = useCallback(() =>
    update({ raffle_state: "idle", raffle_winner_id: null, raffle_winner_name: null }),
  [update]);

  // ── Desafío Demente ───────────────────────────────────────────────────────
  const startTrivia = useCallback(async (coupon) => {
    await dismissActiveVideo();
    return update({
      active_game:        "trivia",
      trivia_state:       "active",
      trivia_question:    0,
      trivia_coupon:      coupon,
      trivia_winner_team: null,
    });
  }, [update, dismissActiveVideo]);

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

  // ── Escenario ─────────────────────────────────────────────────────────────
  const activateEscenario = useCallback(async (type) => {
    await dismissActiveVideo();
    return update({ active_escenario: type, active_placa: null,
                    active_game: null, placa_custom: null });
  }, [update, dismissActiveVideo]);

  const deactivateEscenario = useCallback(async () => {
    await dismissActiveVideo();
    return update({ active_escenario: null });
  }, [update, dismissActiveVideo]);

  // ── Duelo de Talentos ─────────────────────────────────────────────────────
  const startDuelo = useCallback(async () => {
    await dismissActiveVideo();
    return update({
      active_escenario: "duelo",
      duelo_state:      "voting",
      duelo_votes_a:    0,
      duelo_votes_b:    0,
    });
  }, [update, dismissActiveVideo]);

  const revealDuelo = useCallback(() =>
    update({ duelo_state: "revealed" }),
  [update]);

  const openDueloInvitation = useCallback(async () => {
    await dismissActiveVideo();
    return update({ active_placa: "duelo", active_escenario: null,
                    duelo_state: "inviting", duelo_slot1: null, duelo_slot2: null });
  }, [update, dismissActiveVideo]);

  const selectDueloParticipant = useCallback((slot, participant) =>
    update({ [`duelo_slot${slot}`]: participant }),
  [update]);

  const launchDueloVideo = useCallback(async (ytId, ytTitle) => {
    await dismissActiveVideo();
    return update({ active_escenario: "duelo", active_placa: null,
                    duelo_state: "active", duelo_video: { ytId, ytTitle } });
  }, [update, dismissActiveVideo]);

  const closeDuelo = useCallback((winnerId) =>
    update({ duelo_state: "finished", duelo_winner: winnerId,
             active_escenario: null }),
  [update]);

  // ── FTL / PT / Karaoke ───────────────────────────────────────────────────
  const openEscenarioInvitation = useCallback(async (type) => {
    await dismissActiveVideo();
    return update({ active_placa: `escenario_${type}`, active_escenario: null,
                    escenario_invite_type: type });
  }, [update, dismissActiveVideo]);

  const launchEscenario = useCallback(async (type, participant, ytId, ytTitle) => {
    await dismissActiveVideo();
    return update({ active_escenario: type, active_placa: null,
                    escenario_participant: participant,
                    escenario_video: ytId ? { ytId, ytTitle } : null });
  }, [update, dismissActiveVideo]);

  // ── Minijuegos ────────────────────────────────────────────────────────────
  const launchMinijuego = useCallback(async (type, payload) => {
    await dismissActiveVideo();
    return update({ active_game: type, active_placa: null, minijuego_payload: payload });
  }, [update, dismissActiveVideo]);

  // ── Videos del cliente ────────────────────────────────────────────────────
  // Al proyectar un video (status='launched' lo hace useVideoRequests.approve),
  // limpiamos las capas superiores para que el video quede como capa principal
  // (render: juego > escenario > video > placa). Last-write-wins.
  const projectVideo = useCallback(() =>
    update({ active_game: null, active_escenario: null,
             active_placa: null, placa_custom: null }),
  [update]);

  // ── Return — SIN gameState (ese lo da useGameState) ───────────────────────
  return {
    announceGame, activateGame, deactivateGame,
    launchRaffle, resetRaffle,
    startTrivia, revealTriviaAnswer, nextTriviaQuestion, finishTrivia, resetTrivia,
    activateEscenario, deactivateEscenario,
    startDuelo, revealDuelo,
    openDueloInvitation, selectDueloParticipant, launchDueloVideo, closeDuelo,
    openEscenarioInvitation, launchEscenario,
    launchMinijuego,
    toggleZocalo, sendPlaca, clearPlaca,
    projectVideo,
  };
}
