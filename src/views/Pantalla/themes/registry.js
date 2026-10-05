import { CANTONI_THEME } from "./cantoniTheme";

/**
 * Temas visuales de Pantalla › DJ Democracy, por `design_key` (client_design_active,
 * sección "pantalla"; mismo valor que `designKey` en temporaryDesignCatalog).
 *
 * La Vista Original es el CSS base (djVotingStyles.js) sin tema encima: por eso
 * su entrada es null. Una clave desconocida (o null: sin dato) también cae ahí.
 */
export const DEFAULT_PANTALLA_DESIGN = "original";

const PANTALLA_THEMES = Object.freeze({
  [DEFAULT_PANTALLA_DESIGN]: null,
  [CANTONI_THEME.id]:        CANTONI_THEME,
});

export const hasPantallaDesign = (id) => Object.hasOwn(PANTALLA_THEMES, id);

export const resolvePantallaTheme = (id) =>
  (hasPantallaDesign(id) ? PANTALLA_THEMES[id] : null);
