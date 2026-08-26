import { useCallback, useEffect, useRef, useState } from "react";
import { tvReport, tvSongEnded } from "../services/pantallaDj";
import { loadYouTubeApi, safeDuration, safeTime } from "./youtubeApi";

export const TV_TRANSITION_SECONDS = 6;
export const TV_TRANSITION_MS = TV_TRANSITION_SECONDS * 1000;
export const TV_PLAYER_IDS = ["pantalla-tv-player-a", "pantalla-tv-player-b"];

const WATCH_MS = 400;
const REPORT_MS = 4000;
const LOAD_TIMEOUT_MS = 12000;
const MAX_CONSECUTIVE_ERRORS = 5;
const debug = (...args) => { if (import.meta.env.DEV) console.info("[TV]", ...args); };

const videoOptions = (item) => ({
  videoId: item.youtube_id,
  startSeconds: item.trim_start_seconds || 0,
  ...(item.trim_end_seconds ? { endSeconds: item.trim_end_seconds } : {}),
});

export function useContinuousTvPlayers({ current, eventId, token, unlocked }) {
  const [visiblePlayer, setVisiblePlayer] = useState(0);
  const [rainPhase, setRainPhase] = useState("idle");
  const [playerError, setPlayerError] = useState(null);
  const [readyCount, setReadyCount] = useState(0);

  const playersRef = useRef([null, null]);
  const readyRef = useRef([false, false]);
  const activeIndexRef = useRef(0);
  const displayedItemRef = useRef(null);
  const latestCurrentRef = useRef(current);
  const transitionRef = useRef(null);
  const handledItemsRef = useRef(new Set());
  const pendingRef = useRef(null);
  const controllerRef = useRef(null);
  const timersRef = useRef(new Set());
  const errorCountRef = useRef(0);

  latestCurrentRef.current = current;

  const later = useCallback((fn, delay) => {
    const timer = setTimeout(() => { timersRef.current.delete(timer); fn(); }, delay);
    timersRef.current.add(timer);
    return timer;
  }, []);

  useEffect(() => {
    if (!unlocked || !eventId) return;
    let cancelled = false;
    const effectTimers = timersRef.current;

    const clearPendingTimeout = () => {
      if (!pendingRef.current?.timeout) return;
      clearTimeout(pendingRef.current.timeout);
      timersRef.current.delete(pendingRef.current.timeout);
    };

    const fadeVolume = (player, from, to, duration, done) => {
      const steps = 5;
      let step = 0;
      try { player.setVolume(from); } catch { /* player todavía no listo */ }
      const interval = setInterval(() => {
        step += 1;
        try { player.setVolume(Math.round(from + ((to - from) * step) / steps)); } catch { /* noop */ }
        if (step >= steps) {
          clearInterval(interval);
          timersRef.current.delete(interval);
          done?.();
        }
      }, duration / steps);
      timersRef.current.add(interval);
    };

    const recoverFromFailedItem = async (item, code) => {
      clearPendingTimeout();
      pendingRef.current = null;
      setRainPhase("static");
      errorCountRef.current += 1;
      console.error("[TV] video no reproducible", { itemId: item?.id, videoId: item?.youtube_id, code });
      if (errorCountRef.current > MAX_CONSECUTIVE_ERRORS) {
        setPlayerError({ code, message: "No se encontraron videos reproducibles después de varios intentos." });
        return;
      }
      if (!item?.id || handledItemsRef.current.has(item.id)) return;
      handledItemsRef.current.add(item.id);
      transitionRef.current = { sourceId: item.id, targetId: null, startedAt: Date.now() };
      try {
        debug("saltando item con error", item.id);
        await tvSongEnded(eventId, token, item.id);
      } catch (error) {
        console.error("[TV] no se pudo avanzar tras error", error);
        setPlayerError({ code, message: "No se pudo solicitar el siguiente tema." });
      }
    };

    const finishSwap = (target) => {
      const transition = transitionRef.current;
      if (!transition || transition.targetId !== target.item.id) return;
      clearPendingTimeout();
      pendingRef.current = null;
      const elapsed = Date.now() - transition.startedAt;
      later(() => {
        const targetPlayer = playersRef.current[target.index];
        activeIndexRef.current = target.index;
        displayedItemRef.current = target.item;
        handledItemsRef.current.delete(target.item.id);
        setVisiblePlayer(target.index);
        setRainPhase("leaving");
        fadeVolume(targetPlayer, 0, target.item.youtube_volume ?? 100, 1000);
        later(() => setRainPhase("idle"), 700);
        transitionRef.current = null;
        errorCountRef.current = 0;
        setPlayerError(null);
        debug(`Switching ${target.index === 0 ? "B → A" : "A → B"}`);
        debug("Transition complete", target.item.id);
      }, Math.max(0, TV_TRANSITION_MS - elapsed));
    };

    const loadTarget = (item) => {
      if (!item?.youtube_id) return recoverFromFailedItem(item, 2);
      const transition = transitionRef.current;
      if (!transition || transition.targetId === item.id) return;
      transition.targetId = item.id;
      const index = 1 - activeIndexRef.current;
      const player = playersRef.current[index];
      if (!readyRef.current[index] || !player) return;
      clearPendingTimeout();
      const target = { item, index, timeout: null };
      pendingRef.current = target;
      debug("New current item received", item.id);
      debug(`Loading standby Player ${index === 0 ? "A" : "B"}`, item.youtube_id);
      try {
        player.setVolume(0);
        player.loadVideoById(videoOptions(item));
        target.timeout = later(() => recoverFromFailedItem(item, "timeout"), LOAD_TIMEOUT_MS);
      } catch (error) {
        console.error("[TV] fallo al cargar standby", error);
        recoverFromFailedItem(item, "load");
      }
    };

    const startTransition = async (sourceItem, requestAdvance) => {
      if (!sourceItem?.id || handledItemsRef.current.has(sourceItem.id)) return;
      handledItemsRef.current.add(sourceItem.id);
      transitionRef.current = { sourceId: sourceItem.id, targetId: null, startedAt: Date.now() };
      setRainPhase("entering");
      later(() => setRainPhase("static"), 450);
      const activePlayer = playersRef.current[activeIndexRef.current];
      const volume = sourceItem.youtube_volume ?? 100;
      fadeVolume(activePlayer, volume, 0, 1000, () => {
        try { activePlayer.pauseVideo(); } catch { /* noop */ }
      });
      if (!requestAdvance) return;
      debug("Advancing event", sourceItem.id);
      try { await tvSongEnded(eventId, token, sourceItem.id); }
      catch (error) {
        console.error("[TV] avance rechazado", error);
        transitionRef.current = null;
        setRainPhase("idle");
      }
    };

    const loadInitial = (item) => {
      if (!item?.youtube_id || !readyRef.current[0] || displayedItemRef.current) return;
      const player = playersRef.current[0];
      displayedItemRef.current = item;
      handledItemsRef.current.delete(item.id);
      activeIndexRef.current = 0;
      setVisiblePlayer(0);
      setRainPhase("static");
      pendingRef.current = { item, index: 0, initial: true, timeout: null };
      debug("Playing initial item", item.id, item.youtube_id);
      player.setVolume(item.youtube_volume ?? 100);
      player.loadVideoById(videoOptions(item));
      pendingRef.current.timeout = later(() => recoverFromFailedItem(item, "timeout"), LOAD_TIMEOUT_MS);
    };

    const handleCurrent = (item) => {
      if (!readyRef.current.every(Boolean)) return;
      if (!item) {
        const activePlayer = playersRef.current[activeIndexRef.current];
        try { activePlayer?.pauseVideo(); } catch { /* noop */ }
        displayedItemRef.current = null;
        transitionRef.current = null;
        setRainPhase("static");
        return;
      }
      if (!displayedItemRef.current) { loadInitial(item); return; }
      if (item.id === displayedItemRef.current.id) return;
      if (!transitionRef.current) startTransition(displayedItemRef.current, false);
      loadTarget(item);
    };

    controllerRef.current = { handleCurrent, startTransition, finishSwap, recoverFromFailedItem };

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
              if (event.data === YT.PlayerState.PLAYING) {
                const pending = pendingRef.current;
                if (pending?.index !== index) return;
                debug(`Player ${index === 0 ? "A" : "B"} playing`, pending.item.id);
                if (pending.initial) {
                  clearPendingTimeout();
                  pendingRef.current = null;
                  setRainPhase("leaving");
                  later(() => setRainPhase("idle"), 700);
                } else finishSwap(pending);
              }
              if (event.data === YT.PlayerState.ENDED) {
                const displayed = displayedItemRef.current;
                if (index === activeIndexRef.current && displayed) startTransition(displayed, true);
              }
            },
            onError: (event) => {
              const pending = pendingRef.current;
              const item = pending?.index === index ? pending.item : displayedItemRef.current;
              recoverFromFailedItem(item, event.data);
            },
          },
        });
      });
    }).catch((error) => setPlayerError({ code: "api", message: error.message }));

    const watcher = setInterval(() => {
      const item = displayedItemRef.current;
      const player = playersRef.current[activeIndexRef.current];
      if (!item || !player || transitionRef.current || handledItemsRef.current.has(item.id)) return;
      const duration = safeDuration(player);
      const time = safeTime(player);
      if (duration > 0 && duration - time <= TV_TRANSITION_SECONDS) {
        debug(`Remaining ${(duration - time).toFixed(1)}s — transition start`, item.id);
        startTransition(item, true);
      }
    }, WATCH_MS);

    const reporter = setInterval(() => {
      const player = playersRef.current[activeIndexRef.current];
      if (player) tvReport(eventId, token, safeTime(player), safeDuration(player)).catch(() => {});
    }, REPORT_MS);

    return () => {
      cancelled = true;
      clearInterval(watcher);
      clearInterval(reporter);
      effectTimers.forEach((timer) => { clearTimeout(timer); clearInterval(timer); });
      effectTimers.clear();
      playersRef.current.forEach((player) => { try { player?.destroy(); } catch { /* noop */ } });
      playersRef.current = [null, null];
      readyRef.current = [false, false];
      controllerRef.current = null;
    };
  }, [eventId, later, token, unlocked]);

  useEffect(() => { controllerRef.current?.handleCurrent(current); }, [current]);

  return { playerIds: TV_PLAYER_IDS, visiblePlayer, rainPhase, playerError, readyCount };
}
