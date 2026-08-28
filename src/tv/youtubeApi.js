/**
 * Carga perezosa de la YouTube IFrame API.
 *
 * La PantallaGigante actual usa un `<iframe>` de embed plano, que no avisa
 * cuándo termina el video. La TV del módulo Pantalla/Escenario necesita ese
 * evento para encadenar canciones sola, así que carga la API real.
 */

let promesa = null;

export function loadYouTubeApi() {
  if (window.YT?.Player) {
    console.info("[TV] YouTube API ya disponible");
    return Promise.resolve(window.YT);
  }
  if (promesa) return promesa;

  promesa = new Promise((resolve, reject) => {
    // Puede haber otro consumidor esperando el mismo callback global.
    const anterior = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      anterior?.();
      console.info("[TV] YouTube IFrame API lista");
      resolve(window.YT);
    };

    const existente = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!existente) {
      const script = document.createElement("script");
      script.src   = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => {
        promesa = null;
        reject(new Error("No se pudo cargar la API de YouTube"));
      };
      document.head.appendChild(script);
    }
  });

  return promesa;
}

/** Estados de YT.PlayerState, por valor: la API puede no estar cargada todavía. */
export const YT_STATE = {
  UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5,
};

/** Segundos transcurridos, tolerante a un player todavía no inicializado. */
export function safeTime(player) {
  try {
    const value = player?.getCurrentTime?.();
    return Number.isFinite(value) ? value : 0;
  } catch { return 0; }
}

export function safeDuration(player) {
  try {
    const value = player?.getDuration?.();
    return Number.isFinite(value) ? value : 0;
  } catch { return 0; }
}

/**
 * Estado real del player. Devuelve UNSTARTED cuando todavía no responde, para
 * que quien decida avanzar nunca confunda "no sé" con "terminó".
 */
export function safeState(player) {
  try {
    const value = player?.getPlayerState?.();
    return Number.isFinite(value) ? value : YT_STATE.UNSTARTED;
  } catch { return YT_STATE.UNSTARTED; }
}
