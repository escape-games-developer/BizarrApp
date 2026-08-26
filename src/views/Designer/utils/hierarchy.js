export const DROP_TYPES=new Set(["page","section","container","row","column","stack","grid","eventsSection","navigationBar"]);
export const childrenOf=(elements,parentId)=>elements.filter(e=>(e.parentId||null)===(parentId||null)).sort((a,b)=>a.zIndex-b.zIndex);
export function descendantIds(elements,id){const result=new Set();let changed=true;while(changed){changed=false;elements.forEach(e=>{if((e.parentId===id||result.has(e.parentId))&&!result.has(e.id)){result.add(e.id);changed=true}})}return result}
export const canReparent=(elements,id,parentId)=>id!==parentId&&!descendantIds(elements,id).has(parentId);
