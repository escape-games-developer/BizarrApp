/**
 * Los dos juegos de escenario con participante único: Follow the Leader y
 * Personal Trainer.
 *
 * Comparten CONTRATO, no sólo estética:
 *   1. el cliente se postula (`escenario_queue`) y NO elige video
 *   2. el operador llama a un participante  → queda preparado, sin reproducir
 *   3. recién ahí el operador le elige el video del catálogo de su categoría
 *   4. ▶ Comenzar reproduce, como fuente TEMPORAL sobre los players del DJ
 *   5. ■ Finalizar vuelve a la convocatoria — todo por corte directo
 *   6. cerrar el juego devuelve la TV a DJ Democracy
 *
 * Por eso el cliente, el panel del admin y /tv leen su copy y sus colores de
 * acá en vez de tener tres implementaciones paralelas: lo que se arregla en el
 * flujo de uno queda arreglado en el otro.
 */

export const ESCENARIO_JUEGOS = {
  ftl: {
    type:  "ftl",
    label: "Follow the Leader",
    icon:  "💃",
    // Categoría del catálogo central (playlist_categories.slug) de donde el
    // operador elige el video del desafío.
    catalogo: "ftl",
    // Votación 👍/👎 del público durante la performance.
    // OJO: el RPC `cast_follow_leader_vote` sólo acepta turnos con
    // escenario_queue.type = 'ftl'. Habilitarla en otro juego requiere
    // generalizar ese guard en Supabase — ver el requerimiento del informe.
    votacion: true,

    // Admin
    colorAdmin: "#FF9500",
    subAdmin:   "El líder sube al escenario y el bar lo sigue al ritmo de la música.",

    // Cliente
    colorCliente:  "#EC4899",
    gradCliente:   "linear-gradient(135deg,#EC4899,#8B5CF6)",
    bgCliente:     "rgba(236,72,153,.08)",
    bordeCliente:  "rgba(236,72,153,.25)",
    textoCliente:  "#F9A8D4",
    vestuario: ["🧢 Gorra de béisbol", "🕺 Chaleco brillante", "🥿 Sneakers blancos", "🕶️ Lentes de sol"],
    titulo:    "¿Querés ser el próximo líder?",
    bajada:    "Anotate. El staff te llama al escenario y te dice qué tenés que hacer. ¡El bar te sigue!",
    botonPostular: "💃 QUIERO PARTICIPAR",

    // TV
    placa:   "/placas/Follow_de_leader-removebg-preview.png",
    tvListo: "LISTO PARA FOLLOW THE LEADER",
  },

  pt: {
    type:  "pt",
    label: "Personal Trainer",
    icon:  "🏋️",
    catalogo: "pt",
    // Queda en false hasta que el guard del RPC acepte turnos 'pt'. El resto
    // del juego funciona igual; sin esto, cada voto del público volvería con
    // "not a follow the leader turn".
    votacion: false,

    colorAdmin: "#00F5A0",
    subAdmin:   "Dirige una clase de gym dance grupal y toda la sala lo sigue desde su lugar.",

    colorCliente:  "#10B981",
    gradCliente:   "linear-gradient(135deg,#10B981,#06B6D4)",
    bgCliente:     "rgba(16,185,129,.08)",
    bordeCliente:  "rgba(16,185,129,.25)",
    textoCliente:  "#86EFAC",
    vestuario: ["🏋️ Polaina de colores", "🤸 Muñequeras flúo", "🎗️ Bandana en la cabeza", "🩱 Body aeróbico"],
    titulo:    "¿Te animás a dirigir la clase?",
    bajada:    "Anotate. El staff te llama al escenario y te dice qué tenés que hacer. ¡Toda la sala te sigue!",
    botonPostular: "🏋️ QUIERO PARTICIPAR",

    placa:   "/placas/Personal_Trainer-removebg-preview.png",
    tvListo: "LISTO PARA PERSONAL TRAINER",
  },
};

/** Tipos de escenario que corren con este contrato (los que proyecta /tv). */
export const TIPOS_ESCENARIO = Object.keys(ESCENARIO_JUEGOS);

export function juegoEscenario(type) {
  return ESCENARIO_JUEGOS[type] || null;
}
