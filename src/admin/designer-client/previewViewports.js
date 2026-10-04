/**
 * Rango de herramienta de preview. NO es una regla del documento ni un
 * breakpoint: sólo limita los controles del Diseñador Cliente.
 *
 * Ancho: 320 (teléfonos angostos) a 430 (la app Cliente topea su columna en
 * `.phone-shell { max-width: 430px }`; más ancho se ve igual, centrado).
 * Alto: un rango holgado para revisar scroll, header y navegación.
 * Escala: cuánto se achica el viewport en pantalla; no cambia el layout.
 */
export const PREVIEW_VIEWPORT = Object.freeze({
  width:  Object.freeze({ min: 320, max: 430,  step: 1,    initial: 390  }),
  height: Object.freeze({ min: 560, max: 1000, step: 1,    initial: 844  }),
  scale:  Object.freeze({ min: 0.5, max: 1,    step: 0.05, initial: 0.75 }),
});

export const clampToRange = (value, { min, max }) => Math.min(max, Math.max(min, value));
