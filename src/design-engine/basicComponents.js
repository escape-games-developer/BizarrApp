/**
 * Componentes básicos del motor: sirven en cualquier escena. Los dominios
 * agregan componentes de sistema (con datos/acciones fijos) aparte.
 */
export const BASIC_COMPONENTS = Object.freeze([
  {
    key: "container", kind: "basic", primitive: "container", label: "Contenedor", acceptsChildren: true,
    capabilities: ["layout", "size", "spacing", "background", "border"],
  },
  {
    key: "text", kind: "basic", primitive: "text", label: "Texto",
    capabilities: ["text", "typography", "size", "spacing", "background", "border"],
  },
  {
    key: "image", kind: "basic", primitive: "image", label: "Imagen",
    capabilities: ["image", "size", "spacing", "border"],
  },
  // Sin hijos muestra `props.label` (o un binding con antes/después). Con hijos
  // (textos, imágenes) dibuja ese contenido: p. ej. opciones de trivia «A. París».
  {
    key: "button", kind: "basic", primitive: "button", label: "Botón", acceptsChildren: true,
    capabilities: ["label", "layout", "typography", "size", "spacing", "background", "border"],
  },
]);
