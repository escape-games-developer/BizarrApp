import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, supabaseAnon } from "../../lib/supabase";
import { pushAnuncio } from "../../services/anunciosPush";

/**
 * Normaliza lo que el operador escribió (o subió) en el campo de video del
 * Duelo al contrato que lee DueloBigscreen:
 *
 *   YouTube (URL o ID pelado) → { source: "youtube", yt_id }
 *   URL http(s) directa       → { source: "url", video_url }   (mp4/webm subido)
 *   cualquier otra cosa       → null                            (duelo sin video)
 *
 * Devolver NULL —y no "" ni {}— es parte del contrato: la TV decide con
 * `video?.source` si monta el reproductor, así que un objeto a medias le deja
 * el rectángulo negro puesto sin nada que reproducir.
 */
export function parseDueloVideo(videoInput) {
  const raw = typeof videoInput === "string" ? videoInput.trim() : "";
  if (!raw) return null;

  const ytMatch = raw.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  const ytId = ytMatch ? ytMatch[1] : (/^[a-zA-Z0-9_-]{11}$/.test(raw) ? raw : null);
  if (ytId) return { source: "youtube", yt_id: ytId, video_url: null, title: null };

  if (/^https?:\/\//i.test(raw)) {
    return { source: "url", yt_id: null, video_url: raw, title: null };
  }
  return null;   // texto suelto: mejor sin video que con un <video> roto en la TV
}

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
  // Anunciar = poner la placa. El trigger de la base registra el anuncio en
  // client_announcements y acá se avisa a los clientes con una notificación
  // del navegador (sin esperarla: no demora al operador).
  const announceGame = useCallback(async (game) => {
    await dismissActiveVideo();
    const r = await update({ active_placa: `game_${game}`, active_game: null });
    if (!r?.error) pushAnuncio(sessionId, `game_${game}`);
    return r;
  }, [update, dismissActiveVideo, sessionId]);

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

  // Las placas que son anuncios (Duelo, experiencias de Escenario, juegos desde
  // la sección Placas) también avisan; pushAnuncio ignora el resto.
  const sendPlaca = useCallback(async (placaId, customData = null) => {
    await dismissActiveVideo();
    const r = await update({ active_placa: placaId, active_game: null,
                             active_escenario: null, placa_custom: customData });
    if (!r?.error) pushAnuncio(sessionId, placaId);
    return r;
  }, [update, dismissActiveVideo, sessionId]);

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
    // ⚠️ LEGACY / COMPATIBILIDAD MUERTA — `excludePrevious`
    //
    // `minijuego_payload.raffle.exclude_previous` se sigue escribiendo para no
    // tocar el merge del payload, que es infraestructura compartida con los
    // otros minijuegos. Pero DESDE REY DEL ORTO V1 NADIE LO LEE:
    //   · el Admin no lo usa para elegibilidad, badges ni para decidir quién
    //     entra al sorteo;
    //   · `drawRaffleWinner` ya no lo manda en el body;
    //   · la Edge Function v7 lo acepta y lo ignora a propósito;
    //   · la RPC `rey_resolver_sorteo` ni lo recibe.
    //
    // La autoridad sobre ganadores repetidos es
    // `rey_reglas_config.bloquear_ganadores_repetidos` + `rey_ganadores`.
    // Cuando se limpie el payload compartido, esta clave se va sin más.
    //
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
      // Motivo de la cancelación anterior: se limpia al lanzar. Si no, el
      // "SORTEO CANCELADO" de la ronda que se acaba de reintentar seguiría
      // colgado en la base durante la ronda nueva.
      raffle_cancel:      null,
      raffle_prize:       prize?.trim() || "Consumición libre para dos",
      minijuego_payload:  { ...base, raffle: { exclude_previous: !!excludePrevious } },
    });
  }, [update, dismissActiveVideo]);

  // ⚠️ NO EXISTE un `cancelRaffle` en el frontend, y es a propósito.
  //
  // La cancelación del fallo tardío la hace `rey_resolver_sorteo` dentro de la
  // MISMA transacción en la que rechaza la resolución, con la fila de
  // game_state bloqueada, delegando en `rey_cancelar_ronda(session_id, cancel)`.
  // Ese es el único lugar donde una ronda pasa de 'launched' a 'cancelled'.
  //
  // Hubo una versión de este hook con un UPDATE de contención acá, como red por
  // si el rechazo llegaba sin la marca `cancelled`. Se eliminó: era una SEGUNDA
  // autoridad escribiendo el mismo estado, con su propia forma de
  // `raffle_cancel` y sin las guardas de la RPC. Si el Admin recibe un rechazo
  // cancelable que dice que la ronda sigue lanzada, vuelve a PREGUNTAR —la RPC
  // es idempotente— en vez de escribir por su cuenta. Ver `resolverSorteo` en
  // ReyPanel.

  // ── Llamada cruda a launch-raffle ─────────────────────────────────────────
  // React → Edge Function → RPC `rey_resolver_sorteo`. La RPC NUNCA se llama
  // directo desde el navegador: su EXECUTE es sólo de `service_role`.
  //
  // Devuelve SIEMPRE el cuerpo estructurado de la v7 (`ok`, `code`, `error`,
  // `connected_count`, `eligible_count`, `required_count`, …) sin recortar
  // nada: el panel necesita los contadores reales para poder decirle al
  // operador cuánta gente falta, y hardcodear ese número sería mentirle.
  const callLaunchRaffle = useCallback(async ({ prize, dryRun }) => {
    if (!sessionId) return { ok: false, code: "INVALID_REQUEST", error: "Sin sesión activa" };
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return { ok: false, code: "UNAUTHORIZED", error: "Sesión de admin vencida — volvé a entrar." };
    }
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
          // `exclude_previous` ya NO se manda: la autoridad sobre ganadores
          // repetidos es `rey_reglas_config.bloquear_ganadores_repetidos`,
          // que lee la RPC. La v7 todavía acepta el campo, pero lo ignora.
          body: JSON.stringify({ session_id: sessionId, prize, dry_run: !!dryRun }),
        }
      );
      const body = await res.json().catch(() => ({}));
      // La function contesta 4xx/5xx con {ok:false, code, error}. Sin este
      // chequeo el panel cantaba "ganador" aunque el servidor no hubiera
      // elegido a nadie.
      if (!res.ok || body?.error || body?.ok === false) {
        return {
          ok: false,
          code:            body?.code || "INTERNAL_ERROR",
          error:           body?.error || `Error ${res.status}`,
          connected_count: body?.connected_count,
          eligible_count:  body?.eligible_count,
          required_count:  body?.required_count,
          // `cancelled` = la ronda YA quedó en 'cancelled'. La Edge lo deriva
          // de `cancelled || already_cancelled`, porque el contrato de la RPC
          // devuelve `cancelled:false` cuando la ronda ya venía cancelada.
          cancelled:         body?.cancelled === true,
          already_cancelled: body?.already_cancelled === true,
          // Motivo estructurado completo (lo mismo que game_state.raffle_cancel).
          cancel:            body?.cancel ?? null,
        };
      }
      return { ok: true, ...body };
    } catch (err) {
      return {
        ok: false, code: "NETWORK_ERROR",
        error: err.message || "No se pudo contactar al servidor.",
      };
    }
  }, [sessionId]);

  /**
   * PREVALIDACIÓN (dry-run). No elige ganador, no escribe, no abre ronda.
   *
   * Es lo que el panel corre ANTES de `launchRaffle`, para no encender el
   * estroboscópico de una ronda que el servidor va a rechazar. La autoridad
   * sigue siendo el backend: acá no se replica ni una sola regla.
   *
   * Éxito: { ok:true, dry_run:true, connected_count, eligible_count,
   *          required_count, raffle_state, min_participants_enabled,
   *          block_repeat_winners_enabled, jornada }
   * Fallo:  { ok:false, code, error, connected_count, eligible_count,
   *           required_count }
   *
   * OJO — TOCTOU: que dé OK ahora no garantiza nada dentro de 10 segundos.
   * La resolución definitiva vuelve a validar todo, y puede fallar igual.
   */
  const validateRaffle = useCallback(
    ({ prize } = {}) => callLaunchRaffle({ prize, dryRun: true }),
    [callLaunchRaffle],
  );

  // Al ganador lo elige la RPC con service_role — nunca el cliente.
  // Propaga `code` y los contadores además del ganador: si falla DESPUÉS del
  // estroboscópico, el panel tiene que poder decir exactamente por qué.
  const drawRaffleWinner = useCallback(async ({ prize } = {}) => {
    const r = await callLaunchRaffle({ prize, dryRun: false });
    if (!r.ok) {
      return {
        error:           r.error,
        code:            r.code,
        cancelled:         r.cancelled,
        already_cancelled: r.already_cancelled,
        cancel:            r.cancel,
        connected_count: r.connected_count,
        eligible_count:  r.eligible_count,
        required_count:  r.required_count,
      };
    }
    return {
      winner:          r.winner,
      already_drawn:   r.already_drawn,
      prize:           r.prize,
      victoria_n:      r.victoria_n,
      jornada:         r.jornada,
      connected_count: r.connected_count,
      eligible_count:  r.eligible_count,
      required_count:  r.required_count,
    };
  }, [callLaunchRaffle]);

  // Limpia también active_game/active_placa: si no, la TV se quedaba con la
  // capa del sorteo encima del DJ y RaffleScreen estroboscopiaba sin fin.
  // Cierra el juego: limpia el estado vivo del sorteo y lo saca del aire, así
  // la TV vuelve sola a su capa base (DJ Democracy). Es el mismo contrato que
  // `resetTrivia`: soltar `active_game` y nada más — no se avanza la canción
  // del DJ, que sigue sonando donde estaba.
  //
  // Toca SÓLO game_state: no roza connected_users, excluded_raffle ni el
  // histórico de ganadores.
  const resetRaffle = useCallback(() =>
    update({
      raffle_state:       "idle",
      raffle_winner_id:   null,
      raffle_winner_name: null,
      raffle_cancel:      null,
      active_game:        null,
      active_placa:       null,
      placa_custom:       null,
    }),
  [update]);

  // Otra ronda del MISMO juego: borra al ganador pero deja Rey del Orto en el
  // aire (`active_game` intacto), así la TV se queda en la pantalla de reposo
  // del juego mientras el operador prepara el sorteo siguiente, en vez de
  // rebotar a DJ Democracy y volver. Es la diferencia con `resetRaffle`, que
  // ABANDONA el juego.
  const nuevaRondaRaffle = useCallback(() =>
    update({
      raffle_state:       "idle",
      raffle_winner_id:   null,
      raffle_winner_name: null,
      raffle_cancel:      null,
      active_game:        "rey del orto",
      active_placa:       null,
      placa_custom:       null,
    }),
  [update]);

  // ── Desafío Demente ───────────────────────────────────────────────────────
  const startTrivia = useCallback(async (coupon, roundId) => {
    await dismissActiveVideo();
    return update({
      active_game:        "trivia",
      // El anuncio deja `active_placa='game_trivia'` puesta. La prioridad de
      // capas de /pantalla (juego > placa) ya hace que gane el juego, pero sin
      // limpiarla acá la placa queda de residuo en la base y reaparece al
      // cerrar el desafío. `activateGame` hace lo mismo; `startTrivia` no lo
      // hacía.
      active_placa:       null,
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

  // Cierra el juego: limpia el estado vivo del desafío y lo saca del aire, así
  // la TV vuelve sola a su capa base (DJ Democracy). Mismo contrato que
  // `resetRaffle` — soltar `active_game` y nada más: no se avanza la canción
  // del DJ, que sigue sonando donde estaba.
  //
  // `trivia_coupon` también se limpia: es el premio DE ESA partida y, sin esto,
  // el cupón viejo sobrevivía a la ronda y aparecía como premio de la
  // siguiente sin que nadie lo hubiera configurado.
  const resetTrivia = useCallback(() =>
    update({
      trivia_state:       "idle",
      trivia_question:    0,
      trivia_winner_team: null,
      trivia_round_id:    null,
      trivia_coupon:      null,
      active_game:        null,
    }),
  [update]);

  // Otra partida del MISMO juego: limpia la ronda terminada pero deja el
  // Desafío en el aire (`active_game` intacto), así la TV se queda en el
  // standby del juego mientras el operador carga las preguntas siguientes, en
  // vez de rebotar a DJ Democracy y volver. Es la diferencia con `resetTrivia`,
  // que ABANDONA el juego.
  const newTriviaRound = useCallback(() =>
    update({
      trivia_state:       "idle",
      trivia_question:    0,
      trivia_winner_team: null,
      trivia_round_id:    null,
      trivia_coupon:      null,
      active_game:        "trivia",
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
  // Lanzar, finalizar y cancelar son RPC (`services/duelo.js`): la ronda, los
  // participantes, el resultado y el espejo en game_state los escribe el
  // servidor en una sola transacción. Lo único que queda acá es poner el
  // Duelo en el escenario para abrir la convocatoria, que es un cambio de capa
  // como el de cualquier otro juego.
  //
  // Deja los campos de presentación del Duelo en neutro: la ronda anterior (si
  // la había) ya la canceló `duelo_cancel_round` antes de llamar a esto.
  const abrirConvocatoriaDuelo = useCallback(async () => {
    await dismissActiveVideo();
    const { error } = await update({
      active_escenario: "duelo",
      active_game:      null,
      active_placa:     null,
      placa_custom:     null,
      duelo_state:      "idle",
      duelo_slot1:      null,
      duelo_slot2:      null,
      duelo_video:      null,
      duelo_winner:     null,
      duelo_votes_a:    0,
      duelo_votes_b:    0,
    });
    if (error) throw new Error(error.message || String(error));
  }, [update, dismissActiveVideo]);

  // ── FTL / PT / Karaoke ───────────────────────────────────────────────────
  // Placa de invitación (anuncio previo). No la usa Follow the Leader: su
  // convocatoria es `active_escenario` puesto sin participante, que es lo que
  // ya destraba la vista de inscripción del cliente.
  const openEscenarioInvitation = useCallback(async (type) => {
    await dismissActiveVideo();
    const r = await update({ active_placa: `escenario_${type}`, active_escenario: null,
                             escenario_invite_type: type });
    if (!r?.error) pushAnuncio(sessionId, `escenario_${type}`);
    return r;
  }, [update, dismissActiveVideo, sessionId]);

  // Abre la convocatoria: escenario en el aire, todavía sin líder. Limpia al
  // participante y al video anteriores — si no, la ronda nueva arrancaba
  // arrastrando al líder de la ronda pasada en /tv.
  const openEscenario = useCallback(async (type) => {
    await dismissActiveVideo();
    const { error } = await update({
      active_escenario:      type,
      active_placa:          null,
      active_game:           null,
      placa_custom:          null,
      escenario_invite_type: null,
      escenario_participant: null,
      escenario_video:       null,
    });
    if (error) throw new Error(error.message || String(error));
  }, [update, dismissActiveVideo]);

  // Prepara al participante SIN reproducir. Es lo que hace "Llamar al
  // escenario": lo proyecta como listo y deja la canción cargada en
  // `escenario_video`, pero la TV sigue en la pantalla de convocatoria y el DJ
  // sigue congelado con su canción. La reproducción la dispara "▶ Comenzar".
  //
  // `participant` viaja como snapshot denormalizado ({ turn_id, user_id, name,
  // avatar_emoji, playing }), el mismo patrón que los slots del Duelo: la fila
  // de la cola puede cambiar después y la TV tiene que seguir mostrando a quién
  // se subió al escenario. `playing` distingue PREPARADO de EN VIVO sin ninguna
  // columna nueva.
  const prepararEscenario = useCallback(async (type, participant, video) => {
    await dismissActiveVideo();
    const { error } = await update({
      active_escenario:      type,
      active_placa:          null,
      active_game:           null,
      placa_custom:          null,
      escenario_participant: participant ? { ...participant, playing: false } : null,
      escenario_video:       video || null,
    });
    if (error) throw new Error(error.message || String(error));
  }, [update, dismissActiveVideo]);

  // El OPERADOR elige (o cambia) el video que va a hacer el participante ya
  // preparado. Es un UPDATE de un solo campo a propósito: no toca
  // `escenario_participant`, así que cambiar de idea antes de ▶ Comenzar no
  // crea un turno nuevo, no resetea el flag `playing` y no toca los votos.
  const setEscenarioVideo = useCallback(async (video) => {
    const { error } = await update({ escenario_video: video || null });
    if (error) throw new Error(error.message || String(error));
  }, [update]);

  // ▶ Comenzar / ■ Finalizar la performance. Sólo mueven el flag `playing` del
  // snapshot: la TV decide con él si reproduce la canción del participante o
  // vuelve a la del DJ. No se toca la cola del evento en ningún caso.
  const setPerformanceEscenario = useCallback(async (participant, playing) => {
    if (!participant) throw new Error("No hay participante preparado.");
    const { error } = await update({
      escenario_participant: { ...participant, playing: !!playing },
    });
    if (error) throw new Error(error.message || String(error));
  }, [update]);

  // Termina el turno: la convocatoria sigue abierta y la TV vuelve a la
  // pantalla del juego. El DJ retoma su canción, que nunca dejó de ser la suya.
  const finishEscenarioTurn = useCallback(async () => {
    const { error } = await update({
      escenario_participant: null,
      escenario_video:       null,
    });
    if (error) throw new Error(error.message || String(error));
  }, [update]);

  // Saca el escenario del aire → vuelve DJ Democracy. Es lo ÚNICO que apaga el
  // overlay, así que no puede fallar en silencio: `update` devuelve { error }
  // en vez de tirar, y el panel sólo mira el catch.
  const closeEscenario = useCallback(async () => {
    const { error } = await update({
      active_escenario:      null,
      active_placa:          null,
      placa_custom:          null,
      escenario_invite_type: null,
      escenario_participant: null,
      escenario_video:       null,
    });
    if (error) throw new Error(error.message || String(error));
  }, [update]);

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
    launchRaffle, validateRaffle, drawRaffleWinner,
    resetRaffle, nuevaRondaRaffle,
    startTrivia, revealTriviaAnswer, nextTriviaQuestion, finishTrivia, resetTrivia, newTriviaRound,
    activateEscenario, deactivateEscenario,
    abrirConvocatoriaDuelo, dismissActiveVideo,
    openEscenarioInvitation, openEscenario, prepararEscenario,
    setEscenarioVideo, setPerformanceEscenario, finishEscenarioTurn, closeEscenario,
    launchMinijuego,
    toggleZocalo, toggleScreenAudio, sendPlaca, clearPlaca,
    projectVideo,
  };
}
