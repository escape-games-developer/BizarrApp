/**
 * Frases para que el Anfitrión le hable a cada participante mientras se vota,
 * según cómo le va. `{nombre}` se reemplaza por el primer nombre.
 *
 * Duelo: por duelista, comparando su % con el del rival.
 * Escenario (Follow the Leader / Personal Trainer): por el % del barómetro.
 *
 * El «desaliento» es chicana de bar, nunca un insulto: la idea es que el
 * público se prenda y vote, no que el participante la pase mal.
 */

export const FRASES_DUELO = {
  ganando: [
    "¡{nombre} la está rompiendo! ¡Que no pare!",
    "¡Vamos {nombre}, el bar está con vos!",
    "{nombre} viene adelante… ¡a no aflojar ahora!",
    "¡Eso es {nombre}! ¡Se siente el aguante!",
    "¡{nombre} está imparable! ¿Quién lo frena?",
    "¡Miren cómo vota la gente por {nombre}!",
  ],
  parejo: [
    "¡Esto está parejísimo! ¡Cada toque cuenta para {nombre}!",
    "¡{nombre}, dejalo todo que está peleado!",
    "¡Nadie se relaje! {nombre} está ahí nomás",
    "¡Mano a mano! ¿Quién banca a {nombre}?",
    "¡Está para cualquiera! ¡Vamos {nombre}!",
  ],
  perdiendo: [
    "¡Vamos {nombre}, todavía se puede dar vuelta!",
    "¿Y la hinchada de {nombre}? ¡Que se haga escuchar!",
    "{nombre} viene de atrás… ¡pero acá nadie se rinde!",
    "Uy {nombre}, el rival te está pasando el trapo… ¡reaccioná!",
    "¡Un esfuerzo más {nombre}, que la remontada es épica!",
    "¿Se quedó dormida la barra de {nombre}? ¡Despierten!",
  ],
};

export const FRASES_ESCENARIO = {
  alto: [
    "¡{nombre} prendió fuego el escenario!",
    "¡Esto es energía pura, {nombre}! ¡No pares!",
    "¡El bar está con {nombre}! ¡Más fuerte!",
    "¡Qué nivel, {nombre}! ¡Así se hace!",
  ],
  medio: [
    "¡Vamos {nombre}, que la gente se está prendiendo!",
    "¡Un poco más de ritmo, {nombre}, que se puede más!",
    "¡A ver ese público! ¡Denle energía a {nombre}!",
    "¡{nombre} va bien, pero queremos más!",
  ],
  bajo: [
    "¡Arriba {nombre}! ¡Que esto recién empieza!",
    "¿Dónde está la energía? ¡Ayuden a {nombre}!",
    "{nombre}, el barómetro está tirando para abajo… ¡metele!",
    "¡Vamos que se apaga! ¡Toquen por {nombre}!",
  ],
};

/** Cada cuánto cambia la frase: lo justo para que el Anfitrión la lea y la diga. */
export const FRASE_CADA_MS = 7000;

/** Estado de un duelista: su % contra el 50 %, con margen para «parejo». */
export function estadoDuelista(pct, hayVotos) {
  if (!hayVotos || (pct > 45 && pct < 55)) return "parejo";
  return pct >= 55 ? "ganando" : "perdiendo";
}

/** Estado del barómetro de Escenario. */
export function estadoBarometro(pct) {
  return pct >= 70 ? "alto" : pct >= 40 ? "medio" : "bajo";
}

/**
 * La frase de turno. `ciclo` avanza cada FRASE_CADA_MS y `semilla` separa a
 * los participantes, así dos duelistas en el mismo estado no dicen lo mismo.
 */
export function fraseDe(lista, nombre, ciclo, semilla = 0) {
  if (!lista?.length) return null;
  const primerNombre = String(nombre || "").trim().split(/\s+/)[0] || "campeón";
  return lista[(ciclo + semilla * 3) % lista.length].replaceAll("{nombre}", primerNombre);
}
