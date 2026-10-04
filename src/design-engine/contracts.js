/**
 * Motor del Diseñador Cliente — contratos V1.
 *
 * Un DesignDocument describe la COMPOSICIÓN visual de una escena; nunca datos
 * reales ni lógica. Los datos llegan por bindings y la funcionalidad por
 * acciones, ambos declarados por la escena y resueltos al dibujar.
 *
 *   SECCIÓN (profile, juegos…)
 *     └── ESCENA        SceneDefinition   (profile.complete, arma.playing…)
 *           └── DISEÑO  (Vista Original…; backend futuro: ui_design_variants)
 *                 └── DOCUMENTO  DesignDocument → árbol de DesignNode
 *
 * Nada de este módulo conoce una sección en particular: los dominios (Perfil,
 * y después juegos/escenario/…) registran sus componentes, bindings, acciones
 * y escenas en un registro (createDesignRegistry).
 *
 * ─── SceneDefinition ────────────────────────────────────────────────────────
 * @typedef {Object} SceneDefinition
 * @property {string}   id                 "profile.complete", "arma.playing"…
 * @property {string}   section            id de CLIENT_DESIGN_SECTIONS ("profile", "juegos"…)
 * @property {string=}  subject            qué dentro de la sección ("arma_palabra"); opcional
 * @property {string=}  state              estado funcional ("complete", "standby", "playing", "result")
 * @property {string}   label
 * @property {string[]} allowedComponents  claves de ComponentDefinition insertables en la escena
 * @property {string[]} bindings           claves de BindingDefinition que la escena provee
 * @property {string[]} actions            claves de ActionDefinition que la escena provee
 * @property {Array<{id:string,label:string,data:Object,shell?:Object}>} fixtures  datos de prueba ya adaptados (+ estado del shell)
 *
 * ─── DesignDocument ─────────────────────────────────────────────────────────
 * @typedef {Object} DesignDocument
 * @property {1}          version
 * @property {string}     scene     id de SceneDefinition
 * @property {DesignNode} root      siempre un Container
 *
 * ─── DesignNode ─────────────────────────────────────────────────────────────
 * Sólo lleva lo que usa. Identidad estable: `id` (nunca índices de array).
 * @typedef {Object} DesignNode
 * @property {string}  id
 * @property {string}  component   clave de ComponentDefinition ("container", "text", "profile.avatar"…)
 * @property {string=} name        nombre en el árbol de capas
 * @property {DesignNode[]=} children        sólo si la definición acepta hijos (contenedor, botón)
 * @property {Layout=}       layout          contenedores y botones
 * @property {Box=}          box             tamaño y espaciado
 * @property {Style=}        style           apariencia
 * @property {string=}       preset          estilo de tema (clase global: "card", "buttonPrimary"…)
 * @property {Object=}       props           texto, label, src, tag, props declaradas por la definición
 * @property {string=}       binding         dato que muestra (componentes básicos); los de sistema lo fijan en su definición
 * @property {string=}       action          acción que dispara (botones básicos); los de sistema la fijan en su definición
 * @property {Repeat=}       repeat          se dibuja una vez por ítem de una lista
 * @property {Condition=}    visibleWhen     visible sólo si la condición se cumple
 * @property {Condition=}    disabledWhen    deshabilitado si la condición se cumple
 * @property {Array<{when:Condition, style:Style}>=} variants  estilo extra según datos
 *
 * @typedef {{binding:string, as?:string}} Repeat       `as` = alias del ítem (default "item")
 * @typedef {{binding:string, equals?:*, negate?:boolean}} Condition
 *          sin `equals`: verdadero si el valor es truthy. `negate` invierte.
 *
 * ─── Layout / Box / Style (flow; sin x/y) ───────────────────────────────────
 * @typedef {Object} Layout
 * @property {"column"|"row"} direction
 * @property {"start"|"center"|"end"|"stretch"=} align
 * @property {"start"|"center"|"end"|"between"|"around"=} justify
 * @property {number=} gap
 * @property {boolean=} wrap
 *
 * @typedef {Object} Box
 * @property {{mode:"fill"|"hug"|"fixed", value?:number}=} width
 * @property {{mode:"hug"|"fill"|"fixed", value?:number}=} height
 * @property {number=} minWidth  @property {number=} maxWidth
 * @property {number=} minHeight @property {number=} maxHeight
 * @property {number[]=} padding  [top, right, bottom, left]
 * @property {number[]=} margin   [top, right, bottom, left]
 *
 * @typedef {Object} Style   ver STYLE_KEYS
 *
 * ─── ComponentDefinition ────────────────────────────────────────────────────
 * @typedef {Object} ComponentDefinition
 * @property {string} key
 * @property {"basic"|"system"} kind
 * @property {"container"|"text"|"image"|"button"|"custom"} primitive
 * @property {string} label
 * @property {string[]} capabilities   grupos editables (ver CAPABILITIES)
 * @property {boolean=} acceptsChildren
 * @property {string=}  binding        sistema: dato fijo (protegido por definición)
 * @property {Object<string,string>=} inputs  sistema custom: varios datos fijos {prop: bindingKey}
 * @property {string=}  action         sistema: acción fija (protegida por definición)
 * @property {Array<{key:string,label:string,control:"number"|"text"|"select",options?:string[]}>=} propFields
 *          props propias editables (p. ej. tamaño del avatar)
 * @property {Function=} render        primitive "custom": componente React (presentación pura)
 *
 * ─── BindingDefinition / ActionDefinition ───────────────────────────────────
 * @typedef {Object} BindingDefinition
 * @property {string}  key        "profile.displayName", "arma.assignedLetter"…
 * @property {string}  label      "Nombre del usuario"
 * @property {"text"|"number"|"boolean"|"image"|"object"|"list"} type
 * @property {boolean} protected  el diseño cambia la apariencia, nunca el origen del dato
 * @property {Object<string,string>=} itemFields  type "list": campos de cada ítem {campo: tipo}
 *
 * @typedef {Object} ActionDefinition
 * @property {string}  key        "profile.logout", "trivia.vote"…
 * @property {string}  label
 * @property {boolean} protected  no se puede reemplazar por otra acción
 * @property {boolean=} itemScoped la recibe con el ítem de la lista ({ item })
 */

