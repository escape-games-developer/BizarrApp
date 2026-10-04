import { DEFAULT_PROFILE_DESIGN } from "../../views/Perfil/designs/registry";
import { PROFILE_ORIGINAL_DOCUMENT } from "../../client/design/profile/profileOriginalDocument";

/**
 * TEMPORAL — será reemplazado por ui_design_variants / backend real.
 *
 * Catálogo de los diseños de la app Cliente que existen hoy en el código. No es
 * persistencia: no se guarda en localStorage ni en Supabase, no se puede
 * renombrar ni activar, y no simula hacerlo. Cuando exista el backend, este
 * módulo se reemplaza por una lectura de la tabla con la misma forma de fila:
 *
 *   id            id interno estable e inmutable (≠ nombre visible)
 *   section       id de CLIENT_DESIGN_SECTIONS
 *   name          nombre visible (editable con backend)
 *   rendererKind  "native" = componente React registrado en la app Cliente
 *   rendererKey   clave del registro de renderers de esa sección
 *   isActive      el que ve el cliente (uno por sección)
 *   isSystem      diseño de sistema: fallback, no se elimina
 *   scene         escena del motor que se edita (SceneDefinition.id)
 *   document      DesignDocument editable en el Diseñador Cliente
 *
 * Vista Original no es una copia: `rendererKey` apunta al renderer que ya usa
 * la app Cliente (src/views/Perfil/designs/registry.js → ProfileDesignOriginal).
 * Hoy el Perfil siempre dibuja ese renderer, por eso figura como activo.
 *
 * `document` es la misma Vista Original expresada para el motor (V1): es lo
 * que se edita en el Diseñador. El Cliente todavía no lo usa.
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
]);

/** Diseños de una sección, en el orden del catálogo. Nunca mezcla secciones. */
export function designsForSection(sectionId) {
  return TEMPORARY_DESIGN_CATALOG.filter((d) => d.section === sectionId);
}
