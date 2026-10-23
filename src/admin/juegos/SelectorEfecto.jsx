import { EFECTOS_DUELO, EFECTOS_CSS } from "../../constants/efectosPantalla";

/**
 * Grilla de efectos animados de un cartel de la TV. Cada botón se mueve con su
 * propio efecto: es la vista previa del movimiento.
 */
export default function SelectorEfecto({ valor, col, disabled, onElegir }) {
  return (
    <>
      <style>{EFECTOS_CSS}</style>
      <div role="radiogroup" aria-label="Efecto" style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 5 }}>
        {EFECTOS_DUELO.map((e) => {
          const activo = valor === e.id;
          return (
            <button key={e.id} type="button" role="radio" aria-checked={activo} disabled={disabled} title={e.nombre}
              onClick={() => !activo && onElegir(e)}
              style={{ padding: "7px 3px", borderRadius: 9, cursor: activo ? "default" : "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                background: activo ? `${col}26` : "rgba(240,232,255,.04)",
                border: `1px solid ${activo ? col : "rgba(240,232,255,.12)"}`,
                color: activo ? col : "rgba(240,232,255,.6)", fontSize: 9.5, fontWeight: 700 }}>
              <span style={{ display: "inline-block", fontSize: 18, animation: e.anim,
                transformOrigin: e.origen || "50% 50%" }}>{e.icono}</span>
              {e.nombre}
            </button>
          );
        })}
      </div>
    </>
  );
}
