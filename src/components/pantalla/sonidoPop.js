/**
 * «Pop» corto y sutil del celular al votar o reaccionar en DJ Democracy
 * (Editor → Reglas de votación → «Sonido al votar/reaccionar»).
 *
 * Se sintetiza con Web Audio —una nota que cae en ~120 ms— en vez de bajar un
 * archivo: no pesa nada y suena al instante. El contexto de audio se crea con
 * el primer toque (los navegadores sólo dejan sonar después de una interacción).
 */
let contexto = null;

export function sonarPop() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    contexto = contexto || new Ctx();
    if (contexto.state === "suspended") contexto.resume();
    const t = contexto.currentTime;
    const osc = contexto.createOscillator();
    const vol = contexto.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.09);
    vol.gain.setValueAtTime(0.12, t);
    vol.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(vol).connect(contexto.destination);
    osc.start(t);
    osc.stop(t + 0.13);
  } catch { /* sin audio: el voto sigue igual */ }
}
