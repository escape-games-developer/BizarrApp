import { useSyncExternalStore } from "react";

/**
 * Qué juegos tienen ahora mismo una pantalla del editor en la TV. Una pantalla
 * editada trae su propio QR (elemento ocultable): mientras está montada, el QR
 * que la TV le agrega por fuera a cada juego (QrDeJuego) no se dibuja, para no
 * duplicarlo ni impedir ocultarlo.
 */

const activos = new Map();   // juego → cantidad de lienzos montados
const subs = new Set();
const avisar = () => subs.forEach((fn) => fn());

export function marcarLienzo(juego, on) {
  activos.set(juego, Math.max(0, (activos.get(juego) || 0) + (on ? 1 : -1)));
  avisar();
}

export function useLienzoActivo(juego) {
  return useSyncExternalStore(
    (fn) => { subs.add(fn); return () => subs.delete(fn); },
    () => (activos.get(juego) || 0) > 0,
  );
}
