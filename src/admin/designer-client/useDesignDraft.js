import { useCallback, useMemo, useState } from "react";
import { updateNode, setPath } from "../../design-engine/documentTree";

/**
 * Borrador de un DesignDocument durante la sesión del editor. No persiste nada
 * (ni Supabase ni localStorage): al salir del diseño o recargar, se pierde.
 *
 * `setField(nodeId, "style.fontSize", 14)` — `undefined` borra la propiedad.
 * Borrar el modo de ancho/alto borra el objeto entero (`box.width`).
 */
export function useDesignDraft(baseDocument) {
  const [draft, setDraft] = useState(baseDocument);

  const isDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(baseDocument), [draft, baseDocument]);

  const setField = useCallback((nodeId, path, value) => {
    const target = value === undefined && path.endsWith(".mode") ? path.slice(0, -".mode".length) : path;
    setDraft((doc) => ({ ...doc, root: updateNode(doc.root, nodeId, (n) => setPath(n, target, value)) }));
  }, []);

  const reset = useCallback(() => setDraft(baseDocument), [baseDocument]);

  return { draft, isDirty, setField, reset };
}
