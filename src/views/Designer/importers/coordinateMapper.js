export function mapRect(rect, rootRect, viewport) {
  const sx=viewport.width/rootRect.width, sy=viewport.height/rootRect.height;
  return { x:Math.round((rect.left-rootRect.left)*sx), y:Math.round((rect.top-rootRect.top)*sy), width:Math.max(1,Math.round(rect.width*sx)), height:Math.max(1,Math.round(rect.height*sy)) };
}
