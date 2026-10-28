import { useEffect, useState } from "react";
import { saveItemFields, deleteItem, updateItem } from "../../../services/pantallaDj";
import { portada, tiempo } from "../../../components/pantalla/pantallaUi";

/**
 * Una canción de la playlist (card del Editor de DJ Democracy).
 *
 *   ⠿ ☐ 3 [A▾] [portada] Título / Artista / YouTube ↗ EDITADO
 *                       ▶[inicio] ◀[fin] 🔊[vol] 3:56  ⌃ ⌄ 📌 🔒 👁 🗑
 *
 * Recorte de inicio y fin y volumen se editan en la misma fila y se guardan al
 * salir del campo (o con Enter). Título y artista se corrigen con doble click;
 * al guardar queda marcada como EDITADO.
 *
 * Los íconos muestran el ESTADO: pin tachado = no fijada, candado abierto = no
 * bloqueada, ojo tachado = desactivada (no entra a la votación).
 *
 * Duración: `duration_seconds` la completa la TV la primera vez que suena el
 * tema (pantalla_tv_report). Mientras tanto se muestra un guion, nunca 0:00.
 */

const CATEGORIAS = ["A", "B", "C", "D"];

// Íconos de línea (trazos de lucide), heredan el color del botón.
const PATHS = {
  arriba:   <path d="m18 15-6-6-6 6"/>,
  abajo:    <path d="m6 9 6 6 6-6"/>,
  pin:      <><line x1="12" x2="12" y1="17" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></>,
  pinOff:   <><line x1="2" x2="22" y1="2" y2="22"/><line x1="12" x2="12" y1="17" y2="22"/><path d="M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h12"/><path d="M15 9.34V6h1a2 2 0 0 0 0-4H7.89"/></>,
  lock:     <><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
  lockOpen: <><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></>,
  eye:      <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></>,
  eyeOff:   <><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></>,
  trash:    <><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></>,
  link:     <><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"/></>,
  youtube:  <><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/></>,
  volumen:  <><path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5z"/><path d="M16 9a5 5 0 0 1 0 6"/></>,
  grip:     <><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></>,
};

function Icono({ n, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[n]}
    </svg>
  );
}

/** Campo numérico de la fila: guarda al salir (o Enter) sólo si cambió. */
function CampoNumero({ valor, min = 0, max, ancho = 46, etiqueta, onGuardar, disabled }) {
  const [v, setV] = useState(valor);
  useEffect(() => { setV(valor); }, [valor]);

  const confirmar = () => {
    const texto = String(v).trim();
    const siguiente = texto === "" ? null : Math.max(min, Math.min(max ?? Infinity, Math.round(Number(texto) || 0)));
    if (siguiente === null || siguiente === valor) { setV(valor); return; }
    onGuardar(siguiente);
  };

  return (
    <input className="pdj-cn-num" type="number" min={min} max={max} value={v} disabled={disabled}
      aria-label={etiqueta} title={etiqueta} style={{ width: ancho }}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setV(valor); e.currentTarget.blur(); } }}
      onBlur={confirmar}/>
  );
}

