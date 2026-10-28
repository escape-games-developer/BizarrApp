/**
 * Cómo elige la tablet del Anfitrión qué frase decirle a cada participante.
 * Las frases viven en las bibliotecas de Ajustes → General
 * (`anfitrion_frases`, hooks/realtime/useFrasesAnfitrion.js).
 *
 * Duelo: por duelista, comparando su % con el del rival. Parejo = aliento
 * para los dos. Escenario (Follow the Leader / Personal Trainer): por el %
 * del barómetro.
 */

/** Cada cuánto cambia la frase: lo justo para que el Anfitrión la lea y la diga. */
export const FRASE_CADA_MS = 7000;

/** Duelista: desaliento si va claramente abajo (45 % o menos), si no aliento. */
export function tipoDuelista(pct, hayVotos) {
  return hayVotos && pct <= 45 ? "desaliento" : "aliento";
}

/** Barómetro de Escenario: desaliento por debajo del 40 %. */
export function tipoEscenario(pct) {
  return pct < 40 ? "desaliento" : "aliento";
}

/**
 * La frase de turno. `ciclo` avanza cada FRASE_CADA_MS y `semilla` separa a
 * los participantes, así dos duelistas en el mismo estado no dicen lo mismo.
 * `{nombre}` no se usa: las frases se dicen tal cual.
 */
export function fraseDe(lista, ciclo, semilla = 0) {
  if (!lista?.length) return null;
  return lista[(ciclo + semilla * Math.ceil(lista.length / 2)) % lista.length];
}
