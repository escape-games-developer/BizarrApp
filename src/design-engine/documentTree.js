/** Operaciones inmutables sobre el árbol de un DesignDocument. */

export function walkNodes(node, visit, depth = 0, parent = null) {
  visit(node, depth, parent);
  for (const child of node.children ?? []) walkNodes(child, visit, depth + 1, node);
}

export function findNode(root, id) {
  let found = null;
  walkNodes(root, (n) => { if (!found && n.id === id) found = n; });
  return found;
}

/** Devuelve un root nuevo con el nodo `id` reemplazado por `updater(nodo)`. */
export function updateNode(root, id, updater) {
  if (root.id === id) return updater(root);
  if (!root.children) return root;
  let changed = false;
  const children = root.children.map((c) => {
    const next = updateNode(c, id, updater);
    if (next !== c) changed = true;
    return next;
  });
  return changed ? { ...root, children } : root;
}

/** Copia `obj` con el valor en `path` ("box.padding", "style.fontSize"…). `undefined` lo borra. */
export function setPath(obj, path, value) {
  const [head, ...rest] = path.split(".");
  const base = obj ?? {};
  if (rest.length === 0) {
    const next = { ...base };
    if (value === undefined) delete next[head]; else next[head] = value;
    return next;
  }
  return { ...base, [head]: setPath(base[head], rest.join("."), value) };
}

export const getPath = (obj, path) => path.split(".").reduce((v, k) => (v == null ? undefined : v[k]), obj);
