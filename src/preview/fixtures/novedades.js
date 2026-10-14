/**
 * Datos de prueba de Novedades para el preview del Diseñador Cliente. Cubren
 * los cuatro tipos (cada diseño puede pintar distinto el badge), con y sin
 * botón, y un extracto largo que llega al corte de 3 líneas.
 *
 * Sin imágenes remotas: la franja de arriba muestra el emoji de cada novedad.
 */
export const previewNovedadesShellState = Object.freeze({ isLoggedIn: true, isRestricted: false });

const banners = Object.freeze([
  {
    id: "n1", type: "PROMO", emoji: "🍺", title: "2x1 en pintas hasta las 23",
    body: "Toda la línea de cervezas tiradas al 2x1. Válido de jueves a sábado, presentando la app en la barra.",
    published_at: "2026-10-16", cta_mode: "CONSULTAR", cta_link: "https://example.com/promo",
  },
  {
    id: "n2", type: "EVENTO", emoji: "🎤", title: "Noche de karaoke con banda en vivo",
    body: "Anotate desde Escenario y subí a cantar con la banda de la casa. Los mejores tres se llevan premio de la barra y entrada para la final del mes.",
    published_at: "2026-10-15", cta_mode: "VER_DETALLE", cta_link: "https://example.com/karaoke",
  },
  {
    id: "n3", type: "DESTACADO", emoji: "🏆", title: "Rey del Orto: ganador de la semana",
    body: "Felicitaciones a Team Batata, que se quedó con la corona del viernes.",
    published_at: "2026-10-14", cta_mode: "VER_DETALLE", cta_link: null,
  },
  {
    id: "n4", type: "PROXIMAMENTE", emoji: "✨", title: "Se viene la carta de otoño",
    body: "Nuevos tragos de autor y platos para compartir.",
    published_at: "2026-10-12", cta_mode: "VER_DETALLE", cta_link: null,
  },
].map((b) => Object.freeze({ ...b, visible: true })));

export const previewNovedadesProps = Object.freeze({ banners, loading: false, preview: true });
