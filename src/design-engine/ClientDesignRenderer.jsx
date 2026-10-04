import { rootScope, withItem, resolveBinding, evalCondition } from "./dataScope";
import { nodeCss } from "./nodeStyle";

/**
 * Renderer único del motor: DesignDocument + datos + acciones → React.
 *
 * Lo usan el preview del Diseñador y, más adelante, el Cliente real. No sabe
 * qué sección dibuja (todo sale del registro) y no tiene UI de edición: ni
 * selección, ni outlines, ni handles, ni editMode. Cada nodo emite
 * `data-design-id` para que el editor, desde afuera, lo encuentre en el DOM.
 *
 * @param {{ document, registry, data, actions }} props
 *   data    { [bindingKey]: valor }  (ver dataScope.js)
 *   actions { [actionKey]: (ctx) => any }  ctx = { item, items }
 */
export default function ClientDesignRenderer({ document, registry, data, actions }) {
  return <DesignNodeView node={document.root} registry={registry} actions={actions ?? {}}
    scope={rootScope(data)} parentDirection="column"/>;
}

function DesignNodeView({ node, registry, actions, scope, parentDirection }) {
  if (node.repeat) {
    const list = resolveBinding(node.repeat.binding, scope);
    const alias = node.repeat.as ?? "item";
    if (!Array.isArray(list)) return null;
    return list.map((item, index) => (
      <DesignNodeInstance key={index} index={index} node={node} registry={registry} actions={actions}
        scope={withItem(scope, alias, item)} parentDirection={parentDirection}/>
    ));
  }
  return <DesignNodeInstance node={node} registry={registry} actions={actions} scope={scope} parentDirection={parentDirection}/>;
}

function DesignNodeInstance({ node, index, registry, actions, scope, parentDirection }) {
  const def = registry.component(node.component);
  if (!def || !evalCondition(node.visibleWhen, scope)) return null;

  const designProps = { "data-design-id": node.id, ...(index != null ? { "data-design-index": index } : {}) };
  const style = nodeCss(node, scope, parentDirection);
  const className = node.preset ? registry.preset(node.preset)?.className : undefined;
  const props = node.props ?? {};
  const run = (key) => (key && actions[key] ? () => actions[key]({ item: scope.items.item ?? null, items: scope.items }) : undefined);
  const disabled = node.disabledWhen ? evalCondition(node.disabledWhen, scope) : undefined;
  const bindingKey = def.binding ?? node.binding;

  const children = () => (node.children ?? []).map((child) => (
    <DesignNodeView key={child.id} node={child} registry={registry} actions={actions} scope={scope}
      parentDirection={node.layout?.direction ?? "column"}/>
  ));
  // Texto de un nodo: binding (con antes/después/si no hay dato) o literal.
  const textOf = (literal) => {
    if (!bindingKey) return literal ?? "";
    const v = resolveBinding(bindingKey, scope);
    return v == null || v === "" ? (props.fallback ?? "") : `${props.prefix ?? ""}${v}${props.suffix ?? ""}`;
  };

  switch (def.primitive) {
    case "container":
      return <div {...designProps} className={className} style={style}>{children()}</div>;
    case "text": {
      const Tag = props.tag ?? "div";
      return <Tag {...designProps} className={className} style={style}>{textOf(props.text)}</Tag>;
    }
    case "image": {
      const src = bindingKey ? resolveBinding(bindingKey, scope) : props.src;
      if (!src) return null;
      return <img {...designProps} className={className} src={src} alt={props.alt ?? ""}
        style={{ objectFit: props.fit ?? "cover", ...style }}/>;
    }
    case "button":
      return (
        <button {...designProps} type="button" className={className} style={{ cursor: disabled ? undefined : "pointer", ...style }}
          onClick={run(def.action ?? node.action)} disabled={disabled}>
          {node.children?.length ? children() : textOf(props.label ?? def.defaultLabel)}
        </button>
      );
    case "custom": {
      const Render = def.render;
      const inputs = Object.fromEntries(Object.entries(def.inputs ?? {}).map(([k, b]) => [k, resolveBinding(b, scope)]));
      if (def.binding) inputs.value = resolveBinding(def.binding, scope);
      return <Render designProps={designProps} className={className} style={style} props={props}
        inputs={inputs} action={def.action ? actions[def.action] : undefined}/>;
    }
    default:
      return null;
  }
}
