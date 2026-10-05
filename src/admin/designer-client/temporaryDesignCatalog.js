import { DEFAULT_PROFILE_DESIGN } from "../../views/Perfil/designs/registry";
import { PROFILE_ORIGINAL_DOCUMENT } from "../../client/design/profile/profileOriginalDocument";
import { DEFAULT_PANTALLA_DESIGN } from "../../views/Pantalla/themes/registry";

/**
 * TEMPORAL — será reemplazado por ui_design_variants / backend real.
 *
 * Catálogo de los diseños de la app Cliente que existen hoy en el código. No es
 * persistencia: no se guarda en localStorage ni en Supabase y no se puede
 * renombrar. Activar sólo se puede en ACTIVATABLE_SECTIONS, que guardan el
 * diseño activo en Supabase (nunca en localStorage). Cuando exista el backend, este
 * módulo se reemplaza por una lectura de la tabla con la misma forma de fila:
 *
 *   id            id interno estable e inmutable (≠ nombre visible)
 *   section       id de CLIENT_DESIGN_SECTIONS
 *   name          nombre visible (editable con backend)
 *   rendererKind  "native" = componente React registrado en la app Cliente
 *   rendererKey   clave del registro de renderers de esa sección
 *   isActive      el que ve el cliente cuando la sección no tiene fila en
 *                 client_design_active (uno por sección)
 *   isSystem      diseño de sistema: fallback, no se elimina
 *   scene         escena del motor que se edita (SceneDefinition.id)
 *   document      DesignDocument editable en el Diseñador Cliente
 *   designKey     valor de client_design_active.design_key (secciones activables)
 *
 * Vista Original no es una copia: `rendererKey` apunta al renderer que ya usa
 * la app Cliente (src/views/Perfil/designs/registry.js → ProfileDesignOriginal).
 * Hoy el Perfil siempre dibuja ese renderer, por eso figura como activo.
 *
 * `document` es la misma Vista Original expresada para el motor (V1): es lo
 * que se edita en el Diseñador. El Cliente todavía no lo usa.
 *
 * Pantalla: sus diseños son temas de DJ Democracy (src/views/Pantalla/themes).
 * El activo sí se guarda: tabla client_design_active (ver ACTIVATABLE_SECTIONS).
 */
const TEMPORARY_DESIGN_CATALOG = Object.freeze([
  Object.freeze({
    id:           "profile_original",
    section:      "profile",
    name:         "Vista Original",
    rendererKind: "native",
    rendererKey:  DEFAULT_PROFILE_DESIGN,
    isActive:     true,
    isSystem:     true,
    scene:        "profile.complete",
    document:     PROFILE_ORIGINAL_DOCUMENT,
  }),
  Object.freeze({
    id:           "pantalla_original",
    designKey:    DEFAULT_PANTALLA_DESIGN,
    section:      "pantalla",
    name:         "Vista Original",
    rendererKind: "native",
    rendererKey:  DEFAULT_PANTALLA_DESIGN,
    isActive:     true,
    isSystem:     true,
  }),
  Object.freeze({
    id:           "pantalla_cantoni",
    designKey:    "cantoni",
    section:      "pantalla",
    name:         "Diseño Cantoni",
    rendererKind: "native",
    rendererKey:  "cantoni",
    isActive:     false,
    isSystem:     false,
  }),
]);

/**
 * Secciones cuyo diseño activo se guarda en client_design_active (migración
 * 20261005230302) y que la app Cliente lee en vivo. El resto sigue fijo en código.
 */
export const ACTIVATABLE_SECTIONS = new Set(["pantalla"]);

/**
 * Diseños de una sección, en el orden del catálogo. Nunca mezcla secciones.
 * `activeKey` (de client_design_active) manda sobre el `isActive` del catálogo
 * si es un diseño conocido de la sección.
 */
export function designsForSection(sectionId, activeKey = null) {
  const designs = TEMPORARY_DESIGN_CATALOG.filter((d) => d.section === sectionId);
  if (!activeKey || !designs.some((d) => d.designKey === activeKey)) return designs;
  return designs.map((d) => ({ ...d, isActive: d.designKey === activeKey }));
}