export default function FilaCancion({
  item, indice, event, current, seleccionado, onSeleccionar,
  onMover, onIrAPosicion, refresh, onError, drag, enSet = false,
}) {
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
  // Mismo criterio que el original: Sonando / En votación / Sonó hace poco /
  // Relegada. En espera o desactivada no lleva etiqueta (la card ya se apaga).
  const estado = esActual ? { label: "Sonando", color: "#FF2D78" }
    : !item.enabled ? null
    : item.is_active_candidate ? { label: "En votación", color: "#00E5FF" }
    : item.last_status === "played_recently" ? { label: "Sonó hace poco", color: "#FF9500" }
    : item.last_status === "rejected" ? { label: "Relegada", color: "rgba(240,232,255,.55)" }
    : null;
  const dur = item.duration_seconds > 0 ? tiempo(item.duration_seconds)
    : esActual && event.tv_duration > 0 ? tiempo(event.tv_duration) : "—";

  const correr = async (fn) => {
    setOcupado(true);
    try { await fn(); await refresh(); }
    catch (err) { onError?.(err); }
    finally { setOcupado(false); }
  };

  const guardarCampo = (campo) => (valor) =>
    correr(() => saveItemFields(item.id, { [campo]: valor }));

  const guardarTexto = async () => {
    const t = titulo.trim();
    if (!t) { onError?.("El título de la canción no puede estar vacío."); return; }
    const a = artista.trim();
    if (t === item.title && a === (item.artist || "")) { setEditando(false); return; }
    await correr(() => saveItemFields(item.id, { title: t, artist: a || null, edited: true }));
    setEditando(false);
  };

  const clases = ["pdj-fila", "pdj-cn"];
  if (esActual)      clases.push("pdj-fila-sonando");
  if (!item.enabled) clases.push("pdj-fila-off");
  if (seleccionado)  clases.push("pdj-fila-sel");
  if (drag.arrastrando === item.id) clases.push("pdj-fila-drag");
  if (drag.encima === item.id)      clases.push("pdj-fila-drop");

  return (
    <div className={clases.join(" ")}
      draggable={!editando}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; drag.iniciar(item.id); }}
      onDragOver={(e) => { e.preventDefault(); drag.sobre(item.id); }}
      onDragEnd={drag.terminar}
      onDrop={(e) => { e.preventDefault(); drag.soltar(item.id); }}>

      <span className="pdj-cn-asa" title="Arrastrar para reordenar"><Icono n="grip" size={15}/></span>

      <input type="checkbox" className="pdj-cn-check" checked={seleccionado}
        aria-label={`Seleccionar ${item.title}`}
        onChange={(e) => onSeleccionar(item.id, e.target.checked)}/>

      <input className="pdj-cn-pos" type="number" min={1} value={pos}
        aria-label={`Posición de ${item.title}`} disabled={ocupado}
        onChange={(e) => setPos(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        onBlur={() => {
          const n = Number(pos);
          if (!n || n === indice + 1) { setPos(indice + 1); return; }
          onIrAPosicion(item.id, n);
        }}/>

      <select className="pdj-cn-cat" value={item.category || "A"} disabled={ocupado}
        aria-label={`Categoría de ${item.title}`} title="Categoría"
        onChange={(e) => guardarCampo("category")(e.target.value)}>
        {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>

      {portada(item)
        ? <img className="pdj-cn-cover" src={portada(item)} alt="" loading="lazy" decoding="async"/>
        : <div className="pdj-cn-cover pdj-cn-cover-vacia">🎵</div>}

      <div className="pdj-cn-info">
        {editando ? (
          <div style={{ display: "grid", gap: 4 }}>
            <input autoFocus className="pdj-input" value={titulo} disabled={ocupado}
              aria-label="Título de la canción" style={{ padding: "5px 7px", fontSize: 12 }}
              onChange={(e) => setTitulo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); guardarTexto(); }
                if (e.key === "Escape") { e.preventDefault(); setEditando(false); }
              }}/>
            <div style={{ display: "flex", gap: 4 }}>
              <input className="pdj-input" value={artista} disabled={ocupado}
                placeholder="Artista (opcional)" aria-label="Artista de la canción"
                style={{ padding: "5px 7px", fontSize: 12 }}
                onChange={(e) => setArtista(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); guardarTexto(); }
                  if (e.key === "Escape") { e.preventDefault(); setEditando(false); }
                }}/>
              <button type="button" className="pdj-ico pdj-ico-on" title="Guardar"
                disabled={ocupado || !titulo.trim()} onClick={guardarTexto}>✓</button>
              <button type="button" className="pdj-ico" title="Cancelar"
                disabled={ocupado} onClick={() => setEditando(false)}>×</button>
            </div>
          </div>
        ) : (
          <>
            <div className="pdj-cn-tit" onDoubleClick={() => setEditando(true)}
              title={`${item.title} — doble click para editar`}>
              {esActual && <span className="pdj-cn-sonando">● </span>}{item.title}
            </div>
            <div className="pdj-cn-art" onDoubleClick={() => setEditando(true)}>{item.artist || "—"}</div>
            <div className="pdj-cn-badges">
              {item.youtube_id && <>
                <span className="pdj-cn-badge"><Icono n="youtube" size={12}/>YouTube</span>
                <a className="pdj-cn-badge pdj-cn-badge-ico" href={`https://youtu.be/${item.youtube_id}`}
                  target="_blank" rel="noreferrer" title="Abrir en YouTube" aria-label="Abrir en YouTube">
                  <Icono n="link" size={12}/>
                </a>
              </>}
              {item.edited && <span className="pdj-cn-editado">EDITADO</span>}
              {enSet && <span className="pdj-cn-enset">EN EL SET</span>}
              {/* Estado del tema, como en el original: sólo si dice algo. */}
              {estado && (
                <span className="pdj-cn-estado" style={{ color: estado.color, borderColor: `${estado.color}66` }}>
                  {estado.label}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      <div className="pdj-cn-ajustes">
        <span className="pdj-cn-campo" title="Recorte de inicio (segundos)">
          <span className="pdj-cn-sim">▶</span>
          <CampoNumero valor={item.trim_start_seconds ?? 0} etiqueta="Recorte de inicio (s)"
            disabled={ocupado} onGuardar={(v) => guardarCampo("trim_start_seconds")(v ?? 0)}/>
        </span>
        {/* Fin: segundos ANTES del final, como en DJ Democracy (lo aplica la
            TV, ver useContinuousTvPlayers). 0 = hasta el final, NULL en la base. */}
        <span className="pdj-cn-campo" title="Cortar N segundos antes del final (0 = hasta el final)">
          <span className="pdj-cn-sim">◀</span>
          <CampoNumero valor={item.trim_end_seconds ?? 0} etiqueta="Segundos antes del final, 0 = hasta el final"
            disabled={ocupado} onGuardar={(v) => guardarCampo("trim_end_seconds")(v > 0 ? v : null)}/>
        </span>
        <span className="pdj-cn-campo" title="Volumen del video (0-100%). Solo baja el volumen original, no lo amplifica.">
          <span className="pdj-cn-sim"><Icono n="volumen" size={13}/></span>
          <CampoNumero valor={item.youtube_volume ?? 100} max={100} etiqueta="Volumen (0-100)"
            disabled={ocupado} onGuardar={(v) => guardarCampo("youtube_volume")(v ?? 100)}/>
        </span>
        <span className="pdj-cn-dur">{dur}</span>
      </div>

      <div className="pdj-cn-acts">
        <button type="button" className="pdj-cn-btn" title="Subir" aria-label="Subir en la lista"
          disabled={ocupado || indice === 0} onClick={() => onMover(item.id, -1)}><Icono n="arriba"/></button>
        <button type="button" className="pdj-cn-btn" title="Bajar" aria-label="Bajar en la lista"
          disabled={ocupado} onClick={() => onMover(item.id, 1)}><Icono n="abajo"/></button>
        <button type="button" className={`pdj-cn-btn${item.pinned ? " pdj-cn-btn-on" : ""}`}
          title={item.pinned ? "Fijada: entra siempre a la ventana. Click para soltar" : "Fijar: entra siempre a la ventana"}
          aria-label="Fijar tema" aria-pressed={item.pinned} disabled={ocupado}
          onClick={() => correr(() => updateItem(item.id, { pinned: !item.pinned }))}>
          <Icono n={item.pinned ? "pin" : "pinOff"}/>
        </button>
        <button type="button" className={`pdj-cn-btn${item.locked ? " pdj-cn-btn-on" : ""}`}
          title={item.locked ? "Bloqueada: no se relega ni se descarta. Click para desbloquear" : "Bloquear: no se relega ni se descarta"}
          aria-label="Bloquear tema" aria-pressed={item.locked} disabled={ocupado}
          onClick={() => correr(() => updateItem(item.id, { locked: !item.locked }))}>
          <Icono n={item.locked ? "lock" : "lockOpen"}/>
        </button>
        <button type="button" className="pdj-cn-btn"
          title={item.enabled ? "Activa: entra a la votación. Click para desactivar" : "Desactivada: no entra a la votación. Click para activar"}
          aria-label="Activar o desactivar tema" aria-pressed={!item.enabled} disabled={ocupado}
          onClick={() => correr(() => updateItem(item.id, { enabled: !item.enabled }))}>
          <Icono n={item.enabled ? "eye" : "eyeOff"}/>
        </button>
        <button type="button" className="pdj-cn-btn pdj-cn-btn-peligro"
          title={esActual ? "No se puede borrar la canción que está sonando" : "Eliminar de la playlist"}
          aria-label="Eliminar tema" disabled={ocupado || esActual}
          onClick={() => {
            if (window.confirm(`¿Eliminar "${item.title}" de la playlist?`)) {
              correr(() => deleteItem(item.id));
            }
          }}><Icono n="trash"/></button>
      </div>
    </div>
  );
}
