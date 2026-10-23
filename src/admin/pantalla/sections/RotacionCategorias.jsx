import { useEffect, useMemo, useState } from "react";
import { saveCategoryRotation } from "../../../services/pantallaDj";
import { P } from "../../../components/pantalla/pantallaUi";

/**
 * Reglas de votación → Rotación por Categorías (como en el original).
 *
 * FILAS de lugares fijos en la ventana de candidatas: cada fila reserva N
 * lugares para canciones de cualquiera de sus categorías (A/B/C/D). Al
 * completar la ventana el servidor cubre las filas en orden y el resto, con
 * cualquier canción. Vive en `pantalla_events.category_rotation.rows`
 * (`pantalla_set_category_rotation` → `pantalla__rotacion_filas`).
 *
 * Se guarda solo: casilla, categorías, quitar y agregar al tocarlos; los
 * lugares al salir del campo.
 */
const CATS = ["A", "B", "C", "D"];
const MAX_FILAS = 8;

/** Filas guardadas; lo viejo (lugares por categoría) se lee como una fila por categoría. */
function filasDe(rot) {
  if (Array.isArray(rot?.rows)) {
    return rot.rows.map((r) => ({ slots: Number(r.slots) || 0, categories: Array.isArray(r.categories) ? r.categories : [] }));
  }
  return CATS.filter((c) => Number(rot?.slots?.[c]) > 0).map((c) => ({ slots: Number(rot.slots[c]), categories: [c] }));
}

const CSS = `
  .rc-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:12px;}
  @media (max-width:520px){ .rc-grid{grid-template-columns:repeat(2,minmax(0,1fr));} }
  .rc-cat{padding:11px 10px;border-radius:14px;border:1px solid rgba(240,232,255,.12);background:rgba(0,0,0,.2);
    font-size:12px;line-height:1.35;color:rgba(240,232,255,.6);min-width:0;}
  .rc-cat strong{display:block;color:#F0E8FF;font-size:13px;}
  .rc-fila{margin-top:10px;padding:12px 14px;border-radius:14px;border:1px solid rgba(240,232,255,.12);background:rgba(0,0,0,.2);}
  .rc-fila-cab{display:flex;align-items:center;justify-content:space-between;gap:8px;}
  .rc-fila-tit{font-family:Syne,sans-serif;font-weight:800;font-size:12px;letter-spacing:.1em;color:rgba(240,232,255,.75);}
  .rc-quitar{background:none;border:1px solid rgba(255,45,120,.4);color:#FF2D78;border-radius:10px;
    padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;}
  .rc-quitar:disabled{opacity:.5;cursor:default;}
  .rc-lbl{display:block;margin:10px 0 5px;font-size:11px;color:rgba(240,232,255,.6);}
  .rc-fila .pdj-input{width:80px;padding:6px 8px;font-size:13px;}
  .rc-chips{display:flex;gap:6px;flex-wrap:wrap;}
  .rc-chip{min-width:38px;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:800;cursor:pointer;
    border:1px solid rgba(240,232,255,.18);background:rgba(240,232,255,.04);color:rgba(240,232,255,.6);}
  .rc-chip.on{background:#FF9500;border-color:#FF9500;color:#160A00;}
  .rc-chip:disabled{cursor:default;}
  .rc-agregar{margin-top:10px;width:100%;padding:9px;border-radius:12px;border:1px dashed rgba(240,232,255,.25);
    background:none;color:#F0E8FF;font-size:12px;font-weight:700;cursor:pointer;}
  .rc-agregar:disabled{opacity:.5;cursor:default;}
`;

