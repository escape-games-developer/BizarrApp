import { useRef } from "react";
import QRCode from "react-qr-code";
import { designerTheme as T } from "../theme";

const shadowMap = { soft: "0 6px 18px rgba(0,0,0,.3)", medium: "0 10px 28px rgba(0,0,0,.5)", strong: "0 16px 42px rgba(0,0,0,.75)" };
const handles = [
  ["nw", { left: -6, top: -6, cursor: "nwse-resize" }],
  ["ne", { right: -6, top: -6, cursor: "nesw-resize" }],
  ["sw", { left: -6, bottom: -6, cursor: "nesw-resize" }],
  ["se", { right: -6, bottom: -6, cursor: "nwse-resize" }],
];

function fontFamily(value) {
  return { inter: "Inter, sans-serif", poppins: "Poppins, sans-serif", space: "'Space Grotesk', sans-serif", system: "system-ui, sans-serif" }[value] || "inherit";
}

function BlockContent({ id, block }) {
  const titleStyle = { fontSize: "min(10cqw,18cqh)", fontWeight: block.font.titleWeight, color: block.font.titleColor || "#fff" };
  if (id.startsWith("custom-") || id === "logo") return null;
  if (id === "video") return <div style={{ alignItems: "center", background: "radial-gradient(circle,#202027,#050505 70%)", display: "flex", height: "100%", justifyContent: "center", width: "100%" }}><span style={{ color: "rgba(255,255,255,.32)", fontSize: "min(14cqw,22cqh)" }}>▶</span></div>;
  if (id === "qr") {
    const c = block.content || {};
    const labelSize = c.labelSize ? `${c.labelSize}px` : "min(8cqw,12cqh)";
    const codeSize = c.codeSize ? `${c.codeSize}px` : "min(11cqw,18cqh)";
    const label = <div style={{ color: c.labelColor || c.textColor || "#FFD600", fontFamily: fontFamily(c.labelFont), fontSize: labelSize, fontWeight: c.bold ? 800 : 400 }}>{c.text}</div>;
    return <div style={{ alignItems: block.font.align === "left" ? "flex-start" : block.font.align === "right" ? "flex-end" : "center", display: "flex", flexDirection: "column", gap: "3cqh", height: "100%", justifyContent: "center", padding: "4cqh 4cqw", textAlign: block.font.align }}>
      {c.textPosition !== "bottom" && label}
      <QRCode value="BIZARREN-DEMO" style={{ background: "white", height: "58cqh", maxWidth: "80cqw", padding: "2cqw", width: "auto" }}/>
      {c.showSubtitle && <span style={{ color: c.labelColor || "#FFD600", fontFamily: fontFamily(c.labelFont), fontSize: `max(8px,${Number(c.labelSize || 18) * .72}px)` }}>{c.subtitle || "Entrá y votá…"}</span>}
      {c.showCode && <b style={{ color: c.codeColor || "#FFD600", fontFamily: fontFamily(c.codeFont), fontSize: codeSize }}>ABC123</b>}
      {c.textPosition === "bottom" && label}
    </div>;
  }
  if (id === "upcoming") return <div style={{ height: "100%", padding: "5cqh 5cqw" }}><strong style={{ color: "#00e5ff", fontSize: "min(8cqw,13cqh)" }}>PRÓXIMAS CANCIONES</strong>{[1,2,3].map(n => <div key={n} style={{ alignItems: "center", background: "rgba(255,255,255,.05)", borderRadius: "2cqw", display: "flex", fontSize: "min(6cqw,10cqh)", gap: "3cqw", marginTop: "3cqh", padding: "2cqh 3cqw" }}><b>{n}</b><span>Canción {n}<small style={{ display: "block", opacity: .5 }}>Artista</small></span></div>)}</div>;
  if (id === "nowPlaying") return <div style={{ alignItems: "center", display: "flex", gap: "2cqw", height: "100%", padding: "2cqh 2cqw" }}><div style={{ aspectRatio: 1, background: "linear-gradient(135deg,#f97316,#9b2fff)", height: "80%", borderRadius: "2cqw" }}/><div><div style={titleStyle}>Todos me miran</div><div style={{ fontSize: "min(7cqw,14cqh)", color: block.font.artistColor || "#aaa" }}>Gloria Trevi</div></div></div>;
  if (id === "progress") return <div style={{ background: "rgba(255,255,255,.15)", borderRadius: 99, height: "20%", margin: "auto", overflow: "hidden", width: "90%" }}><span style={{ background: T.primary, display: "block", height: "100%", width: "45%" }}/></div>;
  const text = { header: "Pantalla Bizarren · ABC123", statusPills: "● EN VIVO   ● VOTACIÓN", gifPrize: "GIF + NOMBRE", transition: "TRANSICIÓN", votingClosed: "❄ VOTACIÓN CERRADA · 5S", kickCounter: "👎 SACAR TEMA · 3/5", teamScore: "🏆 MARCADOR DE EQUIPOS" }[id];
  return <div style={titleStyle}>{text}</div>;
}

