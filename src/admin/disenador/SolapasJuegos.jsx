import { useState } from "react";

/**
 * Solapas de juegos de una sección del Diseñador (Escenario, Juegos).
 * Recuerda el último juego abierto en cada sección (por navegador) y atiende
 * el pedido de un panel de juego que manda a diseñar el suyo
 * (`pedirDisenoDe`, botón «Diseño de pantallas»).
 *
 * `juegos = [{ id, icon, label, col }]`; `children(id, nav)` dibuja el activo,
 * con `nav` = las solapas de juegos.
 */

const PEDIDO_KEY = "bizarr-disenador-pedido";

/** Lo llama el panel de un juego justo antes de navegar al Diseñador. */
export function pedirDisenoDe(juegoId) {
  try { sessionStorage.setItem(PEDIDO_KEY, juegoId); } catch { /* abre el último juego */ }
}

function juegoInicial(juegos, memoria) {
  const valido = (id) => (juegos.some((j) => j.id === id) ? id : null);
  try {
    const pedido = valido(sessionStorage.getItem(PEDIDO_KEY));
    if (pedido) sessionStorage.removeItem(PEDIDO_KEY);
    return pedido || valido(localStorage.getItem(memoria)) || juegos[0].id;
  } catch {
    return juegos[0].id;
  }
}

const CSS = `
  .dz-juegos{display:flex;gap:5px;flex-wrap:wrap;}
  .dz-juego{flex:0 0 auto;display:flex;align-items:center;gap:6px;padding:7px 12px;font:inherit;font-size:11.5px;
    font-weight:700;border-radius:10px;cursor:pointer;white-space:nowrap;
    background:rgba(240,232,255,.04);color:rgba(240,232,255,.55);border:1px solid rgba(240,232,255,.12);}
  .dz-juego:hover{color:rgba(240,232,255,.9);}
  .dz-juego[aria-selected="true"]{cursor:default;color:#F0E8FF;border-color:var(--col);
    background:color-mix(in srgb,var(--col) 16%,transparent);box-shadow:inset 0 -2px 0 var(--col);}
`;

export default function SolapasJuegos({ juegos, seccion, children }) {
  const memoria = `bizarr-disenador-${seccion}`;
  const [activo, setActivo] = useState(() => juegoInicial(juegos, memoria));

  const elegir = (id) => {
    setActivo(id);
    try { localStorage.setItem(memoria, id); } catch { /* sin storage: no se recuerda */ }
  };

  // Las solapas de juegos no se dibujan acá: van a `children` como `nav`, para
  // que el juego las ponga en la misma fila que sus vistas (VistasJuego).
  const nav = (
    <div className="dz-juegos" role="tablist" aria-label="Juegos">
      <style>{CSS}</style>
      {juegos.map((j) => (
        <button key={j.id} type="button" role="tab" aria-selected={activo === j.id}
          className="dz-juego" style={{ "--col": j.col }} onClick={() => elegir(j.id)}>
          <span>{j.icon}</span>{j.label}
        </button>
      ))}
    </div>
  );

  return <div key={activo}>{children(activo, nav)}</div>;
}