export default function RotacionCategorias({ event, items = [], refresh, onError }) {
  const guardada = event.category_rotation || {};
  const filasGuardadas = useMemo(() => filasDe(guardada), [JSON.stringify(guardada)]); // eslint-disable-line react-hooks/exhaustive-deps
  const [lugares, setLugares] = useState(filasGuardadas.map((f) => f.slots));
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => { setLugares(filasGuardadas.map((f) => f.slots)); }, [filasGuardadas]);

  // Canciones habilitadas por categoría (lo que muestra el original).
  const habilitadas = useMemo(() => {
    const m = { A: 0, B: 0, C: 0, D: 0 };
    items.forEach((i) => { if (i.enabled) m[i.category || "A"] = (m[i.category || "A"] || 0) + 1; });
    return m;
  }, [items]);

  const activa = !!guardada.enabled;

  const guardar = async (rows, enabled = activa) => {
    setOcupado(true); onError?.(null);
    try { await saveCategoryRotation(event.id, { enabled, rows }); await refresh?.(); }
    catch (err) { onError?.(err); setLugares(filasGuardadas.map((f) => f.slots)); }
    finally { setOcupado(false); }
  };

  const cambiarFila = (i, cambio) => guardar(filasGuardadas.map((f, j) => (j === i ? { ...f, ...cambio } : f)));

  const guardarLugares = (i) => {
    const n = Math.max(0, Math.min(15, Math.round(Number(lugares[i]) || 0)));
    if (n === filasGuardadas[i]?.slots) { setLugares((l) => l.map((v, j) => (j === i ? n : v))); return; }
    cambiarFila(i, { slots: n });
  };

  const alternarCategoria = (i, c) => {
    const actuales = filasGuardadas[i].categories;
    const categories = actuales.includes(c) ? actuales.filter((x) => x !== c) : [...actuales, c].sort();
    cambiarFila(i, { categories });
  };

  const totalLugares = filasGuardadas.reduce((s, f) => s + (f.categories.length ? f.slots : 0), 0);
  const ventana = event.active_candidates_count ?? 0;

  return (
    <div className="rv-card">
      <style>{CSS}</style>
      <div className="rv-tit">Rotación por Categorías</div>
      <div className="rv-desc">
        Definí grupos de lugares fijos en el pool de candidatos según la categoría (A/B/C/D) de cada canción.
      </div>

      <label className="rv-check" style={{ marginTop: 14 }}>
        <input type="checkbox" checked={activa} disabled={ocupado}
          onChange={(e) => guardar(filasGuardadas, e.target.checked)}/>
        <span className="rv-lbl" style={{ margin: 0 }}>Activar rotación por categorías</span>
      </label>

      <div className="rc-grid">
        {CATS.map((c) => (
          <div key={c} className="rc-cat">
            <strong>Categoría {c}:</strong>
            {habilitadas[c]} canciones habilitadas
          </div>
        ))}
      </div>

      {activa && (
        <>
          {filasGuardadas.map((f, i) => (
            <div key={i} className="rc-fila">
              <div className="rc-fila-cab">
                <span className="rc-fila-tit">FILA {i + 1}</span>
                <button type="button" className="rc-quitar" disabled={ocupado}
                  onClick={() => guardar(filasGuardadas.filter((_, j) => j !== i))}>Quitar</button>
              </div>

              <label className="rc-lbl" htmlFor={`rc-lug-${i}`}>Lugares</label>
              <input id={`rc-lug-${i}`} className="pdj-input" type="number" min={0} max={15}
                value={lugares[i] ?? 0} disabled={ocupado}
                onChange={(e) => setLugares((l) => l.map((v, j) => (j === i ? e.target.value : v)))}
                onBlur={() => guardarLugares(i)}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}/>

              <span className="rc-lbl">Categorías</span>
              <div className="rc-chips">
                {CATS.map((c) => (
                  <button key={c} type="button" disabled={ocupado} aria-pressed={f.categories.includes(c)}
                    className={`rc-chip${f.categories.includes(c) ? " on" : ""}`}
                    onClick={() => alternarCategoria(i, c)}>{c}</button>
                ))}
              </div>
              {!f.categories.length && (
                <div className="rv-desc" style={{ marginTop: 6, color: P.amarillo }}>
                  Elegí al menos una categoría: sin categorías la fila no reserva lugares.
                </div>
              )}
            </div>
          ))}

          <button type="button" className="rc-agregar" disabled={ocupado || filasGuardadas.length >= MAX_FILAS}
            onClick={() => guardar([...filasGuardadas, { slots: 1, categories: [] }])}>+ Agregar fila</button>

          <div className="rv-desc" style={{ marginTop: 10, color: totalLugares > ventana ? P.amarillo : undefined }}>
            {totalLugares} de {ventana} lugares de la ventana reservados por filas
            {totalLugares > ventana
              ? " — supera la cantidad de candidatos visibles: las primeras filas se cubren primero."
              : "; el resto se completa con cualquier canción."}
          </div>
        </>
      )}
    </div>
  );
}
