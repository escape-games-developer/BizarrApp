import { JORGE_DESIGN } from "./jorgeDesign";
import { CANTONI_NOVEDADES_DESIGN } from "./cantoniDesign";

/**
 * Diseños de Novedades, por `design_key` (client_design_active, sección
 * "novedades"; mismo valor que `designKey` en temporaryDesignCatalog).
 *
 * "original" es el Diseño Jorge. Una clave desconocida (o null: sin dato,
 * cargando) también cae ahí.
 */
export const DEFAULT_NOVEDADES_DESIGN = "original";

const NOVEDADES_DESIGNS = Object.freeze({
  [DEFAULT_NOVEDADES_DESIGN]:     JORGE_DESIGN,
  [CANTONI_NOVEDADES_DESIGN.id]:  CANTONI_NOVEDADES_DESIGN,
});

export const hasNovedadesDesign = (id) => Object.hasOwn(NOVEDADES_DESIGNS, id);

export const resolveNovedadesDesign = (id) =>
  (hasNovedadesDesign(id) ? NOVEDADES_DESIGNS[id] : JORGE_DESIGN);
