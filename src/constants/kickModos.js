/**
 * Estilos de «Sacar Tema» (`pantalla_events.kick_style`).
 *
 *   classic, tomato        → votación por porcentaje (se puede quitar el voto)
 *   love_hate, guns_roses  → voto único +1 / −1 con medidor y umbrales fijos
 *                            (RPC pantalla_kick_voto_fijo)
 */
export const esKickDual = (style) => style === "love_hate" || style === "guns_roses";
