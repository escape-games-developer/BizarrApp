import { createDesignRegistry } from "../../design-engine/createDesignRegistry";
import { BASIC_COMPONENTS } from "../../design-engine/basicComponents";
import { PROFILE_BINDINGS, PROFILE_ACTIONS, PROFILE_COMPONENTS, PROFILE_SCENES } from "./profile/profileDesignDomain";

/**
 * Registro del Cliente: componentes básicos + dominios registrados. Hoy sólo
 * el dominio Perfil; cada sección nueva suma su módulo acá sin tocar el motor.
 *
 * Presets: estilos de tema ya existentes en src/constants/styles.js. Un nodo
 * con preset usa esa clase global (mismo CSS que el resto de la app).
 */
const CLIENT_PRESETS = {
  sectionHeader: { label: "Encabezado de sección", className: "sec-hdr" },
  card:          { label: "Card",                  className: "card" },
  cardTitle:     { label: "Título de card",        className: "card-title" },
  buttonPrimary: { label: "Botón principal",       className: "btn-primary" },
  buttonGhost:   { label: "Botón secundario",      className: "btn-ghost" },
};

export const clientDesignRegistry = createDesignRegistry({
  components: [...BASIC_COMPONENTS, ...PROFILE_COMPONENTS],
  bindings:   [...PROFILE_BINDINGS],
  actions:    [...PROFILE_ACTIONS],
  scenes:     [...PROFILE_SCENES],
  presets:    CLIENT_PRESETS,
});
