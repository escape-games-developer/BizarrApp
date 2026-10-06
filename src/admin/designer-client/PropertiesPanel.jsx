import { getPath, walkNodes } from "../../design-engine/documentTree";
import { PROPERTY_GROUPS } from "./propertyGroups";

/**
 * Propiedades del nodo seleccionado. Qué grupos aparecen lo decide la
 * ComponentDefinition (`capabilities`). Lo protegido (datos, acciones, listas,
 * condiciones) se muestra como información con 🔒: no hay forma de editarlo.
 */
const box = { background: "rgba(240,232,255,.035)", border: "1px solid rgba(240,232,255,.1)", borderRadius: 14, padding: 12 };
const input = { width: "100%", minWidth: 0, background: "rgba(0,0,0,.25)", border: "1px solid rgba(240,232,255,.14)",
  borderRadius: 7, color: "#F0E8FF", fontSize: 11.5, padding: "5px 7px" };

/** Ancestros con `repeat` del nodo: para nombrar campos de ítem ("item.label"). */
function repeatScopes(root, id) {
  const parents = new Map();
  walkNodes(root, (n, _d, p) => parents.set(n.id, p));
  const scopes = {};
  for (let n = findIn(root, id); n; n = parents.get(n.id)) if (n.repeat) scopes[n.repeat.as ?? "item"] ??= n.repeat.binding;
  return scopes;
}
const findIn = (root, id) => { let f = null; walkNodes(root, (n) => { if (n.id === id) f = n; }); return f; };

function bindingLabel(key, registry, scopes) {
  const b = registry.binding(key);
  if (b) return b.label;
  const [alias, field] = key.split(".");
  const list = scopes[alias] && registry.binding(scopes[alias]);
  return list ? `${list.label} → ${field}` : key;
}

function Locked({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "5px 0", fontSize: 11.5,
      borderTop: "1px solid rgba(240,232,255,.06)" }}>
      <span style={{ color: "rgba(240,232,255,.45)" }}>{label}</span>
      <span style={{ color: "#F0E8FF", textAlign: "right" }}>{value} <span aria-label="protegido">🔒</span></span>
    </div>
  );
}

function Field({ field, value, onChange, id }) {
  const set = (v) => onChange(v === "" || v === null ? undefined : v);
  switch (field.control) {
    case "select":
      return (
        <select id={id} value={value ?? ""} style={input}
          onChange={(e) => { const o = field.options.find((x) => String(x.value) === e.target.value); set(o ? o.value : undefined); }}>
          {field.options.map((o) => <option key={String(o.value)} value={o.value}>{o.label}</option>)}
        </select>
      );
    case "number":
      return <input id={id} type="number" step={field.step ?? 1} value={value ?? ""} style={input}
        onChange={(e) => set(e.target.value === "" ? undefined : Number(e.target.value))}/>;
    case "checkbox":
      return <input id={id} type="checkbox" checked={!!value} onChange={(e) => set(e.target.checked || undefined)}/>;
    case "textarea":
      return <textarea id={id} rows={3} value={value ?? ""} style={{ ...input, resize: "vertical" }} onChange={(e) => set(e.target.value)}/>;
    case "sides": {
      const v = value ?? [undefined, undefined, undefined, undefined];
      const upd = (i, raw) => {
        const next = [...v]; next[i] = raw === "" ? undefined : Number(raw);
        onChange(next.every((x) => x === undefined) ? undefined : next.map((x) => x ?? 0));
      };
      return (
        <div id={id} style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 4 }}>
          {["Arriba", "Derecha", "Abajo", "Izquierda"].map((l, i) => (
            <input key={l} aria-label={`${field.label} ${l}`} title={l} type="number" value={v[i] ?? ""} style={input}
              onChange={(e) => upd(i, e.target.value)}/>
          ))}
        </div>
      );
    }
    default: // text, color
      return <input id={id} type="text" value={value ?? ""} style={input} onChange={(e) => set(e.target.value)}
        {...(field.control === "color" ? { placeholder: "#FFD700 / rgba(…)" } : {})}/>;
  }
}

export default function PropertiesPanel({ document, registry, node, onChange }) {
  if (!node) {
    return <div style={{ ...box, fontSize: 12, color: "rgba(240,232,255,.5)" }}>Seleccioná una capa para ver sus propiedades.</div>;
  }
  const def = registry.component(node.component);
  const scopes = repeatScopes(document.root, node.id);
  const bindingKey = def.binding ?? node.binding;
  const actionKey = def.action ?? node.action;
  const groups = PROPERTY_GROUPS.filter((g) => def.capabilities.includes(g.capability))
    .map((g) => ({ ...g, list: g.fields(node, def, { bindingKey }) })).filter((g) => g.list.length);

  return (
    <div data-properties-for={node.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={box}>
        <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: .6, color: "#00E5FF", marginBottom: 4 }}>PROPIEDADES · DISEÑO</div>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 700, fontSize: 15, color: "#F0E8FF" }}>{node.name || def.label}</div>
        <div style={{ fontSize: 11, color: "rgba(240,232,255,.45)", marginBottom: 6 }}>
          {def.label} · {def.kind === "system" ? "componente de sistema" : "componente básico"}
        </div>
        {bindingKey && <Locked label="Dato" value={bindingLabel(bindingKey, registry, scopes)}/>}
        {Object.values(def.inputs ?? {}).map((k) => <Locked key={k} label="Dato" value={bindingLabel(k, registry, scopes)}/>)}
        {actionKey && <Locked label="Acción" value={registry.action(actionKey)?.label ?? actionKey}/>}
        {node.repeat && <Locked label="Se repite por" value={bindingLabel(node.repeat.binding, registry, scopes)}/>}
        {node.visibleWhen && <Locked label={node.visibleWhen.negate ? "Oculto cuando" : "Visible cuando"}
          value={bindingLabel(node.visibleWhen.binding, registry, scopes)}/>}
        {node.variants?.length > 0 && <Locked label="Cambia de estilo según" value={node.variants.map((v) => bindingLabel(v.when.binding, registry, scopes)).join(", ")}/>}
        {node.preset && <Locked label="Estilo de tema" value={registry.preset(node.preset)?.label ?? node.preset}/>}
      </div>

      {groups.map((g) => (
        <fieldset key={g.capability} data-capability={g.capability} style={{ ...box, margin: 0 }}>
          <legend style={{ fontSize: 10, fontWeight: 800, letterSpacing: .5, textTransform: "uppercase", color: "rgba(240,232,255,.55)", padding: "0 4px" }}>
            {g.label}
          </legend>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {g.list.map((f) => {
              const id = `cd-prop-${node.id}-${f.path}`;
              return (
                <label key={f.path} htmlFor={id} data-field={f.path}
                  style={{ display: "grid", gridTemplateColumns: f.control === "sides" || f.control === "textarea" ? "1fr" : "92px minmax(0,1fr)",
                    alignItems: "center", gap: 6, fontSize: 11, color: "rgba(240,232,255,.6)" }}>
                  <span>{f.label}</span>
                  <Field id={id} field={f} value={getPath(node, f.path)} onChange={(v) => onChange(node.id, f.path, v)}/>
                </label>
              );
            })}
          </div>
          {node.variants?.length > 0 && (g.capability === "background" || g.capability === "border" || g.capability === "typography") && (
            <div style={{ marginTop: 6, fontSize: 10.5, color: "rgba(240,232,255,.4)" }}>
              Edita el estilo base; las variantes según datos se aplican encima.
            </div>
          )}
        </fieldset>
      ))}
    </div>
  );
}
