import { RANGOS_BARO, BARO_POR_DEFECTO } from "../../../constants/escenarioListo";
import SliderPantalla from "../../juegos/SliderPantalla";
import { SeccionConfig } from "../../juegos/SeccionConfig";

const igual = (a, b) => Object.keys(BARO_POR_DEFECTO).every((k) => a[k] === b[k]);

/**
 * 📊 Barómetro de la TV durante la performance de FTL / PT: ancho, alto y
 * ubicación sobre la pantalla entera. `votacion` es el modo del juego: sin
 * votación la TV no lo muestra (la vista previa sí, para poder diseñarlo).
 */
export default function EditorBarometro({ j, col, guardando, aplicar, votacion }) {
  const b = j.barometro;
  const guardarBaro = (cambios, okText) => aplicar({ barometro: { ...b, ...cambios } }, okText);

  return (
    <SeccionConfig icon="📊" titulo="Barómetro" cuando="tv">
      {votacion === "off" && (
        <div style={{ fontSize: 10.5, color: "#FFD600", lineHeight: 1.5, marginBottom: 6 }}>
          ⚠️ Este juego está sin votación: en la TV el barómetro no aparece. Se cambia en el panel del juego.
        </div>
      )}
      <SliderPantalla label="Ancho (% del tamaño base)" valor={b.ancho} sufijo="%" col={col}
        min={RANGOS_BARO.ancho[0]} max={RANGOS_BARO.ancho[1]} disabled={guardando}
        onGuardar={(n) => guardarBaro({ ancho: n }, `Barómetro: ancho ${n}%.`)}/>
      <SliderPantalla label="Alto (% de la pantalla)" valor={b.alto} sufijo="%" col={col}
        min={RANGOS_BARO.alto[0]} max={RANGOS_BARO.alto[1]} disabled={guardando}
        onGuardar={(n) => guardarBaro({ alto: n }, `Barómetro: alto ${n}%.`)}/>
      <SliderPantalla label="Ubicación vertical (0 % arriba · 100 % abajo)" valor={b.y} sufijo="%" col={col}
        min={RANGOS_BARO.y[0]} max={RANGOS_BARO.y[1]} disabled={guardando}
        onGuardar={(n) => guardarBaro({ y: n }, `Barómetro: vertical ${n}%.`)}/>
      <SliderPantalla label="Ubicación horizontal (0 % izquierda · 100 % derecha)" valor={b.x} sufijo="%" col={col}
        min={RANGOS_BARO.x[0]} max={RANGOS_BARO.x[1]} disabled={guardando}
        onGuardar={(n) => guardarBaro({ x: n }, `Barómetro: horizontal ${n}%.`)}/>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <button type="button" className="btn btn-g" style={{ padding: "5px 10px", fontSize: 10.5 }}
          disabled={guardando || b.x === 50} onClick={() => guardarBaro({ x: 50 }, "Barómetro centrado en la pantalla.")}>
          ⇔ Centrar
        </button>
        <button type="button" className="btn btn-g" style={{ padding: "5px 10px", fontSize: 10.5 }}
          disabled={guardando || igual(b, BARO_POR_DEFECTO)}
          onClick={() => aplicar({ barometro: { ...BARO_POR_DEFECTO } }, "Barómetro en su lugar de siempre.")}>
          ↺ Como estaba
        </button>
      </div>
    </SeccionConfig>
  );
}
