import { detectElement } from "./elementDetector";
import { extractStyles,visualBackground } from "./styleExtractor";
import { mapRect } from "./coordinateMapper";
import { extractAsset } from "./assetExtractor";

const uid=()=>`imported-${Math.random().toString(36).slice(2,9)}`;
export function importScreenDom(frameWindow, definition) {
  const doc=frameWindow.document; const root=doc.querySelector(definition.rootSelector)||doc.body; const rootRect=root.getBoundingClientRect();
  if (!rootRect.width || !rootRect.height) throw new Error("La pantalla no produjo un contenedor visual medible.");
  const counters={found:0,imported:0,ignored:0,unsupported:0,text:0,image:0,button:0,container:0}; const elements=[]; const importedNodes=new Map();
  const nodes=[...root.querySelectorAll("*")]; counters.found=nodes.length;
  for (const node of nodes) {
    if (["SCRIPT","STYLE","NOSCRIPT"].includes(node.tagName)) { counters.ignored++; continue; }
    const computed=frameWindow.getComputedStyle(node); const rect=node.getBoundingClientRect(); const detected=detectElement(node,computed,rect);
    if (!detected) { counters.ignored++; continue; }
    if ([...importedNodes.keys()].some(parent=>parent.contains(node) && importedNodes.get(parent).systemElement)) { counters.ignored++; continue; }
    const id=uid(); const mapped=mapRect(rect,rootRect,definition.viewport); const asset=extractAsset(node); const text=(node.textContent||"").trim().replace(/\s+/g," ");
    const parentNode=[...importedNodes.keys()].reverse().find(parent=>parent.contains(node));
    const props={ text:text.slice(0,500), ...(asset||{}), sourceCss:{display:computed.display,position:computed.position,transform:computed.transform} };
    if (detected.type==="input") props.text=node.value||node.placeholder||"";
    const element={id,name:detected.name||detected.type,type:detected.type,...mapped,rotation:0,opacity:Number(computed.opacity)||1,visible:true,locked:!!detected.systemElement,systemElement:!!detected.systemElement,zIndex:elements.length+1,styles:extractStyles(node,computed),props,parentId:parentNode?importedNodes.get(parentNode).id:undefined,source:{imported:true,sourceScreen:definition.id,sourceTag:node.tagName.toLowerCase(),sourceId:node.id||undefined,sourceClass:typeof node.className==="string"?node.className.slice(0,200):undefined,designerId:node.dataset.designerId,componentId:detected.componentId,route:node.tagName==="A"?node.getAttribute("href"):undefined}};
    elements.push(element); importedNodes.set(node,element); counters.imported++; counters[detected.type] = (counters[detected.type]||0)+1;
  }
  const rootStyle=frameWindow.getComputedStyle(root); const background=visualBackground(rootStyle);
  const result={version:1,target:definition.target,screenId:definition.id,source:{importedAt:new Date().toISOString(),route:definition.route,component:definition.component},viewport:{...definition.viewport,breakpoint:"desktop"},assets:elements.filter(e=>e.props.src).map(e=>({id:`asset-${e.id}`,src:e.props.src,type:e.type})),pages:[{id:`page-${definition.id}`,name:definition.name,background:{type:background.includes("gradient")?"gradient":"color",value:background||"#08040f"},elements}]};
  if (import.meta.env.DEV) console.info("Designer Import",{pantalla:`${definition.target} / ${definition.name}`,...counters});
  return {document:result,stats:counters};
}
