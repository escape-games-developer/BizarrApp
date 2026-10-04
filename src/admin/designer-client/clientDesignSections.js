/**
 * Secciones de la app Cliente que el Diseñador Cliente puede diseñar.
 *
 * Única definición: las pestañas, el catálogo de diseños y cualquier pieza
 * futura (backend `ui_design_variants.section`) usan estos `id`. El `id` es
 * técnico y estable — no se deriva del `label`, que es sólo texto de UI.
 */
export const CLIENT_DESIGN_SECTIONS = [
  { id: "novedades", label: "Novedades" },
  { id: "menu",      label: "Menú" },
  { id: "pantalla",  label: "Pantalla" },
  { id: "juegos",    label: "Juegos" },
  { id: "escenario", label: "Escenario" },
  { id: "profile",   label: "Perfil" },
];

/**
 * Pestaña con la que abre el Diseñador Cliente: Perfil, porque hoy es la única
 * sección con un diseño registrado (Vista Original) y con renderers
 * intercambiables en la app Cliente.
 */
export const DEFAULT_CLIENT_DESIGN_SECTION = "profile";

export const clientDesignSectionById = (id) =>
  CLIENT_DESIGN_SECTIONS.find((s) => s.id === id) ?? null;
