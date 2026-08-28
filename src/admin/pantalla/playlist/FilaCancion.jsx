import { useEffect, useState } from "react";
import { saveItemFields, deleteItem, updateItem } from "../../../services/pantallaDj";
import { P, portada, tiempo, conSigno, colorScore, estadoTema } from "../../../components/pantalla/pantallaUi";

/**
 * Una canción de la playlist.
 *
 * Arriba lo que se mira de un vistazo (posición, portada, título, estado,
 * score) y detrás de ⚙ el detalle de reproducción: recorte de inicio y fin y
 * volumen, que son ajustes finos y no tienen por qué ocupar la fila.
 *
 * Sobre la duración: `duration_seconds` está en NULL en toda la playlist, así
 * que no se calcula nada con ella. Si el tema es el que suena se muestra lo que
 * reporta la TV; si no, un guion. Nunca 0:00 ni NaN, que se leen como un dato
 * real cuando no lo son.
 */

function Detalle({ item, refresh, onError, onCerrar }) {
  const [inicio, setInicio] = useState(item.trim_start_seconds ?? 0);
  const [fin,    setFin]    = useState(item.trim_end_seconds ?? "");
  const [vol,    setVol]    = useState(item.youtube_volume ?? 100);
  const [estado, setEstado] = useState("idle");

  useEffect(() => {
    setInicio(item.trim_start_seconds ?? 0);
    setFin(item.trim_end_seconds ?? "");
    setVol(item.youtube_volume ?? 100);
  }, [item.id, item.trim_start_seconds, item.trim_end_seconds, item.youtube_volume]);

  const guardar = async () => {
    setEstado("guardando");
    try {
      await saveItemFields(item.id, {
        trim_start_seconds: Math.max(0, Number(inicio) || 0),
        trim_end_seconds:   fin === "" ? null : Math.max(0, Number(fin) || 0),
        youtube_volume:     Math.min(100, Math.max(0, Number(vol) || 0)),
      });
      await refresh();
      setEstado("ok");
      setTimeout(() => setEstado("idle"), 2000);
    } catch (err) { setEstado("idle"); onError?.(err); }
  };

  return (
    <div className="pdj-fila-det">
      <div>
        <label htmlFor={`ini-${item.id}`}>Recorte inicio (s)</label>
        <input id={`ini-${item.id}`} type="number" min={0} value={inicio}
          onChange={(e) => setInicio(e.target.value)} />
      </div>
      <div>
        <label htmlFor={`fin-${item.id}`}>Recorte fin (s)</label>
        <input id={`fin-${item.id}`} type="number" min={0} value={fin} placeholder="hasta el final"
          onChange={(e) => setFin(e.target.value)} />
      </div>
      <div>
        <label htmlFor={`vol-${item.id}`}>Volumen (0-100)</label>
        <input id={`vol-${item.id}`} type="number" min={0} max={100} value={vol}
          onChange={(e) => setVol(e.target.value)} />
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 5 }}>
        <button type="button" className="pdj-mini pdj-mini-p" disabled={estado === "guardando"}
          onClick={guardar}>
          {estado === "guardando" ? "…" : estado === "ok" ? "✓" : "Guardar"}
        </button>
        <button type="button" className="pdj-mini" onClick={onCerrar}>Cerrar</button>
      </div>
    </div>
  );
}

