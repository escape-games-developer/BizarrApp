import { useCallback, useEffect, useRef, useState } from "react";
import { saveEventFields, extractYtId, ytThumb } from "../../../services/pantallaDj";
import {
  fetchAdClips, createAdClip, updateAdClip, deleteAdClip, reorderAdClips,
} from "../../../services/pantallaConfig";
import { datosDeYoutube, subirMp3, borrarMp3 } from "../../../services/tandas";
import { P } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";

/**
 * Tandas publicitarias: clips que se meten cada N canciones en la TV (la
 * reproducción vive en src/tv/useTandasTv.js).
 *
 * La cola es `pantalla_ad_clips` ordenada por `position`: MP3 propios (bucket
 * `tandas-audio`, `audio_path`) o links de YouTube (`youtube_id`), cada uno con
 * su recorte (`trim_start_seconds` / `trim_end_seconds`) y su volumen
 * (`volume`). `times_played` cuenta cuántas veces salió cada uno.
 *
 * Todo se guarda al instante (sin botón Guardar): el interruptor y el «cada N»
 * al cambiar, y el recorte, el volumen y el título al salir del campo.
 */

const NARANJA = "#FF6A00";

const css = `
  .td-cab{display:flex;align-items:center;gap:8px;font-size:11.5px;font-weight:700;letter-spacing:.8px;
    text-transform:uppercase;color:rgba(240,232,255,.75);}
  .td-desc{font-size:10.5px;line-height:1.5;color:rgba(240,232,255,.55);margin-top:3px;}
  .td-sub{font-size:10px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:rgba(240,232,255,.55);}
  .td-sep{border-top:1px solid rgba(240,232,255,.1);margin:14px 0;}
  .td-check{appearance:none;width:18px;height:18px;margin:0;border-radius:4px;cursor:pointer;flex-shrink:0;
    background:#fff;border:1px solid rgba(240,232,255,.3);display:grid;place-content:center;}
  .td-check:checked{background:${NARANJA};border-color:${NARANJA};}
  .td-check:checked::after{content:"✓";color:#fff;font-size:12px;font-weight:900;line-height:1;}
  .td-num{width:96px;}
  .td-drop{border:1.5px dashed rgba(240,232,255,.22);border-radius:14px;padding:22px 12px;text-align:center;
    display:flex;flex-direction:column;align-items:center;gap:8px;transition:border-color .15s,background .15s;}
  .td-drop[data-encima="true"]{border-color:${NARANJA};background:rgba(255,106,0,.06);}
  .td-btn{padding:7px 14px;border-radius:999px;font:inherit;font-size:11.5px;font-weight:700;cursor:pointer;
    border:1px solid rgba(240,232,255,.18);background:transparent;color:${P.texto};}
  .td-btn-p{background:${NARANJA};border-color:${NARANJA};color:#fff;}
  .td-btn:disabled{opacity:.45;cursor:default;}
  .td-fila{display:flex;align-items:center;gap:10px;padding:8px 10px;margin-bottom:6px;border-radius:12px;
    background:rgba(240,232,255,.03);border:1px solid rgba(240,232,255,.1);}
  .td-asa{cursor:grab;color:rgba(240,232,255,.35);font-size:14px;user-select:none;}
  .td-idx{width:16px;text-align:center;font-size:11px;color:rgba(240,232,255,.5);flex-shrink:0;}
  .td-thumb{width:38px;height:28px;border-radius:5px;object-fit:cover;flex-shrink:0;background:rgba(240,232,255,.08);
    display:grid;place-items:center;font-size:15px;}
  .td-tit{font-size:12px;font-weight:700;color:${P.texto};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .td-tag{flex-shrink:0;font-size:8.5px;font-weight:900;padding:1px 6px;border-radius:999px;border:1px solid;}
  .td-ed{background:none;border:none;cursor:pointer;color:rgba(240,232,255,.45);font-size:11px;padding:0 2px;}
  .td-mini{width:44px;padding:5px 6px;text-align:center;font-size:11px;}
`;

