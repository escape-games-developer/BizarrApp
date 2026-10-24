import { useState } from "react";
import { ESTILOS_TEXTO, FUENTES, aplicarEstilo, cssDeTexto, estiloCompleto } from "../estilosTexto";
import { ColorInput, Fila, Interruptor, Num, Opcion, Seccion, Slider } from "./controles";

/**
 * Formato de un texto, como en un procesador de texto: biblioteca de estilos
 * prearmados, tipografía, tamaño, negrita / cursiva / subrayado, mayúsculas,
 * alineación, color o degradado, contorno, sombra, brillo, interlineado y
 * espaciado.
 */

const TAMANOS = [12, 16, 20, 24, 32, 40, 48, 56, 64, 72, 88, 100, 120, 150, 180, 220, 260, 320, 400];

export default function ControlesTexto({ estilo, onCambiar, titulo = "Formato" }) {
  const e = estiloCompleto(estilo);
  const [verEstilos, setVerEstilos] = useState(false);
  const set = (patch) => onCambiar({ ...e, ...patch });

  return (
    <>
      <Seccion titulo={`Biblioteca de estilos (${ESTILOS_TEXTO.length})`}
        accion={<button type="button" className="btn btn-g" style={{ padding: "3px 9px", fontSize: 10 }}
          onClick={() => setVerEstilos((v) => !v)}>{verEstilos ? "Ocultar" : "Ver todos"}</button>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6,
          maxHeight: verEstilos ? 360 : 112, overflowY: verEstilos ? "auto" : "hidden" }}>
          {ESTILOS_TEXTO.map((x) => (
            <button key={x.id} type="button" title={x.nombre} onClick={() => onCambiar(aplicarEstilo(e, x.id))}
              style={{ height: 52, borderRadius: 9, cursor: "pointer", background: "#0B0714", overflow: "hidden",
                border: "1px solid rgba(240,232,255,.12)", display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", gap: 2, padding: 2 }}>
              <span style={{ ...cssDeTexto({ ...x.estilo, tamano: 22, alinear: "center", interlineado: 1 }), whiteSpace: "nowrap" }}>Aa</span>
              <span style={{ fontSize: 8.5, color: "rgba(240,232,255,.5)", whiteSpace: "nowrap", overflow: "hidden",
                textOverflow: "ellipsis", maxWidth: "100%" }}>{x.nombre}</span>
            </button>
          ))}
        </div>
      </Seccion>

      <Seccion titulo={titulo}>
        <Fila label="Tipografía">
          <select className="inp" value={e.fuente} onChange={(ev) => set({ fuente: ev.target.value })}
            style={{ margin: 0, padding: "5px 8px", fontFamily: FUENTES.find((f) => f.id === e.fuente)?.css }}>
            {FUENTES.map((f) => <option key={f.id} value={f.id} style={{ fontFamily: f.css }}>{f.nombre}</option>)}
          </select>
        </Fila>
        <Fila label="Tamaño">
          <Num value={e.tamano} min={8} max={600} step={2} onChange={(v) => set({ tamano: v })} ancho={56}/>
          <select className="inp" value="" onChange={(ev) => ev.target.value && set({ tamano: Number(ev.target.value) })}
            style={{ margin: 0, padding: "5px 6px", width: 64 }} aria-label="Tamaños rápidos">
            <option value="">…</option>
            {TAMANOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Fila>
        <Fila label="Formato">
          <Opcion on={e.peso >= 700} title="Negrita" onClick={() => set({ peso: e.peso >= 700 ? 400 : 800 })}><b>B</b></Opcion>
          <Opcion on={e.cursiva} title="Cursiva" onClick={() => set({ cursiva: !e.cursiva })}><i>I</i></Opcion>
          <Opcion on={e.subrayado} title="Subrayado" onClick={() => set({ subrayado: !e.subrayado })}><u>U</u></Opcion>
          <Opcion on={e.mayus} title="Mayúsculas" onClick={() => set({ mayus: !e.mayus })}>AA</Opcion>
        </Fila>
        <Fila label="Grosor">
          <Slider value={e.peso} min={100} max={900} step={100} onChange={(v) => set({ peso: v })}/>
        </Fila>
        <Fila label="Alinear">
          {[["left", "Izq."], ["center", "Centro"], ["right", "Der."]].map(([v, t]) => (
            <Opcion key={v} on={e.alinear === v} onClick={() => set({ alinear: v })}>{t}</Opcion>
          ))}
        </Fila>
        <Fila label="Interlineado">
          <Slider value={e.interlineado} min={0.6} max={3} step={0.05} onChange={(v) => set({ interlineado: v })} mostrar={(v) => v.toFixed(2)}/>
        </Fila>
        <Fila label="Espaciado">
          <Slider value={e.espaciado} min={-0.1} max={1} step={0.01} onChange={(v) => set({ espaciado: v })} mostrar={(v) => v.toFixed(2)}/>
        </Fila>
      </Seccion>

      <Seccion titulo="Color">
        <Interruptor on={!!e.degradado} onClick={() => set({ degradado: e.degradado ? null : { colores: [e.color === "transparent" ? "#FFD600" : e.color, "#FF2D78"], angulo: 180 } })}>
          Degradado
        </Interruptor>
        {e.degradado ? (<>
          {e.degradado.colores.map((col, i) => (
            <Fila key={i} label={`Color ${i + 1}`}>
              <ColorInput value={col} onChange={(v) => set({ degradado: { ...e.degradado, colores: e.degradado.colores.map((x, j) => (j === i ? v : x)) } })}/>
              {e.degradado.colores.length > 2 && (
                <button type="button" className="btn btn-g" style={{ padding: "3px 7px", fontSize: 10 }}
                  onClick={() => set({ degradado: { ...e.degradado, colores: e.degradado.colores.filter((_, j) => j !== i) } })}>✕</button>
              )}
            </Fila>
          ))}
          {e.degradado.colores.length < 6 && (
            <button type="button" className="btn btn-g" style={{ padding: "4px 9px", fontSize: 10.5, justifySelf: "start" }}
              onClick={() => set({ degradado: { ...e.degradado, colores: [...e.degradado.colores, "#00E5FF"] } })}>+ Color</button>
          )}
          <Fila label="Ángulo">
            <Slider value={e.degradado.angulo} min={0} max={360} onChange={(v) => set({ degradado: { ...e.degradado, angulo: v } })} mostrar={(v) => `${v}°`}/>
          </Fila>
        </>) : (
          <Fila label="Color"><ColorInput value={e.color} onChange={(v) => set({ color: v })}/></Fila>
        )}
      </Seccion>

      <Seccion titulo="Contorno, sombra y brillo">
        <Interruptor on={!!e.contorno} onClick={() => set({ contorno: e.contorno ? null : { color: "#000000", ancho: 3 } })}>Contorno</Interruptor>
        {e.contorno && (<>
          <Fila label="Color"><ColorInput value={e.contorno.color} onChange={(v) => set({ contorno: { ...e.contorno, color: v } })}/></Fila>
          <Fila label="Grosor"><Slider value={e.contorno.ancho} min={0} max={20} step={0.5} onChange={(v) => set({ contorno: { ...e.contorno, ancho: v } })}/></Fila>
        </>)}
        <Interruptor on={!!e.sombra} onClick={() => set({ sombra: e.sombra ? null : { color: "#000000", x: 4, y: 4, blur: 6 } })}>Sombra</Interruptor>
        {e.sombra && (<>
          <Fila label="Color"><ColorInput value={e.sombra.color} onChange={(v) => set({ sombra: { ...e.sombra, color: v } })}/></Fila>
          <Fila label="Distancia X"><Slider value={e.sombra.x} min={-60} max={60} onChange={(v) => set({ sombra: { ...e.sombra, x: v } })}/></Fila>
          <Fila label="Distancia Y"><Slider value={e.sombra.y} min={-60} max={60} onChange={(v) => set({ sombra: { ...e.sombra, y: v } })}/></Fila>
          <Fila label="Desenfoque"><Slider value={e.sombra.blur} min={0} max={120} onChange={(v) => set({ sombra: { ...e.sombra, blur: v } })}/></Fila>
        </>)}
        <Interruptor on={!!e.brillo} onClick={() => set({ brillo: e.brillo ? null : { color: "#FF2D78", fuerza: 20 } })}>Brillo (neón)</Interruptor>
        {e.brillo && (<>
          <Fila label="Color"><ColorInput value={e.brillo.color} onChange={(v) => set({ brillo: { ...e.brillo, color: v } })}/></Fila>
          <Fila label="Fuerza"><Slider value={e.brillo.fuerza} min={2} max={80} onChange={(v) => set({ brillo: { ...e.brillo, fuerza: v } })}/></Fila>
        </>)}
      </Seccion>
    </>
  );
}
