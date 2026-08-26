export const clampZoom=value=>Math.max(.1,Math.min(4,value));
export function fitViewport(area,screen,mode="screen"){const padding=60;const zx=(area.width-padding)/screen.width,zy=(area.height-padding)/screen.height,zoom=clampZoom(mode==="width"?zx:Math.min(zx,zy));return {zoom,panX:0,panY:0}}
