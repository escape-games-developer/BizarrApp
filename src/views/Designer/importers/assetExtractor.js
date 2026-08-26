export function extractAsset(node) {
  if (node.tagName === "IMG") return { src:node.currentSrc||node.src, alt:node.alt||"" };
  if (node.tagName === "VIDEO") return { src:node.currentSrc||node.src||node.querySelector("source")?.src||"", poster:node.poster||"" };
  return null;
}