/** Campo numérico que guarda al salir (o con Enter) y sólo si cambió. */
function NumeroAlSalir({ valor, min, max, titulo, ancho, disabled, onGuardar }) {
  const [v, setV] = useState(valor ?? "");
  useEffect(() => { setV(valor ?? ""); }, [valor]);
  const guardar = () => {
    const n = v === "" ? null : Math.round(Number(v));
    if (n !== null && (!Number.isFinite(n) || n < min || n > max)) { setV(valor ?? ""); return; }
    if (n !== (valor ?? null)) onGuardar(n);
  };
  return (
    <input className="pdj-input td-mini" type="number" min={min} max={max} value={v} title={titulo}
      aria-label={titulo} disabled={disabled} style={ancho ? { width: ancho } : undefined}
      onChange={(e) => setV(e.target.value)} onBlur={guardar}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}/>
  );
}

export default function SeccionTandas({ event, refresh, onError }) {
  const [clips,   setClips]   = useState([]);
  const [links,   setLinks]   = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [subiendo, setSubiendo] = useState(0);        // MP3 que faltan subir
  const [soltando, setSoltando] = useState(false);    // MP3 arrastrado encima
  const [arrastrando, setArrastrando] = useState(null);
  const [encima,      setEncima]      = useState(null);
  const [editando,    setEditando]    = useState(null); // { id, titulo }
  const archivosRef = useRef(null);

  const cargar = useCallback(async () => {
    try { setClips(await fetchAdClips(event.id)); }
    catch (err) { onError?.(err); }
  }, [event.id, onError]);

  useEffect(() => { cargar(); }, [cargar]);

  const correr = async (fn) => {
    setOcupado(true); onError?.(null);
    try { await fn(); await cargar(); }
    catch (err) { onError?.(err); }
    finally { setOcupado(false); }
  };

  // ── Configuración del evento (se guarda al cambiar) ─────────────────────
  const [cadaN, setCadaN] = useState(event.ads_every_n_songs ?? 2);
  useEffect(() => { setCadaN(event.ads_every_n_songs ?? 2); }, [event.ads_every_n_songs]);

  const guardarEvento = (patch) => correr(async () => {
    await saveEventFields(event.id, patch);
    await refresh();
  });

  const guardarCadaN = () => {
    const n = Math.round(Number(cadaN));
    if (!Number.isFinite(n) || n < 1 || n > 50) { setCadaN(event.ads_every_n_songs ?? 2); return; }
    if (n !== event.ads_every_n_songs) guardarEvento({ ads_every_n_songs: n });
  };

  // ── Alta de clips ───────────────────────────────────────────────────────
  const subirArchivos = async (files) => {
    const mp3 = [...files];
    if (!mp3.length) return;
    setSubiendo(mp3.length);
    await correr(async () => {
      let pos = clips.length;
      for (const file of mp3) {
        const { audioPath, title, durationSeconds } = await subirMp3(event.id, file);
        await createAdClip(event.id, {
          title, source_type: "audio", audio_path: audioPath,
          duration_seconds: durationSeconds, position: pos++,
        });
        setSubiendo((n) => n - 1);
      }
    });
    setSubiendo(0);
  };

  // Uno o varios links (uno por línea, o separados por espacios o comas).
  const idsDeLinks = links.split(/[\s,]+/).map((l) => extractYtId(l)).filter(Boolean);
  const agregarLinks = () => {
    if (!idsDeLinks.length) { onError?.(new Error("No se reconoció ningún link de YouTube.")); return; }
    correr(async () => {
      let pos = clips.length;
      for (const ytId of idsDeLinks) {
        const datos = await datosDeYoutube(ytId);
        await createAdClip(event.id, {
          title: datos?.title || "Tanda sin título", source_type: "youtube", youtube_id: ytId,
          duration_seconds: datos?.durationSeconds ?? null, position: pos++,
        });
      }
      setLinks("");
    });
  };

  // ── Cola ────────────────────────────────────────────────────────────────
  // Reordenar: se arma el orden nuevo en memoria y se suben sólo las filas
  // que cambiaron de posición.
  const moverA = (id, destino) => {
    const desde = clips.findIndex((c) => c.id === id);
    if (desde < 0) return;
    const tope = Math.min(Math.max(0, destino), clips.length - 1);
    if (tope === desde) return;
    const ids = clips.map((c) => c.id);
    ids.splice(desde, 1);
    ids.splice(tope, 0, id);
    const posiciones = new Map(clips.map((c, i) => [c.id, c.position ?? i]));
    correr(() => reorderAdClips(ids, posiciones));
  };

  const soltarEn = (idDestino) => {
    const origen = arrastrando;
    setArrastrando(null); setEncima(null);
    if (!origen || origen === idDestino) return;
    moverA(origen, clips.findIndex((c) => c.id === idDestino));
  };

  const actualizar = (id, patch) => correr(() => updateAdClip(id, patch));

  const guardarTitulo = () => {
    const ed = editando;
    setEditando(null);
    const clip = clips.find((c) => c.id === ed?.id);
    const t = ed?.titulo.trim();
    if (clip && t && t !== clip.title) actualizar(clip.id, { title: t.slice(0, 120) });
  };

  const eliminar = (c) => {
    if (!window.confirm(`¿Eliminar "${c.title}" de la cola de tandas?`)) return;
    correr(async () => {
      await deleteAdClip(c.id);
      if (c.source_type === "audio") await borrarMp3(c.audio_path);
    });
  };

  return (
    <PanelSection id="tandas" title="Tandas publicitarias" icon="📣" badge={clips.length || null}>
      <style>{css}</style>

      <div className="td-cab"><span style={{ color: NARANJA, fontSize: 15 }}>📢</span> Tandas publicitarias</div>
      <div className="td-desc">Clips que se insertan cada N canciones en la vista TV. No compiten en la votación.</div>

      <label style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, cursor: "pointer" }}>
        <span style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: P.texto }}>Habilitar tandas</div>
          <div className="td-desc" style={{ marginTop: 1 }}>Insertar anuncios automáticamente en la reproducción.</div>
        </span>
        <input type="checkbox" className="td-check" checked={!!event.ads_enabled} disabled={ocupado}
          onChange={(e) => guardarEvento({ ads_enabled: e.target.checked })}/>
      </label>

      <div className="td-sub" style={{ marginTop: 14 }}>Insertar cada N canciones</div>
      <input className="pdj-input td-num" type="number" min={1} max={50} value={cadaN} disabled={ocupado}
        aria-label="Insertar cada N canciones" style={{ marginTop: 6 }}
        onChange={(e) => setCadaN(e.target.value)} onBlur={guardarCadaN}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}/>
      <div className="td-desc" style={{ marginTop: 6 }}>
        Cada vez que pasan {Math.max(1, Math.round(Number(cadaN)) || 1)} canciones, la TV pasa una tanda antes del
        tema siguiente: la menos emitida de la cola y, entre empatadas, la primera. El tema que espera no se
        pierde: arranca al terminar la tanda. Con un juego en pantalla no entran tandas.
      </div>

      <div className="td-sep"/>

      {/* ── MP3 propios ── */}
      <div className="td-drop" data-encima={soltando}
        onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setSoltando(true); } }}
        onDragLeave={() => setSoltando(false)}
        onDrop={(e) => { e.preventDefault(); setSoltando(false); subirArchivos(e.dataTransfer.files); }}>
        <div style={{ fontSize: 20, color: "rgba(240,232,255,.6)" }} aria-hidden="true">⤒</div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: P.texto }}>
          {subiendo ? `Subiendo… (${subiendo})` : "Arrastrá MP3 aquí"}
        </div>
        <input ref={archivosRef} type="file" accept="audio/mpeg,.mp3" multiple style={{ display: "none" }}
          onChange={(e) => { const f = [...e.target.files]; e.target.value = ""; subirArchivos(f); }}/>
        <button type="button" className="td-btn" disabled={ocupado} onClick={() => archivosRef.current?.click()}>
          Elegir archivos
        </button>
      </div>

      <div className="td-sep"/>

      {/* ── Links de YouTube ── */}
      <div className="td-sub">▶ Links de YouTube</div>
      <textarea className="pdj-input" rows={2} value={links} placeholder="https://youtu.be/..."
        aria-label="Links de YouTube" disabled={ocupado} onChange={(e) => setLinks(e.target.value)}
        style={{ width: "100%", marginTop: 8, resize: "vertical", fontSize: 12, boxSizing: "border-box" }}/>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <button type="button" className="td-btn td-btn-p" disabled={ocupado || !idsDeLinks.length}
          onClick={agregarLinks}>🔗 Agregar{idsDeLinks.length > 1 ? ` (${idsDeLinks.length})` : ""}</button>
      </div>

      <div className="td-sep"/>

      {/* ── Cola de rotación ── */}
      <div className="td-sub" style={{ marginBottom: 8 }}>Cola de rotación ({clips.length})</div>
      {clips.length === 0 && (
        <div className="td-desc">Todavía no hay clips. Con la cola vacía no se inserta ninguna tanda.</div>
      )}

      {clips.map((c, i) => {
        const yt = c.source_type === "youtube";
        return (
          <div key={c.id} className="td-fila"
            draggable={!ocupado && !editando}
            onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; setArrastrando(c.id); }}
            onDragOver={(e) => { if (arrastrando) { e.preventDefault(); setEncima((p) => (p === c.id ? p : c.id)); } }}
            onDragEnd={() => { setArrastrando(null); setEncima(null); }}
            onDrop={(e) => { if (arrastrando) { e.preventDefault(); soltarEn(c.id); } }}
            style={{
              opacity: arrastrando === c.id ? .35 : 1,
              borderTopColor: encima === c.id && arrastrando && arrastrando !== c.id ? P.amarillo : undefined,
            }}>
            <span className="td-asa" title="Arrastrar para reordenar la cola" aria-hidden="true">⠿</span>
            <span className="td-idx">{i + 1}</span>
            {yt && c.youtube_id
              ? <img className="td-thumb" src={ytThumb(c.youtube_id)} alt="" loading="lazy"/>
              : <span className="td-thumb" aria-hidden="true">🎵</span>}

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                {editando?.id === c.id ? (
                  <input className="pdj-input" autoFocus value={editando.titulo} maxLength={120}
                    aria-label="Título de la tanda" style={{ flex: 1, minWidth: 0, fontSize: 12, padding: "4px 8px" }}
                    onChange={(e) => setEditando({ id: c.id, titulo: e.target.value })}
                    onBlur={guardarTitulo}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") setEditando(null);
                    }}/>
                ) : (
                  <>
                    <span className="td-tit">{c.title}</span>
                    <button type="button" className="td-ed" title="Editar título" aria-label="Editar título"
                      disabled={ocupado} onClick={() => setEditando({ id: c.id, titulo: c.title || "" })}>✎</button>
                  </>
                )}
                <span className="td-tag" style={yt
                  ? { color: "#FF4D6D", borderColor: "rgba(255,77,109,.5)" }
                  : { color: P.cyan, borderColor: "rgba(0,229,255,.45)" }}>{yt ? "▶ YT" : "MP3"}</span>
              </div>
              <div style={{ fontSize: 10, color: "rgba(240,232,255,.45)", marginTop: 2 }}>
                ▶ {c.times_played ?? 0} · pos {i + 1}
              </div>
            </div>

            <NumeroAlSalir valor={c.trim_start_seconds ?? 0} min={0} max={3600} titulo="Inicio (s)"
              disabled={ocupado} onGuardar={(n) => actualizar(c.id, { trim_start_seconds: n ?? 0 })}/>
            <NumeroAlSalir valor={c.trim_end_seconds ?? 0} min={0} max={3600} titulo="Fin (s, 0 = hasta el final)"
              disabled={ocupado} onGuardar={(n) => actualizar(c.id, { trim_end_seconds: n || null })}/>
            <span aria-hidden="true" style={{ fontSize: 12, color: "rgba(240,232,255,.55)" }}>🔊</span>
            <NumeroAlSalir valor={c.volume ?? 100} min={0} max={100} titulo="Volumen (0 a 100)"
              disabled={ocupado} onGuardar={(n) => actualizar(c.id, { volume: n ?? 100 })}/>
            <button type="button" className="td-ed" title="Eliminar de la cola" aria-label="Eliminar de la cola"
              disabled={ocupado} style={{ fontSize: 13 }} onClick={() => eliminar(c)}>🗑</button>
          </div>
        );
      })}

      {clips.length > 1 && (
        <div className="td-desc" style={{ marginTop: 4 }}>
          Arrastrá por el asa para cambiar el orden. Los dos números son el recorte en segundos (inicio y fin;
          0 = hasta el final) y el último, el volumen.
        </div>
      )}
    </PanelSection>
  );
}
