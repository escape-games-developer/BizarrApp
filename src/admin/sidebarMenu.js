/**
 * Menú del sidebar del admin — estructura base y orden por defecto.
 *
 * El orden base es el orden de este array. Tipos de entrada:
 *
 *   { type:"item",   id, sec, bloque }                        sección individual
 *   { type:"flyout", id, icon, label, children, bloque }       padre con flyout;
 *                                                             `children` son ids
 *                                                             de sección
 *
 * Los hijos de un flyout no son configurables: se ordenan y ocultan junto con
 * su padre. En el flyout se muestran con `labelMenu` de SECS si lo tienen
 * (p. ej. «Editor»), y si no con `label`.
 *
 * Campos opcionales: `obligatorio:true` (no se puede ocultar desde Ajustes) y
 * `visiblePorDefecto:false` (arranca oculta hasta que alguien la active).
 *
 * Ícono y label de un `item` salen de SECS (el panel también los usa como
 * título). `id` es estable: es la clave de la configuración guardada, así que
 * no se renombra.
 *
 * Los separadores no se declaran ni se guardan: sólo se dibujan con el orden
 * base (sin configuración guardada), entre dos entradas visibles consecutivas
 * de distinto `bloque`. Con un orden personalizado el sidebar es una lista
 * continua (ver resolverMenu). `bloque` no tiene otro uso.
 */
export const SIDEBAR_MENU = [
  { type: "item",   id: "launch",        sec: "launch",        bloque: "control" },
  { type: "item",   id: "placas",        sec: "placas",        bloque: "control" },
  { type: "flyout", id: "djDemocracy",   icon: "🎧", label: "DJ Democracy", bloque: "dj",
    children: ["pantallaEditor", "pantallaLive"] },
  { type: "flyout", id: "escenario",     icon: "🎭", label: "Escenario", bloque: "juegos",
    children: ["duelo", "ftl", "pt", "karaoke"] },
  { type: "flyout", id: "juegos",        icon: "🎮", label: "Juegos",    bloque: "juegos",
    children: ["rey", "suma", "palabra", "trivia"] },
  { type: "item",   id: "menu",          sec: "menu",          bloque: "contenido" },
  { type: "item",   id: "novedades",     sec: "novedades",     bloque: "contenido" },
  { type: "item",   id: "playlists",     sec: "playlists",     bloque: "contenido" },
  { type: "item",   id: "dashboard",     sec: "dashboard",     bloque: "general" },
  { type: "item",   id: "designer",      sec: "designer",      bloque: "general" },
  { type: "item",   id: "designerTv",    sec: "designerTv",    bloque: "general" },
  { type: "item",   id: "designerGuest", sec: "designerGuest", bloque: "general" },
  { type: "flyout", id: "usuariosMenu",  icon: "👥", label: "Usuarios",  bloque: "admin",
    children: ["clientes", "usuarios"] },
  // Ajustes es la única vía para volver a mostrar lo que se oculte: no se oculta.
  { type: "item",   id: "ajustes",       sec: "ajustes",       bloque: "admin", obligatorio: true },
];

/** Ícono y label de una entrada, para listarla (Ajustes) o dibujarla. */
export function describirEntrada(entrada, secsPorId) {
  if (entrada.type === "item") {
    const s = secsPorId.get(entrada.sec);
    return { icon: s?.icon ?? "•", label: s?.label ?? entrada.id };
  }
  return { icon: entrada.icon, label: entrada.label };
}

/**
 * Combina el menú base con la configuración guardada (orden + visibilidad).
 *
 * `items` es lo que persiste Ajustes: `[{ id, visible }]` en orden, o `null`
 * si todavía no hay nada guardado. Reglas:
 *
 * - Ids guardados que ya no existen en el menú se ignoran.
 * - Una entrada del menú sin configuración guardada (opción nueva) no se
 *   pierde: se inserta detrás de la entrada que la precede en el orden base,
 *   con su visibilidad por defecto.
 * - `obligatorio` siempre queda visible, diga lo que diga la configuración.
 *
 * Devuelve `[{ entrada, visible, nueva }]` con TODAS las entradas del menú,
 * incluidas las ocultas: la pantalla de Ajustes necesita verlas.
 */
export function aplicarConfiguracion(menu, items) {
  const porId = new Map(menu.map((e) => [e.id, e]));
  const guardado = new Map();
  for (const it of items ?? []) {
    if (porId.has(it?.id) && !guardado.has(it.id)) guardado.set(it.id, !!it.visible);
  }

  const fila = (e, visible, nueva) => ({ entrada: e, visible: e.obligatorio ? true : visible, nueva });
  const res = [...guardado].map(([id, visible]) => fila(porId.get(id), visible, false));

  menu.forEach((e, i) => {
    if (guardado.has(e.id)) return;
    const nuevaFila = fila(e, e.visiblePorDefecto !== false, items != null);
    // Detrás de la entrada más cercana que la precede en el orden base.
    let pos = 0;
    for (let j = i - 1; j >= 0; j--) {
      const k = res.findIndex((r) => r.entrada.id === menu[j].id);
      if (k !== -1) { pos = k + 1; break; }
    }
    res.splice(pos, 0, nuevaFila);
  });
  return res;
}

/**
 * Menú listo para dibujar. Tres capas, en este orden y sin mezclarse:
 *
 * 1. Configuración administrativa (`items`): orden y ocultas por Ajustes.
 * 2. Disponibilidad para este usuario (`visibleSecs`, que ya filtró permisos y
 *    módulos congelados): un item sin sección visible se omite; un flyout se
 *    queda con sus hijos visibles y, sin hijos, se omite.
 * 3. Separadores: sólo sin configuración guardada (`items == null`), uno entre
 *    dos entradas consecutivas de distinto bloque. Con un orden personalizado
 *    no hay separadores: el administrador ordena libremente y los bloques del
 *    orden base dejan de significar algo.
 *
 * Devuelve entradas con `icon` y `label` resueltos y, en los flyouts,
 * `hijos` como objetos de sección.
 */
export function resolverMenu(menu, visibleSecs, items = null) {
  const porId = new Map(visibleSecs.map((s) => [s.id, s]));
  const conSeparadores = items == null;

  const resueltas = [];
  for (const { entrada: e, visible } of aplicarConfiguracion(menu, items)) {
    if (!visible) continue;
    let r = null;
    if (e.type === "item") {
      if (porId.has(e.sec)) r = { ...e, ...describirEntrada(e, porId) };
    } else if (e.type === "flyout") {
      const hijos = e.children.map((id) => porId.get(id)).filter(Boolean);
      if (hijos.length) r = { ...e, hijos };
    }
    if (!r) continue;
    const previa = resueltas[resueltas.length - 1];
    if (conSeparadores && previa && previa.bloque !== r.bloque) {
      resueltas.push({ type: "separator", id: `sep-${previa.id}-${r.id}` });
    }
    resueltas.push(r);
  }
  return resueltas;
}

/** Entrada disponible para este usuario (permisos/módulos), sin mirar la configuración. */
export function entradaDisponible(entrada, visibleSecs) {
  const ids = new Set(visibleSecs.map((s) => s.id));
  if (entrada.type === "item")   return ids.has(entrada.sec);
  if (entrada.type === "flyout") return entrada.children.some((id) => ids.has(id));
  return false;
}
