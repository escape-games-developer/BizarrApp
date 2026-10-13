import { useState, useEffect } from "react";

/**
 * ¿La pantalla cumple la media query? Se actualiza al rotar o redimensionar.
 * Para cuando el estilo inline necesita saberlo (los estilos de la app son
 * inline y no pueden llevar @media).
 */
export function useMediaQuery(query) {
  const get = () => typeof window !== "undefined" && !!window.matchMedia?.(query).matches;
  const [matches, setMatches] = useState(get);

  useEffect(() => {
    const mql = window.matchMedia?.(query);
    if (!mql) return;
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
