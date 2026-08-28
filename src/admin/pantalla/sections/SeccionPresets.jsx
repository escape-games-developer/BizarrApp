import { useCallback, useEffect, useState } from "react";
import { reorderItems } from "../../../services/pantallaDj";
import { fetchPresets, createPreset, deletePreset } from "../../../services/pantallaConfig";
import { P } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";

/**
 * Presets de orden de la playlist.
 *
 * Un preset es la foto del orden actual: `item_order` guarda los ids tal como
 * estaban. Al aplicarlo se respeta ese orden para los temas que siguen
 * existiendo y se mandan al fondo los que se agregaron después — un preset
 * viejo no puede hacer desaparecer canciones nuevas, sólo reordenar.
 */
export default function SeccionPresets({ event, items, refresh, onError }) {
  const [presets, setPresets] = useState([]);
  const [nombre,  setNombre]  = useState("");
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try { setPresets(await fetchPresets(event.id)); }
    catch (err) { onError?.(err); }
  }, [event.id, onError]);

  useEffect(() => { cargar(); }, [cargar]);

  const correr = async (fn) => {
    setOcupado(true); onError?.(null);
    try { await fn(); }
    catch (err) { onError?.(err); }
    finally { setOcupado(false); }
  };

  const ordenados = [...items].sort((a, b) => a.position - b.position);

  const guardarOrden = () => {
    const n = nombre.trim();
    if (!n) return;
    correr(async () => {
      await createPreset(event.id, { name: n, item_order: ordenados.map((i) => i.id) });
      setNombre("");
      await cargar();
    });
  };

  const aplicar = (preset) => {
    const guardado = Array.isArray(preset.item_order) ? preset.item_order : [];
    const existentes = new Set(ordenados.map((i) => i.id));
    const enPreset = guardado.filter((id) => existentes.has(id));
    const nuevos   = ordenados.map((i) => i.id).filter((id) => !guardado.includes(id));
    const faltan   = ordenados.length - enPreset.length;

    if (!window.confirm(
      `¿Aplicar el orden «${preset.name}»?\n\n` +
      `${enPreset.length} tema(s) vuelven a su posición guardada.` +
      (faltan > 0 ? `\n${faltan} tema(s) agregados después quedan al final.` : ""))) return;

    const posiciones = new Map(ordenados.map((i) => [i.id, i.position]));
    correr(async () => {
      await reorderItems([...enPreset, ...nuevos], posiciones);
      await refresh();
    });
  };

  return (
    <PanelSection id="presets-orden" title="Presets de orden" icon="🔖" badge={presets.length || null}>
      <div className="pdj-sub">
        Guardá el orden actual con un nombre y volvé a él cuando quieras. Útil para tener un
        arranque tranquilo y un cierre a todo trapo sin rearmar la lista a mano.
      </div>

      {presets.length === 0 && (
        <div className="pdj-campo-hint" style={{ marginTop: 0, marginBottom: 9 }}>
          Todavía no guardaste ningún orden.
        </div>
      )}

      {presets.map((p) => (
        <div key={p.id} style={{
          display: "flex", alignItems: "center", gap: 6, marginBottom: 5,
          padding: "7px 9px", borderRadius: 10,
          background: "rgba(240,232,255,.035)", border: "1px solid rgba(240,232,255,.08)",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 11.5, fontWeight: 700, color: P.texto,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{p.name}</div>
            <div style={{ fontSize: 9, color: P.tenue2 }}>
              {(p.item_order || []).length} temas ·{" "}
              {p.created_at ? new Date(p.created_at).toLocaleDateString("es-AR") : ""}
            </div>
          </div>
          <button type="button" className="pdj-mini" disabled={ocupado || items.length === 0}
            onClick={() => aplicar(p)}>Aplicar</button>
          <button type="button" className="pdj-ico pdj-ico-peligro" disabled={ocupado}
            title="Eliminar preset" aria-label={`Eliminar ${p.name}`}
            onClick={() => {
              if (window.confirm(`¿Eliminar el preset "${p.name}"?\n\nLa playlist no se toca.`)) {
                correr(async () => { await deletePreset(p.id); await cargar(); });
              }
            }}>✕</button>
        </div>
      ))}

      <div style={{ display: "flex", gap: 5, marginTop: 9 }}>
        <input className="pdj-input" value={nombre} placeholder="Nombre del orden actual"
          aria-label="Nombre del preset" disabled={ocupado || items.length === 0}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); guardarOrden(); } }}
          style={{ flex: 1, minWidth: 0, fontSize: 11.5 }} />
        <button type="button" className="pdj-mini pdj-mini-p"
          disabled={ocupado || !nombre.trim() || items.length === 0} onClick={guardarOrden}>
          💾 Guardar
        </button>
      </div>

      {items.length === 0 && (
        <div className="pdj-campo-hint">Sin temas en la playlist no hay orden que guardar.</div>
      )}
    </PanelSection>
  );
}
