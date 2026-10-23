import { useEffect, useRef, useState } from "react";
import { saveEventFields } from "../../../services/pantallaDj";
import { uploadMediaAsset } from "../../../services/mediaAssets";
import { P } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";

/**
 * Personalización visual del evento: color de acento, de texto y de fondo,
 * logo e imagen de fondo (`pantalla_events`). Vacío = el estilo por defecto.
 * La consumen /tv y la votación del cliente (ver constants/marcaEvento.js).
 *
 * Todo se guarda solo (sin botón Guardar), como Tandas: el selector de color a
 * los 0,6 s del último movimiento, el código hex al salir del campo (si es
 * válido), «Restablecer» y «Quitar» al tocarlos y las imágenes al subirse.
 */

const DEFECTOS = { accent_color: "#f5ce42", text_color: "#ffe6cc", background_color: "#000000" };
const esHex = (v) => /^#[0-9a-fA-F]{6}$/.test(v || "");

const css = `
  .vs-caja{padding:18px 20px;border-radius:16px;background:rgba(240,232,255,.02);border:1px solid rgba(240,232,255,.1);}
  .vs-cab{font-size:12px;font-weight:600;letter-spacing:.8px;text-transform:uppercase;color:rgba(240,232,255,.75);}
  .vs-desc{font-size:10.5px;line-height:1.5;color:rgba(240,232,255,.55);margin-top:3px;}
  .vs-campo{margin-top:16px;}
  .vs-fila{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:7px;}
  .vs-lbl{font-size:10.5px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:rgba(240,232,255,.62);}
  .vs-link{border:0;background:transparent;color:rgba(240,232,255,.5);cursor:pointer;font:inherit;font-size:10px;padding:0;}
  .vs-link:hover{color:${P.texto};}
  .vs-color{width:46px;height:32px;padding:3px;border-radius:5px;cursor:pointer;flex-shrink:0;
    background:#09090c;border:1px solid rgba(240,232,255,.25);}
  .vs-hex{flex:1;min-width:0;font-family:ui-monospace,Consolas,monospace;font-size:12px;}
  .vs-tile{width:48px;height:48px;border-radius:10px;overflow:hidden;flex-shrink:0;display:grid;place-items:center;
    border:1px solid rgba(240,232,255,.15);color:rgba(240,232,255,.45);font-size:16px;}
  .vs-btn{padding:7px 13px;border-radius:999px;font:inherit;font-size:11.5px;font-weight:700;cursor:pointer;
    border:1px solid rgba(240,232,255,.18);background:transparent;color:${P.texto};}
  .vs-btn:disabled{opacity:.45;cursor:default;}
  .vs-prev{position:relative;overflow:hidden;border-radius:14px;padding:16px;border:1px solid rgba(240,232,255,.12);}
`;

/** Color: selector + código hex, con «Restablecer». */
function Color({ label, valor, defecto, onGuardar, ocupado }) {
  const [hex, setHex] = useState(valor || "");
  const timer = useRef(null);
  useEffect(() => { setHex(valor || ""); }, [valor]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const efectivo = esHex(hex) ? hex : defecto;
  const guardarHex = () => {
    const v = hex.trim();
    if (v === (valor || "")) return;
    if (v && !esHex(v)) { setHex(valor || ""); return; }
    onGuardar(v || null);
  };

  return (
    <div className="vs-campo">
      <div className="vs-fila">
        <span className="vs-lbl">{label}</span>
        <button type="button" className="vs-link" disabled={ocupado || !valor} onClick={() => onGuardar(null)}>
          Restablecer
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="color" className="vs-color" value={efectivo} disabled={ocupado} aria-label={label}
          onChange={(e) => {
            const c = e.target.value;
            setHex(c);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => { if (c !== valor) onGuardar(c); }, 600);
          }}/>
        <input className="pdj-input vs-hex" value={hex} placeholder={defecto} disabled={ocupado}
          aria-label={`${label} (hex)`}
          onChange={(e) => setHex(e.target.value)} onBlur={guardarHex}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}/>
      </div>
      {hex && !esHex(hex) && (
        <div className="vs-desc" style={{ color: P.amarillo }}>Usá un hexadecimal de 6 dígitos, por ejemplo {defecto}.</div>
      )}
    </div>
  );
}

