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
  // El sorteo tiene dos pasos separados a propósito. `launchRaffle` deja la
  // largada persistida en game_state (de ahí sacan la cuenta regresiva el
  // cliente y la TV) y `drawRaffleWinner` le pide el ganador al servidor.
  // Separados, un refresh del admin en mitad del estroboscópico no deja la
  // ronda colgada: el panel vuelve a pedir el sorteo sin relanzar nada.
  const launchRaffle = useCallback(async (prize, excludePrevious = false, currentPayload = null) => {
    await dismissActiveVideo();
    // La regla de la ronda viaja en minijuego_payload.raffle, en el MISMO
    // UPDATE que abre la ronda: queda persistida antes de que exista la
    // posibilidad de resolver un ganador. Sin esto, un F5 del admin durante
    // los 10s de estroboscópico reseteaba el toggle a false y el sorteo salía
    // con una regla distinta a la que había elegido.
    // Merge no destructivo: se preserva cualquier otra clave del payload.
    const base = (currentPayload && typeof currentPayload === "object" && !Array.isArray(currentPayload))
      ? currentPayload
      : {};
    return update({
      raffle_state:       "launched",
      active_game:        "rey del orto",
      active_placa:       null,
      placa_custom:       null,
      active_escenario:   null,
      // Limpiar al lanzar: si no, durante los 10s de estroboscópico seguía
      // colgado el ganador de la ronda anterior.
      raffle_winner_id:   null,
      raffle_winner_name: null,
      raffle_prize:       prize?.trim() || "Consumición libre para dos",
      minijuego_payload:  { ...base, raffle: { exclude_previous: !!excludePrevious } },
    });
  }, [update, dismissActiveVideo]);

  // Al ganador lo elige la Edge Function con service_role — nunca el cliente.
  const drawRaffleWinner = useCallback(async ({ prize, excludePrevious = false } = {}) => {
    if (!sessionId) return { error: "Sin sesión activa" };
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return { error: "Sesión de admin vencida — volvé a entrar." };
    try {
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
      const body = await res.json().catch(() => ({}));
      // La function contesta 4xx/5xx con {error}. Sin este chequeo el panel
      // cantaba "ganador" aunque el servidor no hubiera elegido a nadie.
      if (!res.ok || body?.error) return { error: body?.error || `Error ${res.status}` };
      return { winner: body.winner };
    } catch (err) {
      return { error: err.message || "No se pudo contactar al servidor." };
    }
  }, [sessionId]);

  // Limpia también active_game/active_placa: si no, la TV se quedaba con la
  // capa del sorteo encima del DJ y RaffleScreen estroboscopiaba sin fin.
  const resetRaffle = useCallback(() =>
    update({
      raffle_state:       "idle",
      raffle_winner_id:   null,
      raffle_winner_name: null,
      active_game:        null,
      active_placa:       null,
      placa_custom:       null,
    }),
  [update]);

  // ── Desafío Demente ───────────────────────────────────────────────────────
  const startTrivia = useCallback(async (coupon, roundId) => {
    await dismissActiveVideo();
    return update({
      active_game:        "trivia",
      trivia_state:       "active",
      trivia_question:    0,
      trivia_round_id:    roundId,
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
      trivia_round_id:    null,
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

  // Abre (o reabre) la convocatoria. Es el reset de ronda: deja la sesión sin
  // postulaciones ni ronda de aplausos previas, así la ronda 2 arranca en cero.
  const openPostulacionesDuelo = useCallback(async () => {
    if (!sessionId) throw new Error("Sin sesión activa");
    await dismissActiveVideo();
    // 1. Limpia postulaciones anteriores de la sesión
    const { error: eDel } = await supabase
      .from("duelo_postulaciones").delete().eq("session_id", sessionId);
    if (eDel) throw new Error(eDel.message);
    // 2. Borra applause_sessions anteriores de tipo duelo de esta sesión
    //    (el ON DELETE CASCADE se lleva counts y user_contrib → counts en cero)
    const { error: eRound } = await supabase.from("applause_sessions").delete()
      .eq("session_id", sessionId).eq("game_type", "duelo");
    if (eRound) throw new Error(eRound.message);
    // 3. active_escenario='duelo' + limpia video/slots + state idle.
    //    Limpiamos también placa/juego: si no, la capa de placa o de otro juego
    //    quedaba por encima del Duelo en /tv y en /pantalla.
    const { error: eState } = await update({
      active_escenario: "duelo",
      active_game:      null,
      active_placa:     null,
      placa_custom:     null,
      duelo_video: null,
      duelo_slot1: null,
      duelo_slot2: null,
      duelo_state: "idle",
    });
    if (eState) throw new Error(eState.message || String(eState));
    // 4. Push nativo a todos los conectados
    await pushToSession({
      session_id: sessionId,
      title: "🎤 ¡Empezó el Duelo!",
      body:  "Postulate para participar",
      url:   "/?view=games&game=duelo",
      tag:   "duelo-open",
    });
    return {};
  }, [sessionId, update, pushToSession, dismissActiveVideo]);

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
    await dismissActiveVideo();
    // 1. Parsear videoInput → YouTube (yt_id) o URL directa
    const ytMatch = String(videoInput).match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    const dueloVideo = ytMatch
      ? { source: "youtube", yt_id: ytMatch[1], video_url: null, title: null }
      : { source: "url", yt_id: null, video_url: videoInput, title: null };

    // 2. Crear applause_session. El duelo cierra por acción manual del admin,
    //    pero `voting_ends_at` NO puede ir en null: el RPC applause_finish
    //    aborta si la ronda no tiene deadline, incluso con p_force. Le damos
    //    una fecha lejana (12 h) que actúa como tope de seguridad: si nadie
    //    cierra la ronda, no queda "en vivo" para siempre.
    const HORIZON_MS = 12 * 60 * 60 * 1000;
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
        voting_ends_at: new Date(Date.now() + HORIZON_MS).toISOString(),
      })
      .select()
      .single();
    if (e1) throw e1;

    // 3. Postulaciones no seleccionadas → 'rejected' (las 2 en slot quedan 'selected')
    await supabase.from("duelo_postulaciones")
      .update({ status: "rejected" })
      .eq("session_id", sessionId)
      .eq("status", "waiting");

    // 4. Guardar video + slots en game_state (y despejar las capas de arriba:
    //    placa/juego taparían al Duelo en /tv y en /pantalla).
    const { error: e2 } = await update({
      active_escenario: "duelo",
      active_game:      null,
      active_placa:     null,
      placa_custom:     null,
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
    // Sin slots persistidos la TV no sabe a quién mostrar: es un fallo de
    // lanzamiento, no un detalle. Lo propagamos para que el panel no cante éxito.
    if (e2) throw new Error(e2.message || String(e2));

    // 5. Push a los conectados
    await pushToSession({
      session_id: sessionId,
      title: "🎤 ¡Empezó el Duelo!",
      body:  `${p1.user_name} vs ${p2.user_name}. Elegí a tu favorito`,
      url:   "/?view=games&game=duelo",
      tag:   "duelo-launch",
    });

    return round;
  }, [sessionId, update, pushToSession, dismissActiveVideo]);

  // Cierra la MEDICIÓN: el ganador lo calcula y persiste el servidor
  // (applause_finish → status='finished' + winner_slot). Es idempotente y
  // sólo pasa el guard de p_force si auth.uid() está en admin_users, así que
  // dos admins o un doble click no producen dos resultados distintos.
  const finishDuelo = useCallback(async (roundId) => {
    if (!roundId) throw new Error("No hay ronda de duelo abierta");
    const { error } = await supabase.rpc("applause_finish", {
      p_round: roundId, p_force: true,
    });
    if (error) throw new Error(error.message);
    // Espejo en game_state para que la fase también viva donde vive el resto
    // del estado del panel. La fuente de verdad del ganador sigue siendo
    // applause_sessions.winner_slot.
    await update({ duelo_state: "revealed" });
  }, [update]);

  // Reset de ronda: saca el Duelo del aire y deja la pantalla libre.
  // La ronda de aplausos NO se borra acá — queda como histórico y la limpia
  // `openPostulacionesDuelo` al abrir la ronda siguiente.
  const cerrarDuelo = useCallback(() =>
    update({
      active_escenario: null,
      active_placa: null,
      placa_custom: null,
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
    launchRaffle, drawRaffleWinner, resetRaffle,
    startTrivia, revealTriviaAnswer, nextTriviaQuestion, finishTrivia, resetTrivia,
    activateEscenario, deactivateEscenario,
    startDuelo, revealDuelo,
    openDueloInvitation, selectDueloParticipant, launchDueloVideo, closeDuelo,
    openPostulacionesDuelo, setPostulacionStatus, deletePostulacion,
    launchDuelo, finishDuelo, cerrarDuelo,
    openEscenarioInvitation, launchEscenario,
    launchMinijuego,
    toggleZocalo, toggleScreenAudio, sendPlaca, clearPlaca,
    projectVideo,
  };
}
