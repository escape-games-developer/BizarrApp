import { useState, useEffect, useRef } from "react";
import { STROBE_COLORS } from "../constants/data";

// Segundos de estroboscópico antes de que el servidor elija ganador.
export const RAFFLE_COUNTDOWN_S = 10;

/**
 * Segundos que faltan, anclados en `game_state.updated_at`.
 *
 * El trigger `game_state_updated_at` (BEFORE UPDATE) deja en `updated_at` la
 * hora del UPDATE que puso `raffle_state='launched'`, así que la cuenta
 * regresiva se reconstruye sola después de un refresh en cualquiera de las
 * tres pantallas — no hay un setInterval local haciendo de fuente de verdad.
 *
 * Contrapartida conocida: un UPDATE de `game_state` ajeno al sorteo durante
 * esos 10s (zócalo, audio) reinicia el número en pantalla. No afecta al
 * resultado: al ganador lo elige el servidor, no el contador.
 */
export function raffleCountdown(updatedAt) {
  if (!updatedAt) return RAFFLE_COUNTDOWN_S;
  const startedAt = new Date(updatedAt).getTime();
  if (Number.isNaN(startedAt)) return RAFFLE_COUNTDOWN_S;
  const remaining = RAFFLE_COUNTDOWN_S - (Date.now() - startedAt) / 1000;
  return Math.max(0, Math.min(RAFFLE_COUNTDOWN_S, Math.ceil(remaining)));
}

/**
 * Motivo PÚBLICO de una ronda cancelada.
 *
 * Traduce `game_state.raffle_cancel` a una frase para el bar. Nunca devuelve el
 * código, ni contadores, ni nada interno: la Pantalla Gigante y el celular del
 * cliente no son el lugar para explicar la configuración del sorteo. Los
 * números (4 de 5 conectados) van sólo al Admin, que los sabe interpretar.
 *
 * El `default` no es un descuido: si mañana el backend agrega un rechazo nuevo,
 * la pantalla dice algo digno en vez de quedarse muda o mostrar un code.
 */
export function motivoCancelacionPublico(cancel) {
  switch (cancel?.code) {
    case "MIN_PARTICIPANTS":
      return "No hay suficientes participantes para realizar el sorteo.";
    case "NO_ELIGIBLE_PARTICIPANTS":
      return "No quedan participantes elegibles para este sorteo.";
    case "RAFFLE_CONFIG_INCOMPLETE":
      return "El sorteo no está configurado para realizarse.";
    default:
      return "El sorteo no se pudo realizar.";
  }
}

/**
 * useRaffle
 *
 * Deriva TODO de `game_state`: la fase, el ganador, el premio y la cuenta
 * regresiva son los de Supabase. Lo único local es la animación del
 * estroboscópico. No hay estado paralelo que pueda desincronizarse del
 * servidor ni perderse en un refresh.
 *
 * `cancelled` es el desenlace SIN ganador de una ronda que ya había arrancado:
 * el backend rechazó la resolución definitiva por una condición operativa (se
 * cayó gente durante el estroboscópico, se agotaron los elegibles, falta
 * configuración). Como `isStrobe` sale de `state === 'launched'`, esa transición
 * apaga el estroboscópico en las TRES pantallas sin ninguna lógica extra: es la
 * misma fuente de verdad que lo había encendido.
 */
export function useRaffle(gameState) {
  const state     = gameState?.raffle_state ?? "idle";   // idle | launched | winner | cancelled
  const updatedAt = gameState?.updated_at ?? null;
  const isStrobe  = state === "launched";
  const isWinner  = state === "winner";
  const isCancelled = state === "cancelled";
  const cancel    = isCancelled ? (gameState?.raffle_cancel ?? null) : null;

  const [cd,    setCd]    = useState(() => raffleCountdown(updatedAt));
  const [color, setColor] = useState("#000");
  const [dark,  setDark]  = useState(true);
  const idxRef  = useRef(0);
  const darkRef = useRef(true);

  useEffect(() => {
    if (!isStrobe) {
      darkRef.current = true;
      setDark(true); setColor("#000"); setCd(RAFFLE_COUNTDOWN_S);
      return undefined;
    }
    setCd(raffleCountdown(updatedAt));
    const strobe = setInterval(() => {
      darkRef.current = !darkRef.current;
      setDark(darkRef.current);
      setColor(darkRef.current
        ? "#000"
        : STROBE_COLORS[idxRef.current++ % STROBE_COLORS.length]);
    }, 130);
    // 250ms: el número baja de a un segundo igual, pero se reengancha rápido
    // si la pestaña estuvo en segundo plano.
    const tick = setInterval(() => setCd(raffleCountdown(updatedAt)), 250);
    return () => { clearInterval(strobe); clearInterval(tick); };
  }, [isStrobe, updatedAt]);

  const winner = isWinner && gameState?.raffle_winner_id
    ? {
        id:    gameState.raffle_winner_id,
        name:  gameState.raffle_winner_name,
        prize: gameState.raffle_prize,
      }
    : null;

  return {
    state, cd, color, dark, winner,
    prize: gameState?.raffle_prize ?? null,
    isIdle:   state === "idle",
    isStrobe,
    isWinner,
    isCancelled,
    cancel,                                        // crudo, para el Admin
    cancelMessage: isCancelled ? motivoCancelacionPublico(cancel) : null,
  };
}
