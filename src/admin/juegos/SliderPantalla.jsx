import { useEffect, useState } from "react";

/**
 * Barra de un valor de pantalla: el número sigue a la barra en vivo y se
 * guarda UNA vez al soltarla (no una escritura por cada píxel).
 */
export default function SliderPantalla({ label, valor, min, max, sufijo = "", signo = false, col, disabled, onGuardar }) {
  const [v, setV] = useState(valor);
  useEffect(() => { setV(valor); }, [valor]);
  const fmt = (n) => `${signo && n > 0 ? "+" : ""}${n}${sufijo}`;
  const soltar = () => { if (v !== valor) onGuardar(v); };
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "rgba(240,232,255,.6)" }}>
        <span>{label}</span><span style={{ color: col, fontWeight: 700 }}>{fmt(v)}</span>
      </div>
      <input type="range" min={min} max={max} step={1} value={v} disabled={disabled} aria-label={label}
        onChange={(e) => setV(Number(e.target.value))} onPointerUp={soltar} onKeyUp={soltar}
        style={{ width: "100%", accentColor: col }}/>
    </div>
  );
}
