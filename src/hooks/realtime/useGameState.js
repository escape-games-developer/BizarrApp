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
          if (payload.new?.session_id === sessionId) {
            setGameState((prev) => ({ ...prev, ...payload.new }));
          }
        }
      )
      .subscribe((status) => {
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

  const toggleScreenAudio = useCallback((on) =>
    update({ screen_audio_enabled: on }),
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

  // ── Duelo v2 — postulaciones + applause + push ────────────────────────────
  // Flujo nuevo (task DueloPanel): convocatoria por push → postulaciones
  // realtime en duelo_postulaciones → admin elige 2 slots → applause_session
  // game_type='duelo'. Coexiste con las funciones viejas de arriba, que usa el
  // DueloView legacy en EscenarioView (limpieza en task 9). No adaptamos las
  // viejas para no romper esa vista.

  // send-push tiene verify_jwt=true → mandamos el JWT del admin explícito para
  // que la function autentique como admin_users (no como anónimo).
  const pushToSession = useCallback(async (body) => {
    const { data: { session } } = await supabase.auth.getSession();
    return supabase.functions.invoke("send-push", {
      body,
      headers: session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : undefined,
    });
  }, []);

  const openPostulacionesDuelo = useCallback(async () => {
    if (!sessionId) return { error: "Sin sesión activa" };
    // 1. Limpia postulaciones anteriores de la sesión
    await supabase.from("duelo_postulaciones").delete().eq("session_id", sessionId);
    // 2. Borra applause_sessions anteriores de tipo duelo de esta sesión
    await supabase.from("applause_sessions").delete()
      .eq("session_id", sessionId).eq("game_type", "duelo");
    // 3. active_escenario='duelo' + limpia video/slots + state idle
    await update({
      active_escenario: "duelo",
      duelo_video: null,
      duelo_slot1: null,
      duelo_slot2: null,
      duelo_state: "idle",
    });
    // 4. Push nativo a todos los conectados
    await pushToSession({
      session_id: sessionId,
      title: "🎤 ¡Empezó el Duelo!",
      body:  "Postulate para participar",
      url:   "/?view=games&game=duelo",
      tag:   "duelo-open",
    });
  }, [sessionId, update, pushToSession]);

  const setPostulacionStatus = useCallback((id, status) =>
    supabase.from("duelo_postulaciones").update({ status }).eq("id", id),
  []);

  const deletePostulacion = useCallback((id) =>
    supabase.from("duelo_postulaciones").delete().eq("id", id),
  []);

  // NOTA: no inicializamos applause_counts. La RPC applause_add hace INSERT ON CONFLICT
  // cuando llega el primer tap, y las policies actuales no permiten INSERT directo.
  const launchDuelo = useCallback(async ({ p1, p2, videoInput }) => {
    if (!sessionId) return { error: "Sin sesión activa" };
    // 1. Parsear videoInput → YouTube (yt_id) o URL directa
    const ytMatch = String(videoInput).match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    const dueloVideo = ytMatch
      ? { source: "youtube", yt_id: ytMatch[1], video_url: null, title: null }
      : { source: "url", yt_id: null, video_url: videoInput, title: null };

    // 2. Crear applause_session (sin timer: cierra por acción manual del admin)
    const { data: round, error: e1 } = await supabase
      .from("applause_sessions")
      .insert({
        session_id: sessionId,
        game_type:  "duelo",
        status:     "voting",
        p1_user_id: p1.user_id, p1_name: p1.user_name,
        p1_avatar:  JSON.stringify({
          avatar_id: p1.avatar_id, avatar_emoji: p1.avatar_emoji, photo_url: p1.photo_url,
        }),
        p2_user_id: p2.user_id, p2_name: p2.user_name,
        p2_avatar:  JSON.stringify({
          avatar_id: p2.avatar_id, avatar_emoji: p2.avatar_emoji, photo_url: p2.photo_url,
        }),
        voting_ends_at: null,
      })
      .select()
      .single();
    if (e1) throw e1;

    // 3. Postulaciones no seleccionadas → 'rejected' (las 2 en slot quedan 'selected')
    await supabase.from("duelo_postulaciones")
      .update({ status: "rejected" })
      .eq("session_id", sessionId)
      .eq("status", "waiting");

    // 4. Guardar video + slots en game_state
    await update({
      duelo_video: dueloVideo,
      duelo_slot1: {
        user_id: p1.user_id, name: p1.user_name,
        avatar_id: p1.avatar_id, avatar_emoji: p1.avatar_emoji, photo_url: p1.photo_url,
      },
      duelo_slot2: {
        user_id: p2.user_id, name: p2.user_name,
        avatar_id: p2.avatar_id, avatar_emoji: p2.avatar_emoji, photo_url: p2.photo_url,
      },
      duelo_state: "voting",
    });

    // 5. Push a los conectados
    await pushToSession({
      session_id: sessionId,
      title: "🎤 ¡Empezó el Duelo!",
      body:  `${p1.user_name} vs ${p2.user_name}. Elegí a tu favorito`,
      url:   "/?view=games&game=duelo",
      tag:   "duelo-launch",
    });

    return round;
  }, [sessionId, update, pushToSession]);

  const cerrarDuelo = useCallback(() =>
    update({
      active_escenario: null,
      duelo_video: null,
      duelo_slot1: null,
      duelo_slot2: null,
      duelo_state: "idle",
    }),
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
    openPostulacionesDuelo, setPostulacionStatus, deletePostulacion,
    launchDuelo, cerrarDuelo,
    openEscenarioInvitation, launchEscenario,
    launchMinijuego,
    toggleZocalo, toggleScreenAudio, sendPlaca, clearPlaca,
    projectVideo,
  };
}
