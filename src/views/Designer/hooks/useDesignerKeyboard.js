import { useEffect } from "react";
import { useDesigner } from "../store/designerStore";

export default function useDesignerKeyboard() {
  const d = useDesigner();
  useEffect(() => {
    const onKey = event => {
      const tag = event.target?.tagName;
      if (["INPUT","TEXTAREA","SELECT"].includes(tag) || event.target?.isContentEditable) return;
      const mod = event.ctrlKey || event.metaKey;
      if (event.key === "Delete" || event.key === "Backspace") { if (d.selectedElementId) { event.preventDefault(); d.removeElement(d.selectedElementId); } }
      else if (mod && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? d.redo() : d.undo(); }
      else if (mod && event.key.toLowerCase() === "c") { event.preventDefault(); d.copy(); }
      else if (mod && event.key.toLowerCase() === "v") { event.preventDefault(); d.paste(); }
      else if (mod && event.key.toLowerCase() === "d") { event.preventDefault(); if(d.selectedElementId) d.duplicateElement(d.selectedElementId); }
      else if (mod && event.key.toLowerCase() === "s") { event.preventDefault(); d.save(); }
      else if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key) && d.selected?.positionMode === "free") {
        event.preventDefault(); const amount=event.shiftKey?10:1, dx=event.key==="ArrowLeft"?-amount:event.key==="ArrowRight"?amount:0,dy=event.key==="ArrowUp"?-amount:event.key==="ArrowDown"?amount:0;
        d.updateElement(d.selected.id,{x:d.selected.x+dx,y:d.selected.y+dy});
      }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [d]);
}
