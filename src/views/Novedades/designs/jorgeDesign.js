/**
 * Diseño Jorge — Novedades (Cliente). Es la Vista Original de la sección
 * (`design_key` "original"): card con la imagen 2.4:1 arriba y el cuerpo con
 * título, badge de tipo, extracto, botón y fecha, en la paleta dorada del bar.
 *
 * Un diseño de Novedades sólo define presentación: NovedadesView arma la
 * estructura y toma de acá los estilos de cada pieza.
 */
export const JORGE_DESIGN = Object.freeze({
  id:        "original",
  // Sin lienzo propio: usa el fondo de la app.
  className: null,
  fontsCss:  null,
  css:       null,
  tvStripe:  null,

  frame: {
    borderRadius: 16,
    background:   "rgba(0,0,0,.42)",
    border:       "1px solid rgba(255,215,0,.14)",
  },
  imageBg:    "rgba(255,255,255,.04)",
  fallbackBg: "rgba(255,215,0,.05)",

  // `color` del banner manda sobre el dorado por defecto.
  title: (banner) => ({
    fontFamily: "'DM Sans', sans-serif", fontWeight: 800, fontSize: 15,
    color: banner.color || "#FFD700",
  }),
  badge: () => ({
    background: "rgba(255,215,0,.1)", border: "1px solid rgba(255,215,0,.18)",
    fontSize: 9.5, fontWeight: 700, letterSpacing: ".5px", color: "rgba(255,215,0,.8)",
  }),
  excerpt: { fontSize: 12.5, color: "rgba(245,230,192,.72)" },
  cta: {
    background: "rgba(255,215,0,.12)", border: "1px solid rgba(255,215,0,.45)",
    color: "#FFF6D6", fontSize: 12.5, fontWeight: 800,
  },
  date: { fontSize: 11, color: "rgba(245,230,192,.5)" },

  // Encabezado clásico de sección (.sec-hdr del CSS global).
  header: null,

  empty: {
    icon:  { opacity: .2 },
    title: { fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15, color: "rgba(255,215,0,.25)" },
    text:  { fontSize: 12, color: "rgba(245,230,192,.22)" },
  },
});