/** Imagen: miniatura + «Subir / Reemplazar», con «Quitar». */
function Imagen({ label, valor, onGuardar, onError, ocupado }) {
  const ref = useRef(null);
  const [subiendo, setSubiendo] = useState(false);
  const subir = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSubiendo(true);
    try {
      const asset = await uploadMediaAsset(file, { category: "dj-branding" });
      if (asset?.file_url) await onGuardar(asset.file_url);
    } catch (err) { onError?.(err); }
    finally { setSubiendo(false); }
  };

  return (
    <div className="vs-campo">
      <div className="vs-fila">
        <span className="vs-lbl">{label}</span>
        {valor && <button type="button" className="vs-link" disabled={ocupado} onClick={() => onGuardar(null)}>Quitar</button>}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div className="vs-tile">
          {valor ? <img src={valor} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }}/> : "×"}
        </div>
        <button type="button" className="vs-btn" disabled={ocupado || subiendo} onClick={() => ref.current?.click()}>
          {subiendo ? "Subiendo…" : valor ? "⤒ Reemplazar" : "⤒ Subir"}
        </button>
        <input ref={ref} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={subir}/>
      </div>
    </div>
  );
}

export default function SeccionVisual({ event, refresh, onError }) {
  const [ocupado, setOcupado] = useState(false);

  const guardar = (campo) => async (valor) => {
    setOcupado(true); onError?.(null);
    try {
      await saveEventFields(event.id, { [campo]: valor });
      await refresh();
    } catch (err) { onError?.(err); }
    finally { setOcupado(false); }
  };

  const acento = esHex(event.accent_color) ? event.accent_color : DEFECTOS.accent_color;
  const texto  = esHex(event.text_color) ? event.text_color : DEFECTOS.text_color;
  const fondo  = esHex(event.background_color) ? event.background_color : DEFECTOS.background_color;

  return (
    <PanelSection id="visual" title="Personalización visual">
      <style>{css}</style>
      <div className="vs-caja">
        <div className="vs-cab">Personalización visual</div>
        <div className="vs-desc">Dejá cualquier campo vacío para usar el estilo por defecto.</div>
        <div className="vs-desc">
          Se aplica en la TV y en la votación del celular. Acento: nombre del evento, QR y «Sonando ahora».
          Texto: los títulos de los temas. Fondo e imagen: detrás de todo. Logo: el bloque Logo de la TV y la
          tarjeta «Sonando ahora». Lo que fijes a mano en el Diseñador DJ Democracy o en un tema del Diseñador
          Cliente tiene prioridad.
        </div>

        <Color label="Color de acento" valor={event.accent_color} defecto={DEFECTOS.accent_color}
          ocupado={ocupado} onGuardar={guardar("accent_color")}/>
        <Color label="Color de texto" valor={event.text_color} defecto={DEFECTOS.text_color}
          ocupado={ocupado} onGuardar={guardar("text_color")}/>
        <Color label="Color de fondo" valor={event.background_color} defecto={DEFECTOS.background_color}
          ocupado={ocupado} onGuardar={guardar("background_color")}/>

        <Imagen label="Logo" valor={event.logo_url} ocupado={ocupado}
          onGuardar={guardar("logo_url")} onError={onError}/>
        <Imagen label="Imagen de fondo" valor={event.background_image_url} ocupado={ocupado}
          onGuardar={guardar("background_image_url")} onError={onError}/>

        <div className="vs-campo">
          <div className="vs-fila"><span className="vs-lbl" style={{ fontWeight: 600 }}>Vista previa</span></div>
          <div className="vs-prev" style={{ background: fondo }}>
            {event.background_image_url && (
              <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${event.background_image_url})`,
                backgroundSize: "cover", backgroundPosition: "center", opacity: .28 }}/>
            )}
            <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12 }}>
              {event.logo_url && <img src={event.logo_url} alt="" style={{ width: 52, height: 52, objectFit: "contain" }}/>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: acento, fontSize: 10, fontWeight: 800, letterSpacing: .4 }}>
                  {(event.name || "Mi evento").toUpperCase()}
                </div>
                <div style={{ color: texto, fontSize: 14, fontWeight: 900, marginTop: 2 }}>Título de canción</div>
                <div style={{ height: 6, borderRadius: 999, background: "rgba(240,232,255,.15)", marginTop: 8, overflow: "hidden" }}>
                  <div style={{ width: "50%", height: "100%", background: acento }}/>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PanelSection>
  );
}
