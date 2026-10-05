import { useCallback, useEffect, useRef, useState } from "react";
import { activateDesign, fetchActiveDesigns } from "../../services/clientDesign";

/**
 * Diseños activos de la app Cliente (`client_design_active`) para el Diseñador
 * Cliente: `{ [section]: design_key }` + `activar(section, designKey)`.
 *
 * Se lee al montar y, después de activar, se usa lo guardado. Si la tabla no
 * existe (migración sin aplicar) `active` queda vacío y el catálogo muestra su
 * activo por defecto; el error se informa al activar.
 */
export function useActiveClientDesigns() {
  const [active,  setActive]  = useState({});
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    fetchActiveDesigns()
      .then((map) => { if (montado.current) setActive(map); })
      .catch((e) => {
        console.error("[useActiveClientDesigns] fetch:", e);
        if (montado.current) setError("No se pudo leer el diseño activo del Cliente.");
      })
      .finally(() => { if (montado.current) setLoading(false); });
    return () => { montado.current = false; };
  }, []);

  /** Tira con un mensaje legible si no se guardó. */
  const activar = useCallback(async (section, designKey) => {
    const guardado = await activateDesign(section, designKey);
    if (montado.current) { setActive((prev) => ({ ...prev, [section]: guardado })); setError(null); }
    return guardado;
  }, []);

  return { active, loading, error, activar };
}
