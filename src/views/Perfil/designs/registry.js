import ProfileDesignOriginal from "./ProfileDesignOriginal";

/**
 * Registro de diseños de "Mi Perfil": clave estable de renderer → componente.
 *
 * La clave identifica el renderer, no la variante: el nombre visible de una
 * variante puede cambiar sin tocar este registro. Por ahora hay un solo
 * diseño y nadie elige otro; esto es sólo el punto de extensión.
 */
export const DEFAULT_PROFILE_DESIGN = "profile_original";

const PROFILE_DESIGNS = {
  profile_original: ProfileDesignOriginal,
};

/** ¿Existe un renderer con esa clave? (para validar sin caer en el fallback) */
export function hasProfileDesign(key) {
  return Object.hasOwn(PROFILE_DESIGNS, key);
}

/** Clave desconocida → diseño Original. */
export function resolveProfileDesign(key) {
  return Object.hasOwn(PROFILE_DESIGNS, key)
    ? PROFILE_DESIGNS[key]
    : PROFILE_DESIGNS[DEFAULT_PROFILE_DESIGN];
}
