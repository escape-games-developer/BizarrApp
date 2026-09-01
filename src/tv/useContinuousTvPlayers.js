import { useCallback, useEffect, useRef, useState } from "react";
import { tvReport, tvSongEnded } from "../services/pantallaDj";
import { loadYouTubeApi, safeDuration, safeState, safeTime, YT_STATE } from "./youtubeApi";

/**
 * MOTOR DE REPRODUCCIÓN DE LA TV — dos players de YouTube y una máquina de
 * estados explícita.
 *
 * Regla central: la canción actual sólo deja de serlo por una CAUSA VÁLIDA de
 * avance, y esa causa siempre nace del player que realmente está reproduciendo
 * `pantalla_events.current_item_id`. Cualquier otro evento (error del standby,
 * timeout técnico, ENDED atrasado, PAUSED, CUED, BUFFERING, un rerender, un
 * postgres_changes, una reacción o un voto) es ruido y se descarta.
 *
 * Toda decisión de avanzar pasa por `requestAdvance()`, que es idempotente por
 * item y deja traza en consola (`[TV ADVANCE]`) tanto cuando avanza como
 * cuando bloquea: mirando la consola se sabe exactamente quién pidió el cambio.
 */

export const TV_PLAYER_IDS = ["pantalla-tv-player-a", "pantalla-tv-player-b"];

const WATCH_MS        = 400;
const REPORT_MS       = 4000;
const LOAD_TIMEOUT_MS = 12000;   // sólo detecta "este player no arrancó nunca"
const ADVANCE_RETRY_MS = 3000;   // espera antes de reintentar un avance rechazado
const FADE_STEP_MS    = 50;      // ~20 muestras por segundo en cada rampa
const CONFIRM_TICKS   = 2;       // muestras seguidas antes de creerle al reloj
const MAX_SKIPS_IN_A_ROW = 5;    // corta el loop si nada se puede reproducir

/**
 * Causas por las que la canción actual PUEDE terminar desde la TV.
 * Todo lo que no está en ADVANCE_REASONS se registra pero nunca avanza.
 */
const REASON = {
  NATURAL_ENDED:   "natural-ended",            // PLAYBACK_ENDED
  CROSSFADE:       "crossfade-6s",             // fin efectivo a 6 s
  CURRENT_LOAD:    "current-load-failed",      // LOAD_FAILED de la canción CURRENT
  CURRENT_TIMEOUT: "current-load-timeout",     // TRANSITION_TIMEOUT de la CURRENT
  CURRENT_PLAY:    "current-playback-failed",  // PLAYBACK_FAILED de la CURRENT
  // — los de abajo NUNCA avanzan —
  STANDBY_FAILED:  "standby-error",            // STANDBY_FAILED
  STANDBY_TIMEOUT: "standby-timeout",
  STALE_ENDED:     "stale-ended",
  INACTIVE_PLAYER: "inactive-player-event",
  EXTERNAL:        "external-advance",         // MANUAL_SKIP / KICK_SKIP: los ordenó el servidor
};

const ADVANCE_REASONS = new Set([
  REASON.NATURAL_ENDED, REASON.CROSSFADE,
  REASON.CURRENT_LOAD, REASON.CURRENT_TIMEOUT, REASON.CURRENT_PLAY,
]);

/** Motivo que se archiva en el historial del evento. */
const SERVER_REASON = {
  [REASON.NATURAL_ENDED]:   "advance",
  [REASON.CROSSFADE]:       "advance",
  [REASON.CURRENT_LOAD]:    "error-skip",
  [REASON.CURRENT_TIMEOUT]: "error-skip",
  [REASON.CURRENT_PLAY]:    "error-skip",
};

const PHASES = ["IDLE", "LOADING_CURRENT", "PLAYING", "PREPARING_NEXT", "TRANSITIONING", "WAITING_NEXT", "ERROR"];

const DEV = import.meta.env.DEV;
const debug = (...args) => { if (DEV) console.info("[TV]", ...args); };

const emptySlot = () => ({ itemId: null, item: null, role: "idle", timeout: null, started: false, retried: false });

