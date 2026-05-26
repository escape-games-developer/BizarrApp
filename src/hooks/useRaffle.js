import { useState, useRef, useCallback, useEffect } from "react";
import { STROBE_COLORS, RAFFLE_NAMES } from "../constants/data";
import { rand } from "../constants/theme";

/**
 * useRaffle
 * Encapsula toda la lógica del Rey del Orto.
 * El componente solo necesita renderizar según el estado.
 */
export function useRaffle() {
  const [state,   setState]   = useState("idle");   // "idle" | "strobe" | "winner"
  const [cd,      setCd]      = useState(10);
  const [color,   setColor]   = useState("#000");
  const [dark,    setDark]    = useState(true);
  const [winner,  setWinner]  = useState(null);
  const [prize,   setPrize]   = useState("Consumición libre para dos");

  const strobeRef = useRef(null);
  const cdRef     = useRef(null);
  const idxRef    = useRef(0);

  const stop = useCallback(() => {
    clearInterval(strobeRef.current);
    clearInterval(cdRef.current);
  }, []);

  // Limpiar timers al desmontar
  useEffect(() => () => stop(), [stop]);

  const launch = useCallback(() => {
    stop();
    setState("strobe");
    setCd(10);
    setWinner(null);
    setDark(true);
    setColor("#000");

    let remaining = 10;
    let isDark    = true;

    strobeRef.current = setInterval(() => {
      isDark = !isDark;
      setDark(isDark);
      setColor(
        isDark
          ? "#000"
          : STROBE_COLORS[idxRef.current++ % STROBE_COLORS.length]
      );
    }, 130);

    cdRef.current = setInterval(() => {
      remaining--;
      setCd(remaining);
      if (remaining <= 0) {
        stop();
        setDark(false);
        setColor("#22C55E");
        setTimeout(() => {
          setWinner(RAFFLE_NAMES[rand(0, RAFFLE_NAMES.length - 1)]);
          setState("winner");
        }, 400);
      }
    }, 1_000);
  }, [stop]);

  const reset = useCallback(() => {
    stop();
    setState("idle");
    setWinner(null);
    setCd(10);
    setColor("#000");
    setDark(true);
  }, [stop]);

  return {
    state, cd, color, dark, winner,
    prize, setPrize,
    launch, reset,
    isIdle:   state === "idle",
    isStrobe: state === "strobe",
    isWinner: state === "winner",
  };
}