function EditableText({ block }) {
  if (!block.content?.text) return null;
  return <div style={{ bottom: block.content.textPosition === "bottom" ? "3cqh" : "auto", color: block.content.textColor, fontSize: `min(${block.content.textSize / 2}cqw,${block.content.textSize / 2}cqh)`, fontWeight: block.content.bold ? 800 : 400, left: "4cqw", position: "absolute", right: "4cqw", textAlign: "center", textShadow: "0 2px 6px #000", top: block.content.textPosition === "top" ? "3cqh" : "auto", zIndex: 3 }}>{block.content.text}</div>;
}

export default function TvStage({ config, selectedId, onSelect, onBlockChange }) {
  const stageRef = useRef(null);
  const interaction = useRef(null);

  const start = (event, id, mode) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const block = config.blocks[id] || config.customBlocks?.[id];
    interaction.current = { id, mode, startX: event.clientX, startY: event.clientY, block: { ...block } };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    onSelect(id);
  };

  const move = event => {
    const active = interaction.current;
    if (!active || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const dx = ((event.clientX - active.startX) / rect.width) * 100;
    const dy = ((event.clientY - active.startY) / rect.height) * 100;
    const next = { ...active.block };
    if (active.mode === "move") {
      next.x += dx;
      next.y += dy;
    } else {
      if (active.mode.includes("e")) next.w += dx;
      if (active.mode.includes("s")) next.h += dy;
      if (active.mode.includes("w")) { next.x += dx; next.w -= dx; }
      if (active.mode.includes("n")) { next.y += dy; next.h -= dy; }
    }
    for (const prop of ["x", "y", "w", "h"]) next[prop] = Number(next[prop].toFixed(4));
    onBlockChange(active.id, next);
  };

  const stop = () => { interaction.current = null; };
  const screen = config.screen;
  const stageBackground = screen.backgroundMode === "color" ? screen.backgroundColor : "#0a0a0f";
  const stageImage = screen.backgroundMode === "image" && screen.backgroundImage ? `url(${screen.backgroundImage})` : "none";

  return <div data-tv-stage ref={stageRef} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onPointerLeave={event => { if (!event.buttons) stop(); }} onPointerDown={() => onSelect(null)} style={{
    width: "100%", aspectRatio: "16 / 9", background: stageBackground, backgroundImage: stageImage,
    backgroundPosition: "center", backgroundSize: "cover", border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 8, boxShadow: "0 24px 60px rgba(0,0,0,.65)", overflow: "hidden", position: "relative", touchAction: "none",
  }}>
    {Object.entries({ ...config.blocks, ...(config.customBlocks || {}) }).map(([id, block]) => block.visible && <div data-tv-block={id} key={id} onPointerDown={event => start(event, id, "move")} style={{
      alignItems: "center", backgroundColor: "transparent",
      border: `${selectedId === id ? 2 : block.border.enabled ? block.border.width : 0}px solid ${selectedId === id ? T.primary : block.border.color}`,
      borderRadius: block.radius, boxShadow: selectedId === id ? "0 10px 15px rgba(249,115,22,.3)" : block.shadow.enabled ? shadowMap[block.shadow.strength] : "none",
      color: "#fff", cursor: "move", display: "flex", flexDirection: "column", fontFamily: fontFamily(block.font.family),
      height: `${block.h}%`, justifyContent: "center", left: `${block.x}%`, opacity: block.opacity,
      containerType: "size", position: "absolute", textAlign: block.font.align, top: `${block.y}%`, userSelect: "none", width: `${block.w}%`, zIndex: block.z,
    }}>
      <span style={{ background: block.bg.mode === "color" ? block.bg.color : "transparent", backgroundImage: block.bg.mode === "image" && block.bg.image ? `url(${block.bg.image})` : "none", backgroundPosition: "center", backgroundRepeat: "no-repeat", backgroundSize: id === "logo" || id.startsWith("custom-") ? "contain" : "cover", borderRadius: "inherit", inset: 0, opacity: block.bg.opacity, pointerEvents: "none", position: "absolute" }}/>
      <div style={{ height: "100%", position: "relative", width: "100%" }}><BlockContent id={id} block={block}/></div>
      {(id === "logo" || id.startsWith("custom-")) && <EditableText block={block}/>} 
      {selectedId === id && handles.map(([corner, position]) => <span data-resize-handle={corner} key={corner} onPointerDown={event => start(event, id, corner)} style={{
        ...position, background: T.primary, border: "1px solid #fff", borderRadius: 2, height: 12, position: "absolute", width: 12, zIndex: 20,
      }}/>) }
    </div>)}
    {screen.overlay.enabled && screen.overlay.url && <img data-tv-overlay src={screen.overlay.url} alt="" draggable={false} style={{ inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: screen.overlay.opacity, pointerEvents: "none", position: "absolute", zIndex: 2147483647 }}/>} 
  </div>;
}
