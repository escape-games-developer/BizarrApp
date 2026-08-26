import ResponsiveRenderer from "./ResponsiveRenderer";

function RendererElement({ element, data = {} }) {
  if (!element.visible) return null;
  const bound = element.binding?.field?.split(".").reduce((v, key) => v?.[key], data[element.binding?.source]);
  const style = { position:"absolute", left:element.x, top:element.y, width:element.width, height:element.height, transform:`rotate(${element.rotation || 0}deg)`, opacity:element.opacity, zIndex:element.zIndex, boxSizing:"border-box", display:"flex", alignItems:"center", justifyContent:element.styles.textAlign === "left" ? "flex-start" : element.styles.textAlign === "right" ? "flex-end" : "center", overflow:"hidden", ...element.styles };
  if (element.type === "image") return <img src={element.props.src || "/logo.png"} alt={element.name} style={{...style,objectFit:element.styles.objectFit || "contain"}} />;
  if (element.type === "video") return <video src={element.props.src} poster={element.props.poster} muted style={{...style,objectFit:element.styles.objectFit || "contain"}} />;
  if (element.type === "input") return <input value={element.props.text || ""} readOnly style={style} />;
  if (element.type === "container") return <div style={style} />;
  if (element.type === "systemComponent" || element.type === "icon") return <div style={style}>{element.props.text}</div>;
  if (element.type === "button") return <button style={{...style,border:0}}>{bound ?? element.props.text}</button>;
  return <div style={style}>{bound ?? element.props.text}</div>;
}

export default function ScreenRenderer({ document, pageId, data, style, editMode, onSelect, selectedId, onMoveElement }) {
  if (document.layoutMode === "responsive") return <ResponsiveRenderer document={document} pageId={pageId} data={data} viewportWidth={style?.width} editMode={editMode} onSelect={onSelect} selectedId={selectedId} onMoveElement={onMoveElement} />;
  const page = document.pages.find(p=>p.id===pageId) || document.pages[0];
  if (!page) return null;
  return <div style={{ position:"relative", width:document.viewport.width, height:document.viewport.height, overflow:"hidden", background:page.background.value, ...style }}>
    {page.elements.map(element=><RendererElement key={element.id} element={element} data={data}/>) }
  </div>;
}
