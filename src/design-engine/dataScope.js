/**
 * Resolución de datos al dibujar.
 *
 * `data` es plano y está indexado por clave de binding:
 *   { "profile.displayName": "…", "profile.completion": [ {…}, … ] }
 * Dentro de un `repeat`, el ítem actual se agrega al alcance con su alias:
 *   "item.label" → item.label
 */

export const rootScope = (data) => ({ data: data ?? {}, items: {} });

export const withItem = (scope, alias, item) => ({ ...scope, items: { ...scope.items, [alias]: item } });

/** Valor de un binding en el alcance (ítems de repeat primero, después datos). */
export function resolveBinding(key, scope) {
  if (typeof key !== "string") return undefined;
  const dot = key.indexOf(".");
  if (dot > 0) {
    const alias = key.slice(0, dot);
    if (Object.hasOwn(scope.items, alias)) {
      const item = scope.items[alias];
      return item == null ? undefined : item[key.slice(dot + 1)];
    }
  }
  return Object.hasOwn(scope.data, key) ? scope.data[key] : undefined;
}

/** Condición: sin `equals` → truthy; `negate` invierte. Sin condición → true. */
export function evalCondition(cond, scope) {
  if (!cond) return true;
  const v = resolveBinding(cond.binding, scope);
  const r = Object.hasOwn(cond, "equals") ? v === cond.equals : !!v;
  return cond.negate ? !r : r;
}
