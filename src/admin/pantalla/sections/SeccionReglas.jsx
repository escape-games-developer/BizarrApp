import { saveEventFields } from "../../../services/pantallaDj";
import PanelSection from "../PanelSection";
import RotacionCategorias from "./RotacionCategorias";
import KickReglas from "./KickReglas";
import OpcionesVotacion from "./OpcionesVotacion";
import { useBorrador, useGuardado } from "../panelControls";

/**
 * Reglas de votación de DJ Democracy, como en el editor original: un solo
 * acordeón con una tarjeta por tema — candidatos y relegación, rotación por
 * categorías, Sacar Tema, subtítulos, sonido y limpieza de invitados.
 */

const NARANJA = "#FF6A00";

// Clases compartidas por las tarjetas de esta sección (prefijo rv-).
export const CSS_REGLAS = `
  .rv-card{padding:18px;border-radius:20px;margin-bottom:12px;background:rgba(240,232,255,.02);
    border:1px solid rgba(240,232,255,.1);}
  .rv-intro{font-size:13px;line-height:1.55;color:rgba(240,232,255,.62);margin-bottom:14px;}
  .rv-tit{font-size:15px;font-weight:800;color:#F0E8FF;}
  .rv-desc{font-size:11px;line-height:1.55;color:rgba(240,232,255,.55);margin-top:3px;}
  .rv-campo{margin-top:14px;}
  .rv-inline{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12.5px;font-weight:700;color:#F0E8FF;}
  .rv-inline .pdj-input{width:96px;}
  .rv-lbl{display:block;font-size:12.5px;font-weight:700;color:#F0E8FF;margin-bottom:7px;}
  .rv-check{display:flex;align-items:flex-start;gap:12px;cursor:pointer;}
  .rv-check input,.rv-caja{appearance:none;flex-shrink:0;width:18px;height:18px;margin:2px 0 0;border-radius:4px;cursor:pointer;
    background:#fff;border:1px solid rgba(240,232,255,.3);display:grid;place-content:center;}
  .rv-check input:checked,.rv-caja:checked{background:${NARANJA};border-color:${NARANJA};}
  .rv-check input:checked::after,.rv-caja:checked::after{content:"✓";color:#fff;font-size:12px;font-weight:900;line-height:1;}
  .rv-check input:disabled,.rv-caja:disabled{opacity:.5;cursor:default;}
  .rv-btn{margin-top:14px;padding:9px 16px;border-radius:999px;font:inherit;font-size:12px;font-weight:800;cursor:pointer;
    background:${NARANJA};border:1px solid ${NARANJA};color:#fff;}
  .rv-btn:disabled{opacity:.45;cursor:default;}
  .rv-ok{font-size:11px;color:#00F5A0;margin-left:10px;}
  .rv-error{font-size:11px;color:#FCA5A5;margin-top:6px;}
`;

/** Texto del botón Guardar según el estado de useGuardado. */
export const textoGuardar = (estado, texto = "Guardar") =>
  estado === "guardando" ? "Guardando…" : estado === "ok" ? "✓ Guardado" : texto;

function Reglas({ event, refresh }) {
  const [b, set] = useBorrador(
    {
      active_candidates_count: event.active_candidates_count,
      relegation_rounds_threshold: event.relegation_rounds_threshold,
    },
    [event.id, event.active_candidates_count, event.relegation_rounds_threshold],
  );

  const { estado, mensaje, guardar } = useGuardado(async () => {
    await saveEventFields(event.id, {
      active_candidates_count: Number(b.active_candidates_count),
      relegation_rounds_threshold: Number(b.relegation_rounds_threshold),
    });
    await refresh();
  });

  const cand = Number(b.active_candidates_count);
  const rel  = Number(b.relegation_rounds_threshold);
  const valido = cand >= 3 && cand <= 15 && rel >= 1 && rel <= 10;
  const cambiado = cand !== event.active_candidates_count || rel !== event.relegation_rounds_threshold;

  return (
    <div className="rv-card">
      <div className="rv-intro">
        El servidor mantiene un grupo fijo de candidatos visibles. Cuando una canción se reproduce o es
        reemplazada, el grupo se completa automáticamente con la siguiente mejor.
      </div>

      <label className="rv-inline">
        Cantidad de candidatos visibles (3–15)
        <input className="pdj-input" type="number" min={3} max={15} value={b.active_candidates_count}
          onChange={(e) => set("active_candidates_count", e.target.value)}/>
      </label>
      <div className="rv-desc">Los invitados y la vista TV solo verán estas canciones para votar.</div>

      <label className="rv-inline" style={{ marginTop: 14 }}>
        Rondas consecutivas en último lugar antes de reemplazo (1–10)
        <input className="pdj-input" type="number" min={1} max={10} value={b.relegation_rounds_threshold}
          onChange={(e) => set("relegation_rounds_threshold", e.target.value)}/>
      </label>
      <div className="rv-desc">
        Si una canción queda última N veces seguidas, se reemplaza automáticamente por otra de la lista, sin
        importar los votos que tenga.
      </div>

      <button type="button" className="rv-btn" disabled={!cambiado || !valido || estado === "guardando"} onClick={guardar}>
        {textoGuardar(estado, "Guardar reglas")}
      </button>
      {!valido && <div className="rv-error">Revisá los rangos: candidatos de 3 a 15 y rondas de 1 a 10.</div>}
      {estado === "error" && mensaje && <div className="rv-error">{mensaje}</div>}
    </div>
  );
}

export default function SeccionReglas(shared) {
  return (
    <PanelSection id="reglas-votacion" title="Reglas de votación">
      <style>{CSS_REGLAS}</style>
      <Reglas {...shared}/>
      <RotacionCategorias {...shared}/>
      <KickReglas {...shared}/>
      <OpcionesVotacion {...shared}/>
    </PanelSection>
  );
}
