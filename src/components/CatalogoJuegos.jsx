/**
 * Cards de los juegos que existen, para Juegos y Escenario cuando no hay nada
 * activo. Son informativas: sólo el logo, no abren nada — el juego se habilita
 * cuando el staff lo anuncia. Se prenden y apagan en Admin → Ajustes →
 * General → Cards de juegos.
 *
 * Reparto: las cards ocupan TODO el alto de la sección y cada una se lleva
 * 100 / n % (grilla de n filas de 1fr). Sumar un juego a la lista achica a
 * todas por igual: nunca quedan de tamaños distintos.
 *
 * Colores: se asignan por posición, en ciclo, de la paleta de fiesta. Un
 * juego nuevo toma el siguiente color sin tocar nada más.
 */

export const JUEGOS_CATALOGO = [
  { id: "trivia",  logo: "/placas/Desafio_demente-removebg-preview.png",    nombre: "Desafío Demente" },
  { id: "suma",    logo: "/placas/Sumate_que_sumamos-removebg-preview.png", nombre: "Sumate que sumamos" },
  { id: "palabra", logo: "/placas/Arma_la_palabra-removebg-preview.png",    nombre: "Arma la palabra" },
];

export const ESCENARIO_CATALOGO = [
  { id: "ftl",   logo: "/placas/Follow_de_leader-removebg-preview.png", nombre: "Follow the Leader" },
  { id: "pt",    logo: "/placas/Personal_Trainer-removebg-preview.png", nombre: "Personal Trainer" },
  { id: "duelo", logo: "/placas/Duelo_de_talento-removebg-preview.png", nombre: "Duelo de Talentos" },
];

// Rosa chicle, verde pastel, azul eléctrico.
const PALETA = ["#FF4FB8", "#7DF9B5", "#1F6BFF"];

export default function CatalogoJuegos({ juegos }) {
  return (
    <div style={{
      display: "grid", gridTemplateRows: `repeat(${juegos.length}, minmax(0, 1fr))`, gap: 12,
      height: "100%", minHeight: 360, boxSizing: "border-box",
    }}>
      {juegos.map((j, i) => {
        const color = PALETA[i % PALETA.length];
        return (
          <div key={j.id} role="img" aria-label={j.nombre} style={{
            minHeight: 0, borderRadius: 20, padding: "10px 14px", boxSizing: "border-box",
            display: "flex", alignItems: "center", justifyContent: "center",
            // Fondo casi transparente: el color lo llevan el borde y el brillo.
            background: `radial-gradient(circle at 50% 45%, ${color}1F, ${color}08 75%)`,
            border: `2px solid ${color}`,
            boxShadow: `0 0 22px ${color}88, inset 0 0 18px ${color}22`,
          }}>
            <img src={j.logo} alt="" draggable={false}
              style={{ width: "100%", height: "100%", objectFit: "contain",
                filter: "drop-shadow(0 4px 12px rgba(0,0,0,.55))" }}
              onError={(e) => { e.target.style.visibility = "hidden"; }}/>
          </div>
        );
      })}
    </div>
  );
}
