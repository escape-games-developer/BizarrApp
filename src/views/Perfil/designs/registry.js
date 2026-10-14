import ProfileDesignOriginal from "./ProfileDesignOriginal";
import ProfileDesignCantoni from "./ProfileDesignCantoni";

/**
 * Registro de diseños de "Mi Perfil": clave estable de renderer → componente.
 *
 * La clave identifica el renderer, no la variante: el nombre visible de una
 * variante puede cambiar sin tocar este registro.
 *
 *   profile_original  Diseño Jorge (Vista Original)
 *   profile_cantoni   Diseño Cantoni
 */
export const DEFAULT_PROFILE_DESIGN = "profile_original";

const PROFILE_DESIGNS = {
  profile_original: ProfileDesignOriginal,
  profile_cantoni:  ProfileDesignCantoni,
};

/**
 * `design_key` de client_design_active (sección "profile") → clave de
 * renderer. La base guarda "original" | "cantoni", igual que el resto de las
 * secciones; null o desconocido → Diseño Jorge.
 */
const RENDERER_BY_DESIGN_KEY = {
  original: "profile_original",
  cantoni:  "profile_cantoni",
};

export const profileRendererForDesign = (designKey) =>
  RENDERER_BY_DESIGN_KEY[designKey] ?? DEFAULT_PROFILE_DESIGN;

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
