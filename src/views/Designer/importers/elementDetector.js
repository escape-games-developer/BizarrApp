const TEXT_TAGS = new Set(["H1","H2","H3","H4","H5","H6","P","SPAN","LABEL","STRONG","EM","SMALL"]);
const CONTAINER_TAGS = new Set(["SECTION","ARTICLE","HEADER","FOOTER","NAV","ASIDE","FORM","MAIN"]);
const transparent = value => !value || value === "transparent" || value === "rgba(0, 0, 0, 0)";
export function detectElement(node, computed, rect) {
  if (computed.display === "none" || computed.visibility === "hidden" || Number(computed.opacity) === 0 || rect.width < 3 || rect.height < 3) return null;
  const tag=node.tagName; const designerComponent=node.dataset.designerComponent;
  if (designerComponent) return {type:"systemComponent",name:node.dataset.designerLabel||designerComponent,systemElement:true,componentId:designerComponent};
  if (node.matches(".sb,.mhdr,.app-nav,.app-header")) return {type:"systemComponent",name:node.matches(".sb")?"Sidebar":node.matches(".mhdr")?"Topbar":node.matches(".app-nav")?"Navegación":"Header",systemElement:true,componentId:node.className};
  if (tag === "IMG") return {type:"image",name:node.alt||"Imagen"};
  if (tag === "VIDEO") return {type:"video",name:"Video"};
  if (tag === "SVG") return {type:"icon",name:node.getAttribute("aria-label")||"Icono"};
  if (tag === "BUTTON" || (tag === "A" && (computed.backgroundColor !== "rgba(0, 0, 0, 0)" || computed.borderStyle !== "none"))) return {type:"button",name:(node.textContent||"Botón").trim().slice(0,40)};
  if (["INPUT","TEXTAREA","SELECT"].includes(tag)) return {type:"input",name:node.getAttribute("placeholder")||node.getAttribute("aria-label")||tag.toLowerCase()};
  const directText=Array.from(node.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join(" ").trim();
  if (TEXT_TAGS.has(tag) && directText) return {type:"text",name:directText.slice(0,40)};
  const visual=!transparent(computed.backgroundColor)||computed.backgroundImage!=="none"||computed.borderStyle!=="none"||computed.boxShadow!=="none";
  if ((CONTAINER_TAGS.has(tag) || node.className) && visual && rect.width*rect.height>900) return {type:"container",name:node.getAttribute("aria-label")||String(node.className).split(" ")[0]||tag.toLowerCase()};
  return null;
}
