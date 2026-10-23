import { useEffect, useRef, useState } from "react";
import MediaLibraryModal from "../../../components/media/MediaLibraryModal";
import { TEXTO_LISTO_MAX, FUENTES_LISTO, POSICIONES_LISTO } from "../../../constants/escenarioListo";
import Toggle from "../../juegos/Toggle";
import SliderPantalla from "../../juegos/SliderPantalla";
import SelectorEfecto from "../../juegos/SelectorEfecto";
import { SeccionConfig } from "../../juegos/SeccionConfig";

/**
 * 🙋 Pantalla previa «participante listo» de FTL / PT: si se muestra
 * (`previa`) y su cartel — texto o imagen PNG/WEBP, tipografía, color, tamaño,
 * ubicación y efecto. `j` es la config del juego en `escenario_listo`;
 * `aplicar(cambios, okText)` la guarda (ver DisenoEscenario).
 */
export default function EditorListo({ j, col, guardando, aplicar, avisar }) {
  const [texto, setTexto] = useState(j.texto);
  const [libOpen, setLibOpen] = useState(false);
  const [color, setColor] = useState(j.color.toUpperCase());
  const colorTimer = useRef(null);

  useEffect(() => { setTexto(j.texto); }, [j.texto]);
  useEffect(() => { setColor(j.color.toUpperCase()); }, [j.color]);
  useEffect(() => () => clearTimeout(colorTimer.current), []);

  const textoLimpio = texto.trim();
  const elegirImagen = (asset) => {
    setLibOpen(false);
    if (!asset?.file_url) return;
    if (!["image/png", "image/webp"].includes(asset.mime_type)) {
      avisar({ ok: false, text: "Elegí un PNG o WEBP (con fondo transparente)." }); return;
    }
    aplicar({ centro: "imagen", imagen: asset.file_url }, "Imagen puesta en el cartel.");
  };
  const tab = (activo) => ({ flex: 1, padding: "7px 8px", fontSize: 11, fontWeight: 700, borderRadius: 9, cursor: "pointer",
    background: activo ? `${col}26` : "rgba(240,232,255,.04)", color: activo ? col : "rgba(240,232,255,.5)",
    border: `1px solid ${activo ? col : "rgba(240,232,255,.12)"}` });
  const etiqueta = { fontSize: 10.5, color: "rgba(240,232,255,.6)", marginTop: 12, marginBottom: 4 };

  return (
    <SeccionConfig icon="🙋" titulo="Participante listo" cuando="tv">
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10,
        background: "rgba(240,232,255,.04)", border: "1px solid rgba(240,232,255,.1)" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700 }}>Mostrar esta pantalla</div>
          <div style={{ fontSize: 10, color: "rgba(240,232,255,.4)", lineHeight: 1.5 }}>
            {j.previa
              ? "Al llamar al participante, la TV muestra su avatar, su nombre y el cartel hasta que arranca el video."
              : "Apagada: al llamar al participante, la TV sigue en la convocatoria hasta que arranca el video."}
          </div>
        </div>
        <Toggle on={j.previa} color={col} etiqueta="Mostrar la pantalla previa" disabled={guardando}
          label={j.previa ? "Activa" : "Apagada"}
          onToggle={() => aplicar({ previa: !j.previa }, j.previa ? "Pantalla previa apagada." : "Pantalla previa activa.")}/>
      </div>

      <div style={{ opacity: j.previa ? 1 : .5 }}>
        <div style={etiqueta}>Cartel</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <button type="button" style={tab(j.centro === "texto")} disabled={guardando}
            onClick={() => j.centro !== "texto" && aplicar({ centro: "texto" }, "Ahora se muestra el texto.")}>Aa Texto</button>
          <button type="button" style={tab(j.centro === "imagen")} disabled={guardando}
            onClick={() => j.imagen ? (j.centro !== "imagen" && aplicar({ centro: "imagen" }, "Ahora se muestra la imagen.")) : setLibOpen(true)}>🖼️ Imagen</button>
        </div>

        {j.centro === "texto" ? (
          <>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={texto} maxLength={TEXTO_LISTO_MAX} onChange={(e) => setTexto(e.target.value)}
                aria-label="Texto del cartel"
                onKeyDown={(e) => { if (e.key === "Enter" && textoLimpio && textoLimpio !== j.texto) aplicar({ texto: textoLimpio }, `Texto guardado: «${textoLimpio}».`); }}
                style={{ flex: 1, minWidth: 0, padding: "8px 10px", borderRadius: 9, fontSize: 12.5, fontWeight: 700,
                  background: "rgba(240,232,255,.05)", border: "1px solid rgba(240,232,255,.14)", color: "#F0E8FF", outline: "none" }}/>
              <button type="button" className="btn btn-g" style={{ padding: "7px 12px", fontSize: 11 }}
                disabled={guardando || !textoLimpio || textoLimpio === j.texto}
                onClick={() => aplicar({ texto: textoLimpio }, `Texto guardado: «${textoLimpio}».`)}>
                {guardando ? "…" : "Guardar"}
              </button>
            </div>
            <div style={etiqueta}>Tipografía</div>
            <div style={{ display: "flex", gap: 6 }}>
              {FUENTES_LISTO.map((f) => (
                <button key={f.id} type="button" disabled={guardando}
                  style={{ ...tab(j.fuente === f.id), fontFamily: f.css }}
                  onClick={() => j.fuente !== f.id && aplicar({ fuente: f.id }, `Tipografía: ${f.nombre}.`)}>{f.nombre}</button>
              ))}
            </div>
            <div style={{ ...etiqueta, display: "flex", alignItems: "center", gap: 10 }}>
              <span>Color del texto</span>
              {/* Se guarda 0,6 s después del último movimiento, no con cada uno. */}
              <input type="color" value={color} disabled={guardando} aria-label="Color del texto"
                onChange={(e) => {
                  const c = e.target.value.toUpperCase();
                  setColor(c);
                  clearTimeout(colorTimer.current);
                  colorTimer.current = setTimeout(() => {
                    if (c !== j.color.toUpperCase()) aplicar({ color: c }, `Color: ${c}.`);
                  }, 600);
                }}
                style={{ width: 40, height: 26, border: "none", background: "none", padding: 0, cursor: "pointer" }}/>
              <span style={{ color, fontWeight: 700 }}>{color}</span>
            </div>
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 96, height: 54, borderRadius: 9, background: "rgba(240,232,255,.05)",
              border: "1px solid rgba(240,232,255,.12)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {j.imagen && <img src={j.imagen} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}/>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <button type="button" className="btn btn-g" style={{ padding: "6px 12px", fontSize: 11 }} disabled={guardando}
                onClick={() => setLibOpen(true)}>Cambiar imagen</button>
              <button type="button" className="btn" style={{ padding: "6px 12px", fontSize: 11, background: "rgba(255,45,120,.08)",
                border: "1px solid rgba(255,45,120,.3)", color: "#FF8FB8" }} disabled={guardando}
                onClick={() => aplicar({ centro: "texto", imagen: null }, "Imagen quitada: vuelve el texto.")}>🗑 Quitar imagen</button>
            </div>
          </div>
        )}

        <SliderPantalla label="🔍 Tamaño (zoom)" valor={j.zoom} signo col={col} min={-100} max={100} disabled={guardando}
          onGuardar={(n) => aplicar({ zoom: n }, `Tamaño: ${n > 0 ? `+${n}` : n}.`)}/>

        <div style={etiqueta}>Ubicación</div>
        <div style={{ display: "flex", gap: 6 }}>
          {POSICIONES_LISTO.map((p) => (
            <button key={p.id} type="button" style={tab(j.posicion === p.id)} disabled={guardando}
              onClick={() => j.posicion !== p.id && aplicar({ posicion: p.id }, `Ubicación: ${p.nombre.toLowerCase()}.`)}>{p.nombre}</button>
          ))}
        </div>

        <div style={etiqueta}>✨ Efecto</div>
        <SelectorEfecto valor={j.efecto} col={col} disabled={guardando}
          onElegir={(e) => aplicar({ efecto: e.id }, `Efecto: ${e.nombre}.`)}/>
      </div>

      <MediaLibraryModal open={libOpen} title="Cartel «listo» (PNG o WEBP)"
        onClose={() => setLibOpen(false)} onSelect={elegirImagen}/>
    </SeccionConfig>
  );
}