const videoOptions = (item) => ({
  videoId: item.youtube_id,
  startSeconds: Number(item.trim_start_seconds) || 0,
  ...(Number(item.trim_end_seconds) > 0 ? { endSeconds: Number(item.trim_end_seconds) } : {}),
});

/**
 * Final EFECTIVO de reproducción. Con recorte manda `trim_end_seconds`; sin
 * recorte (o con un recorte imposible) manda la duración real del video.
 */
export function effectiveEndOf(item, duration) {
  const trimEnd = Number(item?.trim_end_seconds) || 0;
  const real    = Number.isFinite(duration) && duration > 0 ? duration : 0;
  if (trimEnd > 0 && (real === 0 || trimEnd <= real)) return trimEnd;
  return real;
}

export function useContinuousTvPlayers({ current, eventId, token, unlocked, rainAnticipationSeconds = 6, rainTailSeconds = 0 }) {
  const [visiblePlayer, setVisiblePlayer] = useState(0);
  const [rainPhase, setRainPhase] = useState("idle");
  const [playerError, setPlayerError] = useState(null);
  const [readyCount, setReadyCount] = useState(0);

  const playersRef = useRef([null, null]);
  const readyRef   = useRef([false, false]);
  // Qué item tiene cargado CADA player. Comparar índices no alcanza: hace falta
  // saber qué canción devolvió el evento para poder descartar los atrasados.
  const slotsRef   = useRef([emptySlot(), emptySlot()]);
  const activeIndexRef   = useRef(0);
  const displayedItemRef = useRef(null);
  const latestCurrentRef = useRef(current);
  const phaseRef      = useRef("IDLE");
  const transitionRef = useRef(null);
  // Idempotencia: para un item dado sólo se permite UN avance.
  const advancedRef   = useRef(new Set());
  const unplayableRef = useRef(new Set());
  const skipStreakRef = useRef(0);
  const watchTicksRef = useRef({ itemId: null, hits: 0 });
  const controllerRef = useRef(null);
  const timersRef     = useRef(new Set());
  // Rampa de volumen viva por player: durante el crossfade hay dos a la vez.
  const fadesRef      = useRef([null, null]);
  // Ultimo fallo del RPC de avance por item: evita reintentar 2 veces por segundo.
  const advanceFailRef = useRef(new Map());

  latestCurrentRef.current = current;
  const rainAnticipationRef = useRef(rainAnticipationSeconds);
  const rainTailRef = useRef(rainTailSeconds);
  rainAnticipationRef.current = rainAnticipationSeconds;
  rainTailRef.current = rainTailSeconds;
  // Ventana real del cruce en curso, ya acotada al largo del tema (ver `ventanaDeCruce`).
  const crossfadeMsRef = useRef(rainAnticipationSeconds * 1000);

  const later = useCallback((fn, delay) => {
    const timer = setTimeout(() => { timersRef.current.delete(timer); fn(); }, delay);
    timersRef.current.add(timer);
    return timer;
  }, []);

  useEffect(() => {
    if (!unlocked || !eventId) return;
    let cancelled = false;
    const effectTimers = timersRef.current;
    const effectFails  = advanceFailRef.current;

    // ── Diagnóstico ─────────────────────────────────────────────────────────
    const snapshot = (reason, itemId, playerIndex) => {
      const player = playersRef.current[playerIndex] ?? null;
      const item   = slotsRef.current[playerIndex]?.item ?? displayedItemRef.current;
      const duration = safeDuration(player);
      const time     = safeTime(player);
      const effectiveEnd = effectiveEndOf(item, duration);
      return {
        reason,
        itemId,
        currentItemId:   latestCurrentRef.current?.id ?? null,
        displayedItemId: displayedItemRef.current?.id ?? null,
        playerIndex,
        activePlayerIndex: activeIndexRef.current,
        playerItemId: slotsRef.current[playerIndex]?.itemId ?? null,
        playerState:  safeState(player),
        currentTime:  Number(time.toFixed(2)),
        duration:     Number(duration.toFixed(2)),
        effectiveEnd: Number(effectiveEnd.toFixed(2)),
        remaining:    Number((effectiveEnd - time).toFixed(2)),
        phase: phaseRef.current,
        transitionActive: Boolean(transitionRef.current),
        timestamp: new Date().toISOString(),
      };
    };

    const logAdvance = (reason, itemId, playerIndex, extra = {}) => {
      if (!DEV) return;
      console.info("[TV ADVANCE]", { ...snapshot(reason, itemId, playerIndex), ...extra });
    };

    const logBlocked = (reason, itemId, playerIndex, blockedBy, extra = {}) => {
      if (!DEV) return;
      console.info("[TV ADVANCE BLOCKED]", { ...snapshot(reason, itemId, playerIndex), blockedBy, ...extra });
    };

    const setPhase = (next) => {
      if (!PHASES.includes(next) || phaseRef.current === next) return;
      debug(`phase ${phaseRef.current} → ${next}`);
      phaseRef.current = next;
    };

    // ── Utilidades de players ───────────────────────────────────────────────
    const clearSlotTimeout = (index) => {
      const slot = slotsRef.current[index];
      if (!slot?.timeout) return;
      clearTimeout(slot.timeout);
      timersRef.current.delete(slot.timeout);
      slot.timeout = null;
    };

    const cancelFade = (index) => {
      const running = fadesRef.current[index];
      if (!running) return;
      clearInterval(running);
      timersRef.current.delete(running);
      fadesRef.current[index] = null;
    };

    /**
     * Rampa de volumen por player. Un paso cada FADE_STEP_MS (≈20 muestras por
     * segundo) para que se sienta progresiva: con 5 pasos fijos, un fade largo
     * sonaba escalonado.
     *
     * Se guarda por índice y se cancela la anterior: durante el crossfade hay
     * dos rampas vivas a la vez y no pueden pisarse entre sí.
     */
    const fadeVolume = (index, player, from, to, duration, done) => {
      cancelFade(index);
      if (!player) { done?.(); return; }
      const steps = Math.max(1, Math.round(duration / FADE_STEP_MS));
      let step = 0;
      try { player.setVolume(from); } catch { /* player todavía no listo */ }
      const interval = setInterval(() => {
        step += 1;
        try { player.setVolume(Math.round(from + ((to - from) * step) / steps)); } catch { /* noop */ }
        if (step >= steps) {
          cancelFade(index);
          done?.();
        }
      }, FADE_STEP_MS);
      fadesRef.current[index] = interval;
      timersRef.current.add(interval);
    };

    /**
     * ¿Este player es el que tiene que sonar la canción CURRENT?
     * Durante una transición el dueño es el player destino; fuera de ella, el
     * player activo. Sólo el dueño puede terminar la canción actual.
     */
    const ownsCurrent = (index, itemId) => {
      const currentId = latestCurrentRef.current?.id ?? null;
      if (!itemId || !currentId || itemId !== currentId) return false;
      const transition = transitionRef.current;
      if (transition && transition.targetId === itemId) return index === transition.targetIndex;
      return index === activeIndexRef.current && displayedItemRef.current?.id === itemId;
    };

    // ── ÚNICA puerta de avance ──────────────────────────────────────────────
    const requestAdvance = async (reason, itemId, playerIndex, extra = {}) => {
      if (!ADVANCE_REASONS.has(reason))    { logBlocked(reason, itemId, playerIndex, "reason-not-allowed", extra); return null; }
      if (!itemId)                         { logBlocked(reason, itemId, playerIndex, "no-item-id", extra); return null; }
      if (advancedRef.current.has(itemId)) { logBlocked(reason, itemId, playerIndex, "already-advanced", extra); return null; }
      if (itemId !== latestCurrentRef.current?.id) { logBlocked(reason, itemId, playerIndex, "not-current-item", extra); return null; }
      if (!ownsCurrent(playerIndex, itemId))       { logBlocked(reason, itemId, playerIndex, "player-does-not-own-current", extra); return null; }

      // Un intento que falló recién no se repite a la velocidad del reloj (cada
      // 400 ms): se espera el cooldown y lo reintenta el tick siguiente, o ENDED.
      const lastFail = advanceFailRef.current.get(itemId) ?? 0;
      if (Date.now() - lastFail < ADVANCE_RETRY_MS) {
        logBlocked(reason, itemId, playerIndex, "advance-retry-cooldown", extra); return null;
      }

      advancedRef.current.add(itemId);
      logAdvance(reason, itemId, playerIndex, extra);
      try {
        await tvSongEnded(eventId, token, itemId, SERVER_REASON[reason] || "advance");
      } catch (error) {
        // El guard server-side rechaza los avances viejos: no es un fallo nuestro.
        //
        // Pero la marca de idempotencia se pone ANTES del await, y si no se
        // revierte el item queda quemado: ni el reloj ni ENDED pueden volver a
        // pedir el avance, y la canción se muere ahí, muda y sin lluvia. Se
        // revierte y se anota el fallo para no reintentar en bucle.
        advancedRef.current.delete(itemId);
        advanceFailRef.current.set(itemId, Date.now());
        console.error("[TV] el servidor rechazó el avance", { itemId, reason, message: error.message });
        return null;
      }
      advanceFailRef.current.delete(itemId);
      return itemId;
    };

    // ── Transiciones ────────────────────────────────────────────────────────
    /**
     * Lluvia + rampa de bajada del player activo. No decide nada por sí sola.
     *
     * La bajada dura TODA la ventana de transición y el saliente NO se pausa
     * acá: antes bajaba en 1 s y se pausaba, pero el swap recién ocurre al final
     * de la ventana, así que quedaban segundos de silencio bajo la lluvia. El
     * saliente ahora sigue sonando hasta que el entrante está audible; lo pausa
     * `finishSwap`, recién cuando ya hay con qué reemplazarlo.
     *
     * La ventana es la anticipación de lluvia configurada en el evento: la
     * rampa dura exactamente lo que dura la lluvia, no una constante aparte.
     */
    /**
     * Ventana real del cruce, en ms.
     *
     * La anticipación configurada es un TECHO, no un valor fijo. Si el tema dura
     * menos que esa ventana, el cruce arrancaría apenas empieza a sonar y la TV
     * pasaría de canción sola a los pocos segundos de abrirla — el bug que ya
     * tuvimos. Con `effectiveEnd` conocido se limita al 40% del tema; sin él
     * (final natural, avance del servidor) se usa la configuración tal cual.
     *
     * Con los valores normales no cambia nada: 6 s de anticipación en un tema de
     * 3 minutos siguen siendo 6 s. Sólo muerde en el caso patológico — un short
     * de 20 s con la anticipación en 30.
     */
    const ventanaDeCruce = (effectiveEnd) => {
      const techo = Math.max(1, rainAnticipationRef.current) * 1000;
      if (!(effectiveEnd > 0)) return techo;
      return Math.max(1000, Math.min(techo, effectiveEnd * 400));
    };

    const runOutro = (sourceItem) => {
      setRainPhase("entering");
      later(() => setRainPhase("static"), 450);
      const index = activeIndexRef.current;
      const volume = sourceItem?.youtube_volume ?? 100;
      debug(`Crossfade out — player ${index === 0 ? "A" : "B"} ${volume} → 0 en ${crossfadeMsRef.current}ms`);
      fadeVolume(index, playersRef.current[index], volume, 0, crossfadeMsRef.current);
    };

    /**
     * La transición no prosperó (el servidor rechazó el avance). Se devuelve el
     * saliente a su volumen y se lo asegura sonando: sin esto quedaba pausado y
     * mudo con la lluvia ya apagada, que es una pantalla congelada en silencio.
     */
    const undoOutro = (sourceItem) => {
      const index  = activeIndexRef.current;
      const player = playersRef.current[index];
      const volume = sourceItem?.youtube_volume ?? 100;
      cancelFade(index);
      try {
        player?.setVolume(volume);
        if (safeState(player) !== YT_STATE.PLAYING) player?.playVideo();
      } catch { /* noop */ }
      debug(`Crossfade abortado — player ${index === 0 ? "A" : "B"} vuelve a ${volume}`);
    };

    /**
     * Fin de la canción actual pedido POR LA TV (final natural o crossfade).
     * Idempotente: para un item sólo puede correr una vez.
     */
    const startTransition = async (itemId, reason, extra = {}) => {
      if (transitionRef.current)           { logBlocked(reason, itemId, activeIndexRef.current, "transition-already-active", extra); return; }
      if (advancedRef.current.has(itemId)) { logBlocked(reason, itemId, activeIndexRef.current, "already-advanced", extra); return; }
      if (itemId !== displayedItemRef.current?.id) { logBlocked(reason, itemId, activeIndexRef.current, "not-displayed-item", extra); return; }

      const sourceItem = displayedItemRef.current;
      const transition = {
        sourceId: itemId, targetId: null, targetIndex: null, startedAt: Date.now(), reason,
      };
      transitionRef.current = transition;
      setPhase("TRANSITIONING");
      // La ventana se fija ACÁ y no se vuelve a leer: si el DJ cambia la
      // anticipación en mitad de un cruce, este cruce termina con la que empezó.
      crossfadeMsRef.current = ventanaDeCruce(extra.effectiveEnd);
      runOutro(sourceItem);

      const ok = await requestAdvance(reason, itemId, activeIndexRef.current, extra);
      if (!ok && transitionRef.current === transition && !transition.targetId) {
        // No se pudo avanzar: se deshace la transición y sigue mandando el realtime.
        transitionRef.current = null;
        undoOutro(sourceItem);
        setRainPhase("idle");
        setPhase(displayedItemRef.current ? "PLAYING" : "WAITING_NEXT");
      }
    };

    /** El servidor ya cambió de canción (skip del DJ o kick). Sólo acompañamos. */
    const beginExternalTransition = (sourceItemId) => {
      transitionRef.current = {
        sourceId: sourceItemId, targetId: null, targetIndex: null,
        startedAt: Date.now(), reason: REASON.EXTERNAL,
      };
      setPhase("TRANSITIONING");
      crossfadeMsRef.current = ventanaDeCruce(0);
      logAdvance(REASON.EXTERNAL, sourceItemId, activeIndexRef.current, {
        source: "servidor (manual-admin | kick-threshold)",
      });
      runOutro(displayedItemRef.current);
    };

    const finishSwap = (index) => {
      const transition = transitionRef.current;
      const slot = slotsRef.current[index];
      if (!transition || transition.targetIndex !== index) return;
      if (!slot.itemId || transition.targetId !== slot.itemId) return;

      const item      = slot.item;
      const elapsed   = Date.now() - transition.startedAt;
      const remaining = Math.max(0, crossfadeMsRef.current - elapsed);
      const volume    = item.youtube_volume ?? 100;

      // El entrante sube YA, en paralelo con la bajada del saliente: eso es lo
      // que hace que sea un crossfade y no dos fades con un hueco en el medio.
      // Antes esta rampa esperaba a que terminara la ventana entera.
      debug(`Crossfade in — player ${index === 0 ? "A" : "B"} 0 → ${volume} en ${Math.max(800, remaining)}ms`);
      fadeVolume(index, playersRef.current[index], 0, volume, Math.max(800, remaining));

      later(() => {
        if (transitionRef.current !== transition) return;
        const previousIndex = activeIndexRef.current;
        activeIndexRef.current   = index;
        displayedItemRef.current = item;
        slotsRef.current[index].role     = "current";
        slotsRef.current[1 - index].role = "idle";
        setVisiblePlayer(index);
        // El saliente ya llegó a 0 con su propia rampa: recién ahora se pausa.
        // Esto NO se demora con la cola de lluvia: dejar el video anterior
        // corriendo detrás de la lluvia sería un segundo audio en silencio.
        cancelFade(previousIndex);
        try { playersRef.current[previousIndex]?.pauseVideo(); } catch { /* noop */ }
        later(() => { setRainPhase("leaving"); later(() => setRainPhase("idle"), 700); }, rainTailRef.current * 1000);
        transitionRef.current = null;
        skipStreakRef.current = 0;
        watchTicksRef.current = { itemId: null, hits: 0 };
        setPlayerError(null);
        setPhase("PLAYING");
        debug(`Switching ${index === 0 ? "B → A" : "A → B"}`, item.id);
      }, remaining);
    };

    // ── Carga de video ──────────────────────────────────────────────────────
    /**
     * Venció el timeout de carga. Un timeout técnico NO es "la canción terminó":
     * primero se comprueba si el player en realidad ya tiene el video.
     */
    const onLoadTimeout = (index, itemId) => {
      const slot   = slotsRef.current[index];
      const player = playersRef.current[index];
      if (!slot || slot.itemId !== itemId) return;   // el player ya está en otra cosa
      slot.timeout = null;

      const state    = safeState(player);
      const duration = safeDuration(player);

      if (state === YT_STATE.PLAYING || state === YT_STATE.BUFFERING) {
        slot.started = true;               // está sonando: acá no pasó nada
        return;
      }
      if (duration > 0 && !slot.retried) {
        // El video cargó pero no arrancó solo (autoplay). Se lo empuja una vez.
        slot.retried = true;
        try { player.playVideo(); } catch { /* noop */ }
        slot.timeout = later(() => onLoadTimeout(index, itemId), LOAD_TIMEOUT_MS);
        return;
      }
      onSlotFailure(index, itemId, "load-timeout");
    };

    /**
     * Un player no pudo reproducir su item. Punto único donde se decide si eso
     * afecta o no a la canción actual.
     */
    const onSlotFailure = (index, itemId, kind) => {
      const slot = slotsRef.current[index];
      if (!slot || slot.itemId !== itemId) return;    // evento de un item viejo
      clearSlotTimeout(index);
      unplayableRef.current.add(itemId);
      console.error("[TV] video no reproducible", { itemId, playerIndex: index, kind });

      if (!ownsCurrent(index, itemId)) {
        // STANDBY_FAILED: el player que no está sonando no puede terminar nada.
        // Se marca sólo ese candidato como no reproducible y la actual sigue.
        logBlocked(kind === "load-timeout" ? REASON.STANDBY_TIMEOUT : REASON.STANDBY_FAILED,
                   itemId, index, "not-the-current-player", { kind });
        slot.itemId = null; slot.item = null; slot.role = "idle"; slot.started = false;
        return;
      }

      skipStreakRef.current += 1;
      if (skipStreakRef.current > MAX_SKIPS_IN_A_ROW) {
        setPhase("ERROR");
        setRainPhase("static");
        setPlayerError({ code: kind, message: "No se encontraron videos reproducibles después de varios intentos." });
        logBlocked(REASON.CURRENT_LOAD, itemId, index, "max-skips-reached", { kind });
        return;
      }

      setRainPhase("static");
      const reason = kind === "load-timeout"   ? REASON.CURRENT_TIMEOUT
                   : kind === "playback-error" ? REASON.CURRENT_PLAY
                   : REASON.CURRENT_LOAD;
      requestAdvance(reason, itemId, index, { kind });
    };

    const loadIntoSlot = (index, item, asCurrent) => {
      const player = playersRef.current[index];
      const slot   = slotsRef.current[index];
      if (!player || !readyRef.current[index]) return false;

      clearSlotTimeout(index);
      slot.itemId  = item.id;
      slot.item    = item;
      slot.role    = asCurrent ? "current" : "standby";
      slot.started = false;
      slot.retried = false;

      if (!item.youtube_id) { onSlotFailure(index, item.id, "missing-video-id"); return false; }
      try {
        player.setVolume(asCurrent ? (item.youtube_volume ?? 100) : 0);
        player.loadVideoById(videoOptions(item));
      } catch (error) {
        console.error("[TV] fallo al cargar el video", error);
        onSlotFailure(index, item.id, "load-exception");
        return false;
      }
      debug(`Loading Player ${index === 0 ? "A" : "B"} (${slot.role})`, item.id, item.youtube_id);
      slot.timeout = later(() => onLoadTimeout(index, item.id), LOAD_TIMEOUT_MS);
      return true;
    };

    // ── Eventos de YouTube ──────────────────────────────────────────────────
    const onPlayerPlaying = (index) => {
      const slot = slotsRef.current[index];
      if (!slot.itemId) return;                       // player vacío: no significa nada
      clearSlotTimeout(index);
      slot.started = true;
      unplayableRef.current.delete(slot.itemId);

      const transition = transitionRef.current;
      if (transition && transition.targetIndex === index && transition.targetId === slot.itemId) {
        finishSwap(index);
        return;
      }
      if (index === activeIndexRef.current && slot.itemId === displayedItemRef.current?.id) {
        // Arranque en frío de la canción actual.
        skipStreakRef.current = 0;
        setPlayerError(null);
        setPhase("PLAYING");
        later(() => { setRainPhase("leaving"); later(() => setRainPhase("idle"), 700); }, rainTailRef.current * 1000);
      }
    };

    /**
     * ENDED sólo vale si viene del player ACTIVO **y** el video que terminó es
     * realmente `current_item_id`. Comparar el índice no alcanza.
     */
    const onPlayerEnded = (index) => {
      const slot   = slotsRef.current[index];
      const itemId = slot.itemId;
      if (index !== activeIndexRef.current) {
        logBlocked(REASON.INACTIVE_PLAYER, itemId, index, "not-the-active-player"); return;
      }
      if (!itemId || itemId !== displayedItemRef.current?.id) {
        logBlocked(REASON.STALE_ENDED, itemId, index, "player-item-is-not-displayed"); return;
      }
      if (itemId !== latestCurrentRef.current?.id) {
        logBlocked(REASON.STALE_ENDED, itemId, index, "player-item-is-not-current"); return;
      }
      startTransition(itemId, REASON.NATURAL_ENDED);
    };

    const onPlayerError = (index, code) => {
      const slot = slotsRef.current[index];
      // Un player sin video cargado (el standby recién inicializado) no puede
      // marcar como terminada la canción que está sonando en el otro.
      if (!slot.itemId) {
        logBlocked(REASON.STANDBY_FAILED, null, index, "empty-player", { code }); return;
      }
      onSlotFailure(index, slot.itemId, slot.started ? "playback-error" : `youtube-error-${code}`);
    };

    // ── Reacción al current_item_id de la base ──────────────────────────────
    const startCurrent = (item) => {
      const index = activeIndexRef.current;
      displayedItemRef.current = item;
      watchTicksRef.current = { itemId: null, hits: 0 };
      setVisiblePlayer(index);
      setRainPhase("static");
      setPhase("LOADING_CURRENT");
      debug("Playing initial item", item.id, item.youtube_id);
      loadIntoSlot(index, item, true);
    };

    const prepareNext = (item) => {
      const index = 1 - activeIndexRef.current;
      const transition = transitionRef.current;
      if (transition) { transition.targetId = item.id; transition.targetIndex = index; }
      if (unplayableRef.current.has(item.id)) debug("reintentando un item ya marcado como no reproducible", item.id);
      setPhase("PREPARING_NEXT");
      loadIntoSlot(index, item, false);
    };

    /**
     * Un cambio REAL de `pantalla_events.current_item_id`. Un refresh de datos,
     * un voto, una reacción o un rerender llegan acá con el mismo id y no hacen
     * absolutamente nada.
     */
    const handleCurrent = (item) => {
      if (!readyRef.current.every(Boolean)) return;

      if (!item) {
        const activePlayer = playersRef.current[activeIndexRef.current];
        try { activePlayer?.pauseVideo(); } catch { /* noop */ }
        displayedItemRef.current = null;
        transitionRef.current = null;
        setRainPhase("static");
        setPhase("WAITING_NEXT");
        return;
      }

      const displayed = displayedItemRef.current;
      if (!displayed) { startCurrent(item); return; }
      if (item.id === displayed.id) return;   // mismo tema: no es una orden de avanzar

      // El servidor cambió de canción: la anterior ya no puede pedir nada más.
      advancedRef.current.add(displayed.id);
      if (!transitionRef.current) beginExternalTransition(displayed.id);
      prepareNext(item);
    };

    // ── Arranque de los dos players ─────────────────────────────────────────
    loadYouTubeApi().then((YT) => {
      if (cancelled) return;
      TV_PLAYER_IDS.forEach((id, index) => {
        playersRef.current[index] = new YT.Player(id, {
          width: "100%", height: "100%",
          playerVars: { autoplay: 1, controls: 0, modestbranding: 1, rel: 0, iv_load_policy: 3, fs: 0, disablekb: 1, playsinline: 1 },
          events: {
            onReady: () => {
              readyRef.current[index] = true;
              setReadyCount(readyRef.current.filter(Boolean).length);
              debug(`Player ${index === 0 ? "A" : "B"} ready`);
              if (readyRef.current.every(Boolean)) handleCurrent(latestCurrentRef.current);
            },
            onStateChange: (event) => {
              // PAUSED / CUED / BUFFERING / UNSTARTED nunca avanzan nada.
              if (event.data === YT.PlayerState.PLAYING) onPlayerPlaying(index);
              else if (event.data === YT.PlayerState.ENDED) onPlayerEnded(index);
            },
            onError: (event) => onPlayerError(index, event.data),
          },
        });
      });
    }).catch((error) => setPlayerError({ code: "api", message: error.message }));

    // ── Reloj del crossfade ─────────────────────────────────────────────────
    const watcher = setInterval(() => {
      const ticks  = watchTicksRef.current;
      const index  = activeIndexRef.current;
      const item   = displayedItemRef.current;
      const slot   = slotsRef.current[index];
      const player = playersRef.current[index];

      if (phaseRef.current !== "PLAYING" || transitionRef.current || !item || !player) {
        ticks.itemId = null; ticks.hits = 0; return;
      }
      // El reloj sólo vale para el player ACTIVE reproduciendo el current real.
      if (slot.itemId !== item.id || item.id !== latestCurrentRef.current?.id) return;
      if (advancedRef.current.has(item.id)) return;
      if (safeState(player) !== YT_STATE.PLAYING) { ticks.hits = 0; return; }

      const duration = safeDuration(player);
      const time     = safeTime(player);
      if (!(duration > 0) || !(time > 0)) { ticks.hits = 0; return; }

      const effectiveEnd = effectiveEndOf(item, duration);
      if (!(effectiveEnd > time)) { ticks.hits = 0; return; }   // lecturas no confiables

      const remaining = effectiveEnd - time;
      // Mismo cálculo que usará el cruce: acotado al largo real del tema, para
      // que un video más corto que la anticipación no dispare el cambio apenas
      // arranca. Sin esto, un short de 20 s con la anticipación en 30 pasaría de
      // tema a los ~800 ms de empezar a sonar.
      if (remaining * 1000 > ventanaDeCruce(effectiveEnd)) { ticks.itemId = item.id; ticks.hits = 0; return; }

      // Dos muestras seguidas antes de creerle: una lectura suelta del player
      // (publicidad, buffering, cambio de video) no puede cortar la canción.
      if (ticks.itemId !== item.id) { ticks.itemId = item.id; ticks.hits = 1; return; }
      ticks.hits += 1;
      if (ticks.hits < CONFIRM_TICKS) return;

      debug(`Remaining ${remaining.toFixed(1)}s — transition start`, item.id);
      startTransition(item.id, REASON.CROSSFADE, { duration, currentTime: time, effectiveEnd, remaining });
    }, WATCH_MS);

    // ── Reporte de progreso (nunca decide nada) ─────────────────────────────
    const reporter = setInterval(() => {
      const index  = activeIndexRef.current;
      const player = playersRef.current[index];
      const item   = displayedItemRef.current;
      if (!player || !item || slotsRef.current[index].itemId !== item.id) return;
      tvReport(eventId, token, safeTime(player), effectiveEndOf(item, safeDuration(player))).catch(() => {});
    }, REPORT_MS);

    controllerRef.current = { handleCurrent };

    return () => {
      cancelled = true;
      clearInterval(watcher);
      clearInterval(reporter);
      effectTimers.forEach((timer) => { clearTimeout(timer); clearInterval(timer); });
      effectTimers.clear();
      playersRef.current.forEach((player) => { try { player?.destroy(); } catch { /* noop */ } });
      playersRef.current = [null, null];
      readyRef.current   = [false, false];
      slotsRef.current   = [emptySlot(), emptySlot()];
      fadesRef.current   = [null, null];
      effectFails.clear();
      transitionRef.current    = null;
      displayedItemRef.current = null;
      phaseRef.current = "IDLE";
      controllerRef.current = null;
    };
  }, [eventId, later, token, unlocked]);

  useEffect(() => { controllerRef.current?.handleCurrent(current); }, [current]);

  return { playerIds: TV_PLAYER_IDS, visiblePlayer, rainPhase, playerError, readyCount };
}