export default function FilaCancion({
  item, indice, event, current, seleccionado, onSeleccionar,
  onMover, onIrAPosicion, refresh, onError, drag,
}) {
  const [detalle,  setDetalle]  = useState(false);
  const [editando, setEditando] = useState(false);
  const [titulo,   setTitulo]   = useState(item.title);
  const [artista,  setArtista]  = useState(item.artist || "");
  const [pos,      setPos]      = useState(indice + 1);
  const [ocupado,  setOcupado]  = useState(false);

  useEffect(() => { setPos(indice + 1); }, [indice]);
  useEffect(() => {
    if (!editando) { setTitulo(item.title); setArtista(item.artist || ""); }
  }, [editando, item.title, item.artist]);

  const esActual = item.id === current?.id;
  const est = estadoTema(item, event);
  // Sólo hay duración real cuando la TV la está reportando para este tema.
  const dur = esActual && event.tv_duration > 0 ? tiempo(event.tv_duration)
    : item.duration_seconds > 0 ? tiempo(item.duration_seconds) : "—";

  const correr = async (fn) => {
    setOcupado(true);
    try { await fn(); await refresh(); }
    catch (err) { onError?.(err); }
    finally { setOcupado(false); }
  };

  const guardarTexto = async () => {
    const t = titulo.trim();
    if (!t) { onError?.("El título de la canción no puede estar vacío."); return; }
    const a = artista.trim();
    if (t === item.title && a === (item.artist || "")) { setEditando(false); return; }
    await correr(() => saveItemFields(item.id, { title: t, artist: a || null }));
    setEditando(false);
  };

  const clases = ["pdj-fila"];
  if (esActual)      clases.push("pdj-fila-sonando");
  if (!item.enabled) clases.push("pdj-fila-off");
  if (seleccionado)  clases.push("pdj-fila-sel");
  if (drag.arrastrando === item.id) clases.push("pdj-fila-drag");
  if (drag.encima === item.id)      clases.push("pdj-fila-drop");

  return (
    <>
      <div className={clases.join(" ")}
        draggable={!editando}
        onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; drag.iniciar(item.id); }}
        onDragOver={(e) => { e.preventDefault(); drag.sobre(item.id); }}
        onDragEnd={drag.terminar}
        onDrop={(e) => { e.preventDefault(); drag.soltar(item.id); }}>

        <span className="pdj-fila-asa" title="Arrastrar para reordenar" aria-hidden="true">⠿</span>

        <input type="checkbox" checked={seleccionado} aria-label={`Seleccionar ${item.title}`}
          onChange={(e) => onSeleccionar(item.id, e.target.checked)}
          style={{ accentColor: "#00E5FF", cursor: "pointer", flexShrink: 0 }} />

        <input className="pdj-fila-pos" type="number" min={1} value={pos}
          aria-label={`Posición de ${item.title}`} disabled={ocupado}
          onChange={(e) => setPos(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          onBlur={() => {
            const n = Number(pos);
            if (!n || n === indice + 1) { setPos(indice + 1); return; }
            onIrAPosicion(item.id, n);
          }} />

        {portada(item)
          ? <img className="pdj-fila-cover" src={portada(item)} alt="" loading="lazy" decoding="async" />
          : <div className="pdj-fila-cover" style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 15, opacity: .4, background: "rgba(240,232,255,.05)",
            }}>🎵</div>}

        <div className="pdj-fila-info">
          {editando ? (
            <div style={{ display: "grid", gap: 4 }}>
              <input autoFocus className="pdj-input" value={titulo} disabled={ocupado}
                aria-label="Título de la canción" style={{ padding: "5px 7px", fontSize: 11.5 }}
                onChange={(e) => setTitulo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); guardarTexto(); }
                  if (e.key === "Escape") { e.preventDefault(); setEditando(false); }
                }} />
              <div style={{ display: "flex", gap: 4 }}>
                <input className="pdj-input" value={artista} disabled={ocupado}
                  placeholder="Artista (opcional)" aria-label="Artista de la canción"
                  style={{ padding: "5px 7px", fontSize: 11.5 }}
                  onChange={(e) => setArtista(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); guardarTexto(); }
                    if (e.key === "Escape") { e.preventDefault(); setEditando(false); }
                  }} />
                <button type="button" className="pdj-ico pdj-ico-on" title="Guardar"
                  disabled={ocupado || !titulo.trim()} onClick={guardarTexto}>✓</button>
                <button type="button" className="pdj-ico" title="Cancelar"
                  disabled={ocupado} onClick={() => setEditando(false)}>×</button>
              </div>
            </div>
          ) : (
            <>
              <div className="pdj-fila-tit" onDoubleClick={() => setEditando(true)}
                title={`${item.title} — doble click para editar`}>{item.title}</div>
              <div className="pdj-fila-art">{item.artist || "—"}</div>
              <div style={{ display: "flex", gap: 4, marginTop: 3, alignItems: "center", flexWrap: "wrap" }}>
                <span className="pdj-chip" style={{ background: est.bg, color: est.color }}>
                  {esActual && "● "}{est.label}
                </span>
                {item.youtube_id && (
                  <a href={`https://youtu.be/${item.youtube_id}`} target="_blank" rel="noreferrer"
                    className="pdj-chip" title="Abrir en YouTube"
                    style={{ background: "rgba(255,45,120,.1)", color: "rgba(255,45,120,.85)", textDecoration: "none" }}>
                    YOUTUBE ↗
                  </a>
                )}
                <span style={{ fontSize: 9, color: P.tenue2 }}>{dur}</span>
                {item.times_played > 0 && (
                  <span style={{ fontSize: 9, color: P.tenue2 }}>{item.times_played}× sonada</span>
                )}
              </div>
            </>
          )}
        </div>

        <div style={{ minWidth: 34, textAlign: "right", flexShrink: 0 }}>
          <b style={{
            color: colorScore(item.score), fontFamily: "'Syne',sans-serif",
            fontWeight: 900, fontSize: 14, display: "block", lineHeight: 1,
          }}>{conSigno(item.score)}</b>
          <span style={{ fontSize: 7.5, color: P.tenue2, letterSpacing: ".5px" }}>PTS</span>
        </div>

        <div className="pdj-fila-acts">
          <button type="button" className="pdj-ico" title="Editar título y artista"
            aria-label={`Editar ${item.title}`} onClick={() => setEditando(true)}>✏️</button>
          <button type="button" className={`pdj-ico${detalle ? " pdj-ico-on" : ""}`}
            title="Recorte y volumen" aria-label="Recorte y volumen"
            onClick={() => setDetalle((v) => !v)}>⚙</button>
          <button type="button" className="pdj-ico" title="Subir" aria-label="Subir en la lista"
            disabled={ocupado || indice === 0} onClick={() => onMover(item.id, -1)}>▲</button>
          <button type="button" className="pdj-ico" title="Bajar" aria-label="Bajar en la lista"
            disabled={ocupado} onClick={() => onMover(item.id, 1)}>▼</button>
          <button type="button" className={`pdj-ico${item.pinned ? " pdj-ico-on" : ""}`}
            title={item.pinned ? "Dejar de fijar" : "Fijar: entra siempre a la ventana"}
            aria-label="Fijar tema" disabled={ocupado}
            onClick={() => correr(() => updateItem(item.id, { pinned: !item.pinned }))}>📌</button>
          <button type="button" className={`pdj-ico${item.locked ? " pdj-ico-on" : ""}`}
            title={item.locked ? "Desbloquear" : "Bloquear: no se relega ni se descarta"}
            aria-label="Bloquear tema" disabled={ocupado}
            onClick={() => correr(() => updateItem(item.id, { locked: !item.locked }))}>🔒</button>
          <button type="button" className={`pdj-ico${item.enabled ? " pdj-ico-on" : ""}`}
            title={item.enabled ? "Desactivar" : "Activar"} aria-label="Activar o desactivar tema"
            disabled={ocupado}
            onClick={() => correr(() => updateItem(item.id, { enabled: !item.enabled }))}>
            {item.enabled ? "👁" : "🚫"}
          </button>
          <button type="button" className="pdj-ico pdj-ico-peligro"
            title={esActual ? "No se puede borrar la canción que está sonando" : "Eliminar de la playlist"}
            aria-label="Eliminar tema" disabled={ocupado || esActual}
            onClick={() => {
              if (window.confirm(`¿Eliminar "${item.title}" de la playlist?`)) {
                correr(() => deleteItem(item.id));
              }
            }}>✕</button>
        </div>
      </div>

      {detalle && (
        <Detalle item={item} refresh={refresh} onError={onError}
          onCerrar={() => setDetalle(false)} />
      )}
    </>
  );
}
