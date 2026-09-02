import { useState } from "react";
import { Chips, ColorField, Field, inputStyle, NumberField, SectionCard } from "../components/Controls";
import { createTvBlock, TV_BLOCKS } from "../defaults";
import { designerTheme as T } from "../theme";

const modes = [{ value: "none", label: "Ninguno" }, { value: "color", label: "Color" }, { value: "image", label: "Imagen" }];
const sizes = [{ value: "small", label: "Chico" }, { value: "medium", label: "Medio" }, { value: "large", label: "Grande" }];
const fontOptions = <><option value="inherit">Predeterminada</option><option value="inter">Inter</option><option value="poppins">Poppins</option><option value="space">Space Grotesk</option><option value="system">Sistema</option></>;

function FileField({ onLoad }) {
  const [error, setError] = useState("");
  const read = event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 700 * 1024) {
      setError("La imagen supera 700 KB. Usá una imagen más chica o pegá una URL.");
      event.target.value = "";
      return;
    }
    setError("");
    const reader = new FileReader();
    reader.onload = () => onLoad(String(reader.result));
    reader.onerror = () => setError("No se pudo leer la imagen seleccionada.");
    reader.readAsDataURL(file);
  };
  return <><input type="file" accept="image/*" onChange={read} style={{ ...inputStyle, padding: 6, marginTop: 7 }}/>{error && <p role="alert" style={{ color: "#fca5a5", fontSize: 10, lineHeight: 1.35, margin: "6px 0 0" }}>{error}</p>}</>
}

function BackgroundEditor({ value, onChange, screen = false }) {
  const modeKey = screen ? "backgroundMode" : "mode";
  const colorKey = screen ? "backgroundColor" : "color";
  const imageKey = screen ? "backgroundImage" : "image";
  return <div style={{ display: "grid", gap: 9 }}>
    <Chips value={value[modeKey]} options={modes} onChange={mode => onChange({ ...value, [modeKey]: mode })}/>
    {value[modeKey] === "color" && <ColorField label="Color" value={value[colorKey]} onChange={color => onChange({ ...value, [colorKey]: color })}/>} 
    {value[modeKey] === "image" && <>
      <input style={inputStyle} value={value[imageKey] || ""} placeholder="URL de la imagen" onChange={event => onChange({ ...value, [imageKey]: event.target.value || null })}/>
      <FileField onLoad={image => onChange({ ...value, [imageKey]: image })}/>
    </>}
  </div>;
}

function AssetCreator({ onAdd }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("image");
  const [image, setImage] = useState(null);
  const submit = () => {
    if (!title.trim() || !image) return;
    onAdd({ title: title.trim(), kind, image });
    setTitle(""); setKind("image"); setImage(null);
  };
  return <div style={{ display: "grid", gap: 8 }}>
    <input style={inputStyle} value={title} placeholder="Título del bloque" onChange={event => setTitle(event.target.value)}/>
    <select style={inputStyle} value={kind} onChange={event => setKind(event.target.value)}><option value="logo">Logo</option><option value="qr">QR</option><option value="image">Imagen</option></select>
    <FileField onLoad={setImage}/>
    {image && <span style={{ color: T.success, fontSize: 10 }}>✓ Archivo listo</span>}
    <button type="button" disabled={!title.trim() || !image} onClick={submit} style={{ ...inputStyle, background: title.trim() && image ? T.gradientPrimary : T.muted, border: 0, color: title.trim() && image ? "#160b04" : T.mutedForeground, cursor: title.trim() && image ? "pointer" : "not-allowed", fontWeight: 800 }}>＋ Agregar bloque</button>
  </div>;
}