export const DOCUMENT_VERSION = 1;

/** Grupos de propiedades que una definición puede habilitar. */
export const CAPABILITIES = Object.freeze([
  "layout",      // direction, align, justify, gap, wrap
  "size",        // width/height mode y valor, max/min
  "spacing",     // padding, margin
  "background",  // background
  "border",      // borderWidth, borderColor, radius
  "typography",  // fontSize, fontWeight, fontFamily, textAlign, color, lineHeight, letterSpacing
  "text",        // texto literal (o prefix/suffix si hay binding)
  "label",       // label del botón
  "image",       // fit
  "props",       // propFields de la definición
]);

export const LAYOUT_DIRECTIONS = Object.freeze(["column", "row"]);
export const LAYOUT_ALIGN      = Object.freeze(["start", "center", "end", "stretch"]);
export const LAYOUT_JUSTIFY    = Object.freeze(["start", "center", "end", "between", "around"]);
export const WIDTH_MODES       = Object.freeze(["fill", "hug", "fixed"]);
export const HEIGHT_MODES      = Object.freeze(["hug", "fill", "fixed"]);
export const TEXT_TAGS         = Object.freeze(["div", "span", "p", "h1", "h2", "h3", "h4", "strong"]);
export const IMAGE_FITS        = Object.freeze(["cover", "contain", "fill"]);
export const FONT_FAMILIES     = Object.freeze(["inherit", "display", "body"]);

/** Claves de `style` permitidas (cualquier otra invalida el documento). */
export const STYLE_KEYS = Object.freeze([
  "background", "color", "opacity",
  "borderWidth", "borderColor", "radius",
  "fontSize", "fontWeight", "fontFamily", "textAlign", "lineHeight", "letterSpacing", "textTransform",
]);

export const NODE_KEYS = Object.freeze([
  "id", "component", "name", "children", "layout", "box", "style", "preset", "props",
  "binding", "action", "repeat", "visibleWhen", "disabledWhen", "variants",
]);
