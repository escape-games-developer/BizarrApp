import { useEffect, useState } from "react";
import { saveItemFields } from "../../services/pantallaDj";

/**
 * Corrección rápida (consola en vivo), como en el original: ajustes al toque de
 * las 3 canciones que acaban de sonar y las 3 próximas, sin abrir el Editor.
 *
 *   Sonó hace 3 · Sonó hace 2 · Sonó hace 1 · Próxima 1 · Próxima 2 · Próxima 3
 *
 * Por canción: título, artista, categoría, recorte de inicio y de fin (− / +
 * de a 1 s) y volumen (− / + de a 5). Cada cambio se guarda solo: el texto al
 * salir del campo (y marca EDITADO), los números al tocar − / + o al salir.
 * Fin en 0 = sin recorte (hasta el final).
 */

const CATEGORIAS = ["A", "B", "C", "D"];

function Paso({ etiqueta, valor, min = 0, max = 99999, paso = 1, onGuardar, disabled }) {
  const [v, setV] = useState(valor);
  useEffect(() => { setV(valor); }, [valor]);

  const fijar = (n) => {
    const x = Math.max(min, Math.min(max, Math.round(Number(n) || 0)));
    setV(x);
    if (x !== valor) onGuardar(x);
  };

  return (
    <div className="pdj-cr-paso">
      <div className="pdj-cr-lbl">{etiqueta}</div>
      <div className="pdj-cr-paso-fila">
        <button type="button" className="pdj-cr-btn" disabled={disabled || v <= min}
          aria-label={`Bajar ${etiqueta}`} onClick={() => fijar(v - paso)}>−</button>
        <input type="number" className="pdj-cr-num" value={v} min={min} max={max} disabled={disabled}
          aria-label={etiqueta}
          onChange={(e) => setV(e.target.value)} onBlur={(e) => fijar(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}/>
        <button type="button" className="pdj-cr-btn" disabled={disabled || v >= max}
          aria-label={`Subir ${etiqueta}`} onClick={() => fijar(v + paso)}>+</button>
      </div>
    </div>
  );
}

function Tarjeta({ rotulo, item, onError, refresh }) {
  const [titulo, setTitulo] = useState(item.title);
  const [artista, setArtista] = useState(item.artist || "");
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { setTitulo(item.title); setArtista(item.artist || ""); }, [item.title, item.artist]);

  const guardar = async (patch) => {
    setOcupado(true);
    try { await saveItemFields(item.id, patch); await refresh(); }
    catch (err) { onError?.(err); }
    finally { setOcupado(false); }
  };

  const guardarTexto = () => {
    const t = titulo.trim(), a = artista.trim();
    if (!t) { setTitulo(item.title); onError?.("El título no puede quedar vacío."); return; }
    if (t === item.title && a === (item.artist || "")) return;
    guardar({ title: t, artist: a || null, edited: true });
  };

  return (
    <div className="pdj-cr-card">
      <div className="pdj-cr-cab">
        <span className="pdj-cr-rotulo">{rotulo}</span>
        <span className="pdj-cr-fuente">{item.youtube_id ? "YouTube" : "Audio"}</span>
      </div>

      <label className="pdj-cr-lbl" htmlFor={`cr-t-${item.id}`}>Título</label>
      <input id={`cr-t-${item.id}`} className="pdj-cr-input" value={titulo} disabled={ocupado}
        onChange={(e) => setTitulo(e.target.value)} onBlur={guardarTexto}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}/>

      <label className="pdj-cr-lbl" htmlFor={`cr-a-${item.id}`}>Artista</label>
      <input id={`cr-a-${item.id}`} className="pdj-cr-input" value={artista} disabled={ocupado}
        onChange={(e) => setArtista(e.target.value)} onBlur={guardarTexto}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}/>

      <div className="pdj-cr-cat">
        <span className="pdj-cr-lbl" style={{ margin: 0 }}>Categoría (A/B/C/D)</span>
        <select className="pdj-cn-cat" value={item.category || "A"} disabled={ocupado}
          aria-label="Categoría" onChange={(e) => guardar({ category: e.target.value })}>
          {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="pdj-cr-dos">
        <Paso etiqueta="✂ Recorte inicio (s)" valor={item.trim_start_seconds ?? 0} disabled={ocupado}
          onGuardar={(n) => guardar({ trim_start_seconds: n })}/>
        <Paso etiqueta="✂ Cortar antes del final (s)" valor={item.trim_end_seconds ?? 0} disabled={ocupado}
          onGuardar={(n) => guardar({ trim_end_seconds: n > 0 ? n : null })}/>
      </div>
      <Paso etiqueta="🔊 Volumen (0-100)" valor={item.youtube_volume ?? 100} max={100} paso={5}
        disabled={ocupado} onGuardar={(n) => guardar({ youtube_volume: n })}/>
    </div>
  );
}

export default function CorreccionRapida({ items, history, candidates, refresh, refreshAdmin, onError, onCerrar }) {
  const porId = new Map(items.map((i) => [i.id, i]));
  // history viene del más reciente al más viejo: «Sonó hace 1» es el primero.
  const sonaron = history.slice(0, 3)
    .map((h, i) => ({ rotulo: `Sonó hace ${i + 1}`, item: porId.get(h.item_id) }))
    .filter((x) => x.item)
    .reverse();
  const proximas = candidates.slice(0, 3)
    .map((item, i) => ({ rotulo: `Próxima ${i + 1}`, item }));
  const tarjetas = [...sonaron, ...proximas];

  useEffect(() => {
    const esc = (e) => { if (e.key === "Escape") onCerrar(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onCerrar]);

  return (
    <div className="pdj-cr-fondo" role="dialog" aria-modal="true" aria-label="Corrección rápida">
      <div className="pdj-cr-barra">
        <div>
          <div className="pdj-cr-titulo">Corrección rápida</div>
          <div className="pdj-cr-sub">Ajustes al toque, sin abrir el editor completo.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="pdj-mini" onClick={() => { refresh(); refreshAdmin?.(); }}>↻ Actualizar</button>
          <button type="button" className="pdj-cr-cerrar" aria-label="Cerrar" onClick={onCerrar}>✕</button>
        </div>
      </div>

      <div className="pdj-cr-lista">
        {tarjetas.length === 0 && (
          <div className="pdj-vacio">
            <div className="pdj-vacio-ico">🎵</div>
            <div className="pdj-vacio-tit">Todavía no hay canciones para corregir</div>
            <div className="pdj-vacio-txt">Aparecen las 3 que sonaron y las 3 próximas cuando el evento está andando.</div>
          </div>
        )}
        {tarjetas.map(({ rotulo, item }) => (
          <Tarjeta key={`${rotulo}-${item.id}`} rotulo={rotulo} item={item} onError={onError} refresh={refresh}/>
        ))}
      </div>
    </div>
  );
}
