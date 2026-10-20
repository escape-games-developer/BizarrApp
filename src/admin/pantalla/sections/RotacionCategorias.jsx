import { useEffect, useMemo, useState } from "react";
import { saveCategoryRotation } from "../../../services/pantallaDj";
import { P } from "../../../components/pantalla/pantallaUi";

/**
 * Reglas de votación → Rotación por Categorías (como en el original).
 *
 * Lugares fijos en la ventana de candidatas según la categoría (A/B/C/D) de
 * cada canción. Con la rotación activa, al completar la ventana el servidor
 * cubre primero esos lugares con canciones de cada categoría y el resto, con
 * cualquiera. Vive en `pantalla_events.category_rotation`.
 */
const CATS = ["A", "B", "C", "D"];
const VACIA = { enabled: false, slots: { A: 0, B: 0, C: 0, D: 0 } };

export default function RotacionCategorias({ event, items = [], refresh, onError }) {
  const guardada = event.category_rotation || null;
  const [rot, setRot] = useState(guardada || VACIA);
  const [estado, setEstado] = useState("idle");
  const [aviso, setAviso] = useState(null);

  useEffect(() => { setRot(guardada || VACIA); }, [JSON.stringify(guardada)]); // eslint-disable-line react-hooks/exhaustive-deps

  // Canciones habilitadas por categoría (lo que muestra el original).
  const habilitadas = useMemo(() => {
    const m = { A: 0, B: 0, C: 0, D: 0 };
    items.forEach((i) => { if (i.enabled) m[i.category || "A"] = (m[i.category || "A"] || 0) + 1; });
    return m;
  }, [items]);

  const totalLugares = CATS.reduce((s, c) => s + (Number(rot.slots?.[c]) || 0), 0);
  const ventana = event.active_candidates_count ?? 0;
  const cambiado = JSON.stringify(rot) !== JSON.stringify(guardada || VACIA);

  const guardar = async () => {
    setEstado("guardando"); setAviso(null);
    try {
      await saveCategoryRotation(event.id, rot);
      await refresh?.();
      setEstado("ok"); setTimeout(() => setEstado("idle"), 2000);
    } catch (err) {
      setEstado("idle");
      setAviso(err.message);
      onError?.(err);
    }
  };

  return (
    <div className="pdj-rot">
      <div className="pdj-rot-tit">Rotación por Categorías</div>
      <div className="pdj-sub" style={{ marginBottom: 10 }}>
        Definí grupos de lugares fijos en el pool de candidatos según la categoría (A/B/C/D) de cada canción.
      </div>

      {guardada === null && (
        <div className="pdj-campo-hint" style={{ color: P.amarillo, marginBottom: 10 }}>
          Para guardar la rotación falta aplicar en Supabase la migración 20261020110000_pantalla_sets.
        </div>
      )}

      <label className="pdj-rot-switch">
        <input type="checkbox" checked={!!rot.enabled}
          onChange={(e) => setRot((r) => ({ ...r, enabled: e.target.checked }))}/>
        <span>Activar rotación por categorías</span>
      </label>

      <div className="pdj-rot-grid">
        {CATS.map((c) => (
          <div key={c} className={`pdj-rot-fila${rot.enabled ? "" : " pdj-rot-off"}`}>
            <span className="pdj-rot-cat">{c}</span>
            <span className="pdj-rot-n">Categoría {c}: {habilitadas[c]} canciones habilitadas</span>
            <label className="pdj-rot-lug">
              Lugares
              <input type="number" min={0} max={15} value={rot.slots?.[c] ?? 0} disabled={!rot.enabled}
                onChange={(e) => setRot((r) => ({
                  ...r, slots: { ...r.slots, [c]: Math.max(0, Math.min(15, Number(e.target.value) || 0)) },
                }))}/>
            </label>
          </div>
        ))}
      </div>

      {rot.enabled && (
        <div className="pdj-campo-hint" style={{ marginTop: 8, color: totalLugares > ventana ? P.amarillo : undefined }}>
          {totalLugares} de {ventana} lugares de la ventana reservados por categoría
          {totalLugares > ventana ? " — supera la cantidad de candidatos visibles: las primeras categorías se cubren primero." : "; el resto se completa con cualquier canción."}
        </div>
      )}

      <button type="button" className="pdj-mini pdj-mini-p" style={{ marginTop: 10, padding: "9px 16px" }}
        disabled={!cambiado || estado === "guardando"} onClick={guardar}>
        {estado === "guardando" ? "Guardando…" : estado === "ok" ? "✓ Guardado" : "Guardar rotación"}
      </button>
      {aviso && <div className="pdj-campo-hint" style={{ marginTop: 6, color: "#FCA5A5" }}>{aviso}</div>}
    </div>
  );
}