export default function TvPropertiesPanel({ config, selectedId, onScreenChange, onBlockChange, onSelect, onCustomBlocksChange }) {
  const customBlocks = config.customBlocks || {};
  const selected = selectedId ? config.blocks[selectedId] || customBlocks[selectedId] : null;
  const meta = TV_BLOCKS.find(item => item.id === selectedId) || (customBlocks[selectedId] ? { id: selectedId, label: customBlocks[selectedId].title } : null);
  const isCustom = Boolean(customBlocks[selectedId]);
  const contentEditable = isCustom || selectedId === "logo" || selectedId === "qr";
  const patchBlock = patch => onBlockChange(selectedId, { ...selected, ...patch });
  const patchNested = (key, patch) => patchBlock({ [key]: { ...selected[key], ...patch } });
  const configBytes = new TextEncoder().encode(JSON.stringify(config)).length;
  const configSize = configBytes < 1024 ? `${configBytes} B` : `${(configBytes / 1024).toFixed(1)} KB`;

  return <aside style={{ background: T.surface, borderLeft: `1px solid ${T.border}`, display: "flex", flex: "0 0 320px", flexDirection: "column", gap: 11, overflowY: "auto", padding: 14 }}>
    <div style={{ color: T.mutedForeground, fontSize: 10, textAlign: "right" }}>config: {configSize}</div>
    <SectionCard title="Fondo general de la pantalla">
      <BackgroundEditor value={config.screen} screen onChange={onScreenChange}/>
    </SectionCard>

    <SectionCard title="Marco (overlay)">
      <label style={{ alignItems: "center", display: "flex", gap: 7, fontSize: 11, marginBottom: 8 }}>
        <input type="checkbox" checked={config.screen.overlay.enabled} onChange={event => onScreenChange({ ...config.screen, overlay: { ...config.screen.overlay, enabled: event.target.checked } })}/> Habilitar
      </label>
      <p style={{ color: T.mutedForeground, fontSize: 10, lineHeight: 1.4, marginBottom: 8 }}>PNG con transparencia diseñado para 1920x1080. Va por encima de todo (reacciones y banners incluidos).</p>
      <input style={inputStyle} value={config.screen.overlay.url || ""} placeholder="URL del PNG" onChange={event => onScreenChange({ ...config.screen, overlay: { ...config.screen.overlay, url: event.target.value || null } })}/>
      <FileField onLoad={url => onScreenChange({ ...config.screen, overlay: { ...config.screen.overlay, url } })}/>
      <Field label={`Opacidad ${Math.round(config.screen.overlay.opacity * 100)}%`}><input style={{ width: "100%", accentColor: T.primary }} type="range" min="0" max="1" step="0.05" value={config.screen.overlay.opacity} onChange={event => onScreenChange({ ...config.screen, overlay: { ...config.screen.overlay, opacity: Number(event.target.value) } })}/></Field>
    </SectionCard>

    <SectionCard title="Emojis de reacciones">
      <p style={{ color: T.mutedForeground, fontSize: 10, lineHeight: 1.4, marginBottom: 8 }}>Tamaño de los emojis flotantes que envían los invitados.</p>
      <Chips value={config.screen.reactionEmojiSize} options={sizes} onChange={reactionEmojiSize => onScreenChange({ ...config.screen, reactionEmojiSize })}/>
    </SectionCard>

    <SectionCard title="Agregar archivo como bloque">
      <p style={{ color: T.mutedForeground, fontSize: 10, lineHeight: 1.4, marginBottom: 8 }}>Creá logos, QR o imágenes independientes. Máximo 700 KB por archivo.</p>
      <AssetCreator onAdd={({ title, kind, image }) => {
        const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const custom = createTvBlock({ title, kind, x: 10, y: 10, w: kind === "qr" ? 18 : 22, h: kind === "qr" ? 28 : 18, z: 10, bg: { mode: "image", color: "#111111", image, opacity: 1 } });
        onCustomBlocksChange({ ...customBlocks, [id]: custom });
        onSelect(id);
      }}/>
    </SectionCard>

    <SectionCard title="Bloques">
      <div style={{ display: "grid", gap: 5, gridTemplateColumns: "1fr 1fr" }}>
        {TV_BLOCKS.map(item => <button data-block-chip={item.id} type="button" key={item.id} onClick={() => onSelect(item.id)} style={{
          background: selectedId === item.id ? "rgba(249,115,22,.12)" : T.muted,
          border: `1px solid ${selectedId === item.id ? T.primary : T.border}`, borderRadius: 8,
          color: selectedId === item.id ? T.primaryGlow : T.mutedForeground, cursor: "pointer", fontSize: 9, minHeight: 34, padding: 5,
        }}>{item.label}</button>)}
      </div>
      {Object.keys(customBlocks).length > 0 && <div style={{ marginTop: 10 }}>
        <div style={{ color: T.mutedForeground, fontSize: 9, fontWeight: 800, marginBottom: 6, textTransform: "uppercase" }}>Archivos personalizados</div>
        <div style={{ display: "grid", gap: 5, gridTemplateColumns: "1fr 1fr" }}>{Object.entries(customBlocks).map(([id, item]) => <button data-block-chip={id} type="button" key={id} onClick={() => onSelect(id)} style={{ background: selectedId === id ? "rgba(249,115,22,.12)" : T.muted, border: `1px solid ${selectedId === id ? T.primary : T.border}`, borderRadius: 8, color: selectedId === id ? T.primaryGlow : T.mutedForeground, cursor: "pointer", fontSize: 9, minHeight: 34, padding: 5 }}>{item.title}<br/><span style={{ opacity: .65 }}>{item.kind === "qr" ? "QR" : item.kind === "logo" ? "Logo" : "Imagen"}</span></button>)}</div>
      </div>}
    </SectionCard>

    {selected && <>
      <SectionCard title={meta.label}>
        {isCustom && <div style={{ display: "grid", gap: 8, marginBottom: 9 }}>
          <Field label="Título"><input style={inputStyle} value={selected.title} onChange={event => patchBlock({ title: event.target.value })}/></Field>
          <Field label="Categoría"><select style={inputStyle} value={selected.kind} onChange={event => patchBlock({ kind: event.target.value })}><option value="logo">Logo</option><option value="qr">QR</option><option value="image">Imagen</option></select></Field>
        </div>}
        <button data-visibility-toggle type="button" onClick={() => patchBlock({ visible: !selected.visible })} style={{ width: "100%", ...inputStyle, cursor: "pointer", color: selected.visible ? T.primaryGlow : T.mutedForeground }}>
          {selected.visible ? "◉ Visible" : "○ Oculto"}
        </button>
        {isCustom && <button type="button" onClick={() => { const next = { ...customBlocks }; delete next[selectedId]; onCustomBlocksChange(next); onSelect("video"); }} style={{ width: "100%", ...inputStyle, background: "rgba(239,68,68,.1)", borderColor: T.destructive, color: "#fca5a5", cursor: "pointer", marginTop: 8 }}>Eliminar bloque personalizado</button>}
      </SectionCard>

      <SectionCard title="Geometría">
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
          <NumberField label="X %" value={selected.x} onChange={x => patchBlock({ x })}/><NumberField label="Y %" value={selected.y} onChange={y => patchBlock({ y })}/>
          <NumberField label="Ancho %" value={selected.w} onChange={w => patchBlock({ w })}/><NumberField label="Alto %" value={selected.h} onChange={h => patchBlock({ h })}/>
        </div>
        <div style={{ alignItems: "end", display: "grid", gap: 6, gridTemplateColumns: "1fr auto auto", marginTop: 8 }}>
          <NumberField label="Capa" value={selected.z} step={1} onChange={z => patchBlock({ z })}/>
          <button type="button" title="Subir una capa" onClick={() => patchBlock({ z: Number(selected.z || 0) + 1 })} style={{ ...inputStyle, cursor: "pointer", padding: "7px 10px" }}>↑</button>
          <button type="button" title="Bajar una capa" onClick={() => patchBlock({ z: Math.max(0, Number(selected.z || 0) - 1) })} style={{ ...inputStyle, cursor: "pointer", padding: "7px 10px" }}>↓</button>
        </div>
      </SectionCard>

      {contentEditable && <SectionCard title="Imagen y fondo">
        <BackgroundEditor value={selected.bg} onChange={bg => patchBlock({ bg })}/>
        <div style={{ marginTop: 9 }}><Field label={`Opacidad del fondo ${Math.round(selected.bg.opacity * 100)}%`}><input style={{ width: "100%", accentColor: T.primary }} type="range" min="0" max="1" step="0.05" value={selected.bg.opacity} onChange={event => patchNested("bg", { opacity: Number(event.target.value) })}/></Field></div>
        <div style={{ marginTop: 9 }}><Field label={`Opacidad del bloque ${Math.round(selected.opacity * 100)}%`}><input style={{ width: "100%", accentColor: T.primary }} type="range" min="0" max="1" step="0.05" value={selected.opacity} onChange={event => patchBlock({ opacity: Number(event.target.value) })}/></Field></div>
      </SectionCard>}

      {contentEditable && selectedId !== "qr" && <SectionCard title="Texto dentro del componente">
        <div style={{ display: "grid", gap: 9 }}>
          <Field label="Texto"><input style={inputStyle} value={selected.content?.text || ""} placeholder="Sin texto" onChange={event => patchNested("content", { text: event.target.value })}/></Field>
          <Field label="Posición"><Chips value={selected.content?.textPosition || "bottom"} options={[{ value: "top", label: "Arriba" }, { value: "bottom", label: "Abajo" }]} onChange={textPosition => patchNested("content", { textPosition })}/></Field>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}><NumberField label="Tamaño (px)" value={selected.content?.textSize || 16} min={6} onChange={textSize => patchNested("content", { textSize })}/><ColorField label="Color" value={selected.content?.textColor || "#ffffff"} onChange={textColor => patchNested("content", { textColor })}/></div>
          <label style={{ alignItems: "center", display: "flex", gap: 7, fontSize: 11 }}><input type="checkbox" checked={selected.content?.bold ?? true} onChange={event => patchNested("content", { bold: event.target.checked })}/> Negrita</label>
        </div>
      </SectionCard>}

      {selectedId === "qr" && <SectionCard title="QR · Contenido">
        <div style={{ display: "grid", gap: 9 }}>
          <label style={{ alignItems: "center", display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11 }}>
            <span>Mostrar código del evento</span><input type="checkbox" checked={selected.content?.showCode ?? false} onChange={event => patchNested("content", { showCode: event.target.checked })}/>
          </label>
          <label style={{ alignItems: "center", display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11 }}>
            <span>Mostrar subtítulo (“Entrá y votá…”)</span><input type="checkbox" checked={selected.content?.showSubtitle ?? false} onChange={event => patchNested("content", { showSubtitle: event.target.checked })}/>
          </label>
          {selected.content?.showSubtitle && <Field label="Texto del subtítulo"><input style={inputStyle} value={selected.content?.subtitle || ""} onChange={event => patchNested("content", { subtitle: event.target.value })}/></Field>}
          <Field label="Posición del texto"><select style={inputStyle} value={selected.content?.textPosition || "top"} onChange={event => patchNested("content", { textPosition: event.target.value })}><option value="top">Arriba del QR</option><option value="bottom">Abajo del QR</option></select></Field>
          <Field label="Alineación del texto"><Chips value={selected.font.align} options={[{ value: "left", label: "Izquierda" }, { value: "center", label: "Centro" }, { value: "right", label: "Derecha" }]} onChange={align => patchNested("font", { align })}/></Field>
        </div>
      </SectionCard>}

      {selectedId === "qr" && <SectionCard title="Tipografía · Etiqueta">
        <div style={{ display: "grid", gap: 9 }}>
          <Field label="Fuente"><select style={inputStyle} value={selected.content?.labelFont || "inherit"} onChange={event => patchNested("content", { labelFont: event.target.value })}>{fontOptions}</select></Field>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
            <NumberField label="Tamaño (px)" min={6} value={selected.content?.labelSize ?? 18} onChange={labelSize => patchNested("content", { labelSize })}/>
            <ColorField label="Color" value={selected.content?.labelColor || "#FFD600"} onChange={labelColor => patchNested("content", { labelColor })}/>
          </div>
        </div>
      </SectionCard>}

      {selectedId === "qr" && <SectionCard title="Tipografía · Código">
        <div style={{ display: "grid", gap: 9 }}>
          <Field label="Fuente"><select style={inputStyle} value={selected.content?.codeFont || "inherit"} onChange={event => patchNested("content", { codeFont: event.target.value })}>{fontOptions}</select></Field>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
            <NumberField label="Tamaño (px)" min={6} value={selected.content?.codeSize} onChange={codeSize => patchNested("content", { codeSize })}/>
            <ColorField label="Color" value={selected.content?.codeColor || "#FFD600"} onChange={codeColor => patchNested("content", { codeColor })}/>
          </div>
          <p style={{ color: T.mutedForeground, fontSize: 9, lineHeight: 1.4, margin: 0 }}>Dejá el tamaño vacío para usar el tamaño automático proporcional al bloque.</p>
        </div>
      </SectionCard>}

      <SectionCard title="Borde">
        <label style={{ alignItems: "center", display: "flex", gap: 7, fontSize: 11, marginBottom: 9 }}><input type="checkbox" checked={selected.border.enabled ?? false} onChange={event => patchNested("border", { enabled: event.target.checked })}/> Mostrar borde en la TV</label>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}><NumberField label="Grosor (px)" min={0} max={8} step={1} value={selected.border.width} onChange={width => patchNested("border", { width })}/><ColorField label="Color" value={selected.border.color} onChange={color => patchNested("border", { color })}/></div>
      </SectionCard>

      {contentEditable && <SectionCard title="Sombra">
        <label style={{ alignItems: "center", display: "flex", gap: 7, fontSize: 11, marginBottom: 9 }}><input type="checkbox" checked={selected.shadow.enabled} onChange={event => patchNested("shadow", { enabled: event.target.checked })}/> Habilitar sombra</label>
        <Chips value={selected.shadow.strength} options={[{ value: "soft", label: "Suave" }, { value: "medium", label: "Media" }, { value: "strong", label: "Fuerte" }]} onChange={strength => patchNested("shadow", { strength })}/>
        <div style={{ marginTop: 9 }}><NumberField label="Esquinas redondeadas (px)" value={selected.radius} onChange={radius => patchBlock({ radius })}/></div>
      </SectionCard>}

      {contentEditable && selectedId !== "qr" && <SectionCard title="Tipografía">
        <div style={{ display: "grid", gap: 9 }}>
          <Field label="Fuente"><select style={inputStyle} value={selected.font.family} onChange={event => patchNested("font", { family: event.target.value })}>{fontOptions}</select></Field>
          <Field label="Alineación del texto"><Chips value={selected.font.align} options={[{ value: "left", label: "Izquierda" }, { value: "center", label: "Centro" }, { value: "right", label: "Derecha" }]} onChange={align => patchNested("font", { align })}/></Field>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
            <NumberField label="Título (px)" value={selected.font.titleSize} onChange={titleSize => patchNested("font", { titleSize })}/>
            <Field label="Grosor título"><select style={inputStyle} value={selected.font.titleWeight} onChange={event => patchNested("font", { titleWeight: event.target.value })}><option value="bold">Negrita</option><option value="normal">Normal</option></select></Field>
            <NumberField label="Artista (px)" value={selected.font.artistSize} onChange={artistSize => patchNested("font", { artistSize })}/><NumberField label="Puntaje (px)" value={selected.font.scoreSize} onChange={scoreSize => patchNested("font", { scoreSize })}/>
          </div>
          <ColorField label="Color título" value={selected.font.titleColor} onChange={titleColor => patchNested("font", { titleColor })}/><ColorField label="Color artista" value={selected.font.artistColor} onChange={artistColor => patchNested("font", { artistColor })}/><ColorField label="Color puntaje" value={selected.font.scoreColor} onChange={scoreColor => patchNested("font", { scoreColor })}/>
          <p style={{ color: T.mutedForeground, fontSize: 9, lineHeight: 1.4 }}>Dejá los tamaños vacíos para usar el tamaño automático. Si definís un color de puntaje, se pierde el verde/rojo automático.</p>
        </div>
      </SectionCard>}

      {selectedId === "upcoming" && <SectionCard title="Próximas canciones"><p style={{ color: T.mutedForeground, fontSize: 10, lineHeight: 1.4 }}>La cantidad de candidatos visibles se define en “Reglas de votación” del editor del evento.</p></SectionCard>}
    </>}
  </aside>;
}
