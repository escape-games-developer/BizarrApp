import { useEffect, useRef } from "react";

/**
 * Barómetro de energía de Follow the Leader: barra que sube y baja con el %
 * de toques del público. El color se funde de un tramo al otro:
 *    rojo (0–25) → amarillo (26–50) → naranja (51–75) → verde (76–100)
 * Cada color es puro en el centro de su tramo y entre centros se interpola,
 * así el cambio nunca es un salto.
 *
 * Se mueve como un vúmetro: un loop de requestAnimationFrame persigue el %
 * con ataque rápido (sube enseguida) y caída más lenta, y entre lectura y
 * lectura del servidor sigue el mismo decaimiento que la base (tau 4 s), así
 * no hay escalones. Con energía, un temblor leve lo hace sentir vivo. El loop
 * escribe el estilo directo en el DOM: no re-renderiza React 60 veces por seg.
 *
 * Lo comparten /tv (vertical, con divisiones, sin número), el Admin y el
 * celular (horizontal, con el %).
 */
const PARADAS = [
  { pct: 12.5, rgb: [255, 45, 69] },   // rojo
  { pct: 37.5, rgb: [255, 214, 0] },   // amarillo
  { pct: 62.5, rgb: [255, 149, 0] },   // naranja
  { pct: 87.5, rgb: [0, 245, 160] },   // verde
];

export function colorBarometro(pct) {
  const p = Math.max(0, Math.min(100, pct));
  if (p <= PARADAS[0].pct) return `rgb(${PARADAS[0].rgb.join(",")})`;
  for (let i = 1; i < PARADAS.length; i++) {
    const a = PARADAS[i - 1], b = PARADAS[i];
    if (p <= b.pct) {
      const t = (p - a.pct) / (b.pct - a.pct);
      const rgb = a.rgb.map((c, k) => Math.round(c + (b.rgb[k] - c) * t));
      return `rgb(${rgb.join(",")})`;
    }
  }
  return `rgb(${PARADAS[PARADAS.length - 1].rgb.join(",")})`;
}

const TAU_DECAE_MS = 4000;  // mismo decaimiento que ftl_energia (tau 4 s)
const TAU_SUBE_MS  = 120;   // ataque: sigue enseguida a una subida
const TAU_BAJA_MS  = 450;   // caída: baja más despacio, como un vúmetro

/** Anima `barraRef` (alto o ancho) y, si hay, el texto del %. */
function useNivelFluido(pct, { barraRef, textoRef, eje, decae }) {
  const estado = useRef({ objetivo: pct, leidoEn: 0, actual: pct });

  // `decae`: los toques bajan solos entre lecturas; los votos 👍/👎 no (el %
  // sólo cambia cuando alguien vota).
  useEffect(() => {
    estado.current.objetivo = pct;
    estado.current.leidoEn = performance.now();
    estado.current.decae = decae;
  }, [pct, decae]);

  useEffect(() => {
    let raf, previo = performance.now();
    const cuadro = (ahora) => {
      const s = estado.current;
      const dt = Math.min(100, ahora - previo);
      previo = ahora;

      // Entre lecturas, el % sigue cayendo igual que en la base.
      const objetivo = s.decae ? s.objetivo * Math.exp(-(ahora - s.leidoEn) / TAU_DECAE_MS) : s.objetivo;
      const tau = objetivo > s.actual ? TAU_SUBE_MS : TAU_BAJA_MS;
      s.actual += (objetivo - s.actual) * (1 - Math.exp(-dt / tau));

      // Temblor de vúmetro, proporcional al nivel (nada en cero).
      const amplitud = Math.min(2.5, s.actual * 0.05);
      const temblor = (Math.sin(ahora / 83) * 0.6 + Math.sin(ahora / 47) * 0.4) * amplitud;
      const visible = Math.max(0, Math.min(100, s.actual + temblor));
      const color = colorBarometro(visible);

      const barra = barraRef.current;
      if (barra) {
        barra.style[eje] = `${visible}%`;
        barra.style.backgroundColor = color;
        barra.style.boxShadow = `0 0 22px ${color}`;
      }
      if (textoRef?.current) textoRef.current.textContent = `${Math.round(s.actual)}%`;
      raf = requestAnimationFrame(cuadro);
    };
    raf = requestAnimationFrame(cuadro);
    return () => cancelAnimationFrame(raf);
  }, [barraRef, textoRef, eje]);
}

const TAMANOS = {
  normal: { alto: 22, radio: 11, fuente: 13 },
  chico:  { alto: 12, radio: 6,  fuente: 0 },
};

export default function FtlBarometro({ pct = 0, tamano = "normal", decae = true }) {
  const barraRef = useRef(null);
  const textoRef = useRef(null);
  const vertical = tamano === "tv";
  useNivelFluido(pct, { barraRef, textoRef, eje: vertical ? "height" : "width", decae });

  const valor = Math.max(0, Math.min(100, Math.round(pct)));
  const aria = { role: "meter", "aria-valuemin": 0, "aria-valuemax": 100,
    "aria-valuenow": valor, "aria-label": "Energía del público" };

  // TV: vertical y rectangular, sin número — sólo el color, la altura y las
  // divisiones de los cuatro tramos (25 / 50 / 75).
  if (vertical) return (
    <div {...aria} style={{
      position: "relative", width: "100%", height: "100%", borderRadius: 4, overflow: "hidden",
      background: "rgba(8,4,15,.6)", border: "1px solid rgba(240,232,255,.25)",
      boxShadow: "inset 0 2px 10px rgba(0,0,0,.7)", backdropFilter: "blur(4px)",
    }}>
      <div ref={barraRef} style={{
        position: "absolute", left: 0, right: 0, bottom: 0, height: 0,
        backgroundImage: "linear-gradient(90deg, rgba(255,255,255,.28), rgba(255,255,255,0) 55%, rgba(0,0,0,.18))",
      }}/>
      {[25, 50, 75].map((m) => (
        <div key={m} style={{ position: "absolute", left: 0, right: 0, bottom: `${m}%`,
          height: 2, transform: "translateY(1px)", background: "rgba(240,232,255,.45)",
          boxShadow: "0 0 3px rgba(0,0,0,.8)" }}/>
      ))}
    </div>
  );

  const t = TAMANOS[tamano] || TAMANOS.normal;
  return (
    <div {...aria} style={{ width: "100%" }}>
      <div style={{
        position: "relative", height: t.alto, borderRadius: t.radio, overflow: "hidden",
        background: "rgba(8,4,15,.65)", border: "1px solid rgba(240,232,255,.18)",
        boxShadow: "inset 0 2px 8px rgba(0,0,0,.6)",
      }}>
        <div ref={barraRef} style={{
          position: "absolute", top: 0, bottom: 0, left: 0, width: 0, borderRadius: t.radio,
          backgroundImage: "linear-gradient(180deg, rgba(255,255,255,.25), rgba(255,255,255,0) 60%)",
        }}/>
        {t.fuente !== 0 && (
          <div ref={textoRef} style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "Syne, 'DM Sans', sans-serif", fontWeight: 900, fontSize: t.fuente,
            color: "#fff", textShadow: "0 1px 6px #000", letterSpacing: ".02em",
          }}>{valor}%</div>
        )}
      </div>
    </div>
  );
}
