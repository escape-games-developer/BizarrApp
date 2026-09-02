import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addItems, reorderItems,
  deleteItems, setItemsEnabled, parseYoutubeLines, updateItem,
} from "../../../services/pantallaDj";
import { P } from "../../../components/pantalla/pantallaUi";
import FilaCancion from "./FilaCancion";

/**
 * Columna principal del editor: la playlist del evento.
 *
 * Es el único lugar por donde entran canciones — el invitado nunca pide ni
 * busca temas, sólo vota los que están acá.
 *
 * El reordenamiento trabaja siempre sobre la lista completa ordenada por
 * `position`, no sobre lo que se ve filtrado: así arrastrar con un buscador
 * activo mueve el tema al lugar real y no a un índice de la vista.
 */

const linkYt = (item) => (item.youtube_id ? `https://youtu.be/${item.youtube_id}` : "");

/** Una línea por tema, en el mismo formato que acepta el textarea de alta. */
function aTexto(items) {
  return items.map((i) => [
    linkYt(i) || i.audio_path || "",
    i.title || "",
    i.artist || "",
    i.trim_start_seconds || 0,
    i.trim_end_seconds ?? "",
  ].join(" | ")).join("\n");
}

export default function PlaylistPanel({ event, items, current, refresh, onError }) {
  const [texto,       setTexto]       = useState("");
  const [busy,        setBusy]        = useState(false);
  const [aviso,       setAviso]       = useState(null);
  const [buscar,      setBuscar]      = useState("");
  const [seleccion,   setSeleccion]   = useState(() => new Set());
  const [arrastrando, setArrastrando] = useState(null);
  const [encima,      setEncima]      = useState(null);

  useEffect(() => { setSeleccion(new Set()); }, [event.id]);

  const flash = (msg) => { setAviso(msg); setTimeout(() => setAviso(null), 3800); };

  const correr = useCallback(async (fn) => {
    setBusy(true); onError(null);
    try { await fn(); await refresh(); }
    catch (err) { onError(err); }
    finally { setBusy(false); }
  }, [refresh, onError]);

  // ── Orden real y vista filtrada ───────────────────────────────────────────
  const ordenados = useMemo(
    () => [...items].sort((a, b) => a.position - b.position), [items]);

  const q = buscar.trim().toLowerCase();
  const visibles = useMemo(() => {
    if (!q) return ordenados;
    return ordenados.filter((i) =>
      `${i.title} ${i.artist || ""} ${i.album || ""}`.toLowerCase().includes(q));
  }, [ordenados, q]);

  const indiceDe = useMemo(() => {
    const m = new Map();
    ordenados.forEach((i, idx) => m.set(i.id, idx));
    return m;
  }, [ordenados]);

  const posicionActual = useMemo(() => {
    const m = new Map();
    ordenados.forEach((i) => m.set(i.id, i.position));
    return m;
  }, [ordenados]);

  // ── Reordenamiento ────────────────────────────────────────────────────────
  const aplicarOrden = useCallback((idsEnOrden) =>
    correr(() => reorderItems(idsEnOrden, posicionActual)), [correr, posicionActual]);

  const moverA = useCallback((id, destino) => {
    const desde = indiceDe.get(id);
    if (desde == null) return;
    const tope = Math.min(Math.max(0, destino), ordenados.length - 1);
    if (tope === desde) return;
    const ids = ordenados.map((i) => i.id);
    ids.splice(desde, 1);
    ids.splice(tope, 0, id);
    aplicarOrden(ids);
  }, [indiceDe, ordenados, aplicarOrden]);

  const drag = {
    arrastrando, encima,
    iniciar: setArrastrando,
    sobre:   (id) => setEncima((prev) => (prev === id ? prev : id)),
    terminar: () => { setArrastrando(null); setEncima(null); },
    soltar:  (idDestino) => {
      const origen = arrastrando;
      setArrastrando(null); setEncima(null);
      if (!origen || origen === idDestino) return;
      const destino = indiceDe.get(idDestino);
      if (destino != null) moverA(origen, destino);
    },
  };

  // ── Alta ──────────────────────────────────────────────────────────────────
  const agregar = () => {
    const { items: parsed, errors } = parseYoutubeLines(texto);
    if (!parsed.length) { onError("No se reconoció ningún link de YouTube válido."); return; }
    correr(async () => {
      const n = await addItems(event.id, parsed);
      setTexto("");
      flash(`✓ ${n} canción(es) agregada(s)${errors.length ? ` · ${errors.length} línea(s) ignorada(s)` : ""}`);
    });
  };

  // ── Herramientas ──────────────────────────────────────────────────────────
  const duplicados = useMemo(() => {
    const vistos = new Set(), repetidos = [];
    for (const i of ordenados) {
      const k = i.youtube_id || i.audio_path;
      if (!k) continue;
      // El primero de cada clave se queda; la que suena nunca se toca.
      if (vistos.has(k) && i.id !== current?.id) repetidos.push(i);
      else vistos.add(k);
    }
    return repetidos;
  }, [ordenados, current?.id]);

  const limpiarDuplicados = () => {
    if (!duplicados.length) { flash("No hay temas repetidos."); return; }
    if (!window.confirm(
      `¿Eliminar ${duplicados.length} tema(s) repetido(s)?\n\n` +
      "Se conserva la primera aparición de cada video. La canción que está sonando nunca se borra.",
    )) return;
    correr(async () => {
      const n = await deleteItems(duplicados.map((i) => i.id));
      flash(`✓ ${n} repetido(s) eliminado(s)`);
    });
  };

  const exportar = () => {
    const contenido = aTexto(ordenados);
    const blob = new Blob([contenido], { type: "text/plain;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `playlist-${event.code}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    flash(`✓ ${ordenados.length} tema(s) exportado(s)`);
  };

  // ── Selección ─────────────────────────────────────────────────────────────
  const seleccionar = (id, on) => setSeleccion((s) => {
    const n = new Set(s);
    if (on) n.add(id); else n.delete(id);
    return n;
  });

  const todosVisiblesSeleccionados =
    visibles.length > 0 && visibles.every((i) => seleccion.has(i.id));

  const alternarTodo = () => setSeleccion((s) => {
    const n = new Set(s);
    if (todosVisiblesSeleccionados) visibles.forEach((i) => n.delete(i.id));
    else visibles.forEach((i) => n.add(i.id));
    return n;
  });

  const idsSeleccionados = [...seleccion];
  const borrables = idsSeleccionados.filter((id) => id !== current?.id);

  const accionMasiva = (fn, mensaje) => correr(async () => {
    const n = await fn();
    setSeleccion(new Set());
    flash(mensaje(n));
  });

  return (
    <>
      {aviso && (
        <div className="pdj-card" style={{
          background: "rgba(0,245,160,.08)", borderColor: "rgba(0,245,160,.28)",
          color: P.verde, fontSize: 12, padding: "11px 14px",
        }}>{aviso}</div>
      )}

      {/* ── Agregar de YouTube ─────────────────────────────────────────── */}
      <div className="pdj-card pdj-youtube-card">
        <div className="pdj-card-titulo">
          <span className="pdj-youtube-icon">▻</span><h4>Agregar videos de YouTube</h4>
        </div>
        <div className="pdj-youtube-help">
          Pegá uno o varios links (uno por línea). Soporta youtube.com/watch, youtu.be y /shorts/.<br />
          <span>Opcional: <code>URL | Título | Artista</code> para forzar título y artista manuales, o <code>URL | Título | Artista | Inicio | Fin</code> (segundos de recorte).</span>
        </div>
        <textarea className="pdj-input" value={texto} disabled={busy}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={"https://www.youtube.com/watch?v=…\nhttps://youtu.be/xxxx | Mi Título\nhttps://youtu.be/yyyy | Mi Título | AC/DC | 15 | 200"} />
        <div className="pdj-youtube-actions">
          <button className="pdj-mini pdj-mini-p" style={{ padding: "10px 22px" }}
            disabled={busy || !texto.trim()} onClick={agregar}>
            {busy ? "Agregando…" : "🔗 Agregar"}
          </button>
        </div>
      </div>

      {/* ── Lista ──────────────────────────────────────────────────────── */}
      <div className="pdj-playlist-list">
        {/* Barra de herramientas */}
        <div className="pdj-plbar">
          <input className="pdj-input" style={{ flex: "1 1 190px", width: "auto" }}
            placeholder="🔍 Buscar por título, artista o álbum…"
            value={buscar} onChange={(e) => setBuscar(e.target.value)} />
          <button className="pdj-mini" disabled title="La búsqueda automática de portadas estará disponible próximamente">
            Buscar portadas faltantes (0)
          </button>
          <button className="pdj-mini" disabled={busy || items.length === 0} onClick={limpiarDuplicados}
            title="Elimina las repeticiones del mismo video, conservando la primera">
            ⧉ Limpiar duplicados{duplicados.length > 0 ? ` (${duplicados.length})` : ""}
          </button>
          <button className="pdj-mini" disabled={items.length === 0} onClick={exportar}
            title="Descarga la lista en el mismo formato que acepta el alta">
            ↥ Exportar lista
          </button>
        </div>
        <button className="pdj-select-all" disabled={visibles.length === 0} onClick={alternarTodo}>
          {todosVisiblesSeleccionados ? "☑ Quitar selección" : "▣ Seleccionar todo"}
        </button>

        {/* Acciones sobre la selección */}
        {seleccion.size > 0 && (
          <div className="pdj-plsel">
            <strong style={{ fontSize: 12 }}>{seleccion.size} seleccionada(s)</strong>
            <button className="pdj-mini" disabled={busy}
              onClick={() => accionMasiva(
                () => setItemsEnabled(idsSeleccionados, true), (n) => `✓ ${n} habilitada(s)`)}>
              👁 Activar
            </button>
            <button className="pdj-mini" disabled={busy}
              onClick={() => accionMasiva(
                () => setItemsEnabled(idsSeleccionados, false), (n) => `✓ ${n} desactivada(s)`)}>
              🚫 Desactivar
            </button>
            <button className="pdj-mini" disabled={busy}
              onClick={() => accionMasiva(async () => {
                let n = 0;
                for (const id of idsSeleccionados) {
                  await updateItem(id, { pinned: true });
                  n += 1;
                }
                return n;
              }, (n) => `✓ ${n} fijada(s)`)}>
              📌 Fijar
            </button>
            <button className="pdj-mini pdj-mini-r" disabled={busy || borrables.length === 0}
              onClick={() => {
                if (!window.confirm(
                  `¿Eliminar ${borrables.length} tema(s) de la playlist?` +
                  (borrables.length !== idsSeleccionados.length
                    ? "\n\nLa canción que está sonando queda fuera: no se puede borrar."
                    : ""))) return;
                accionMasiva(() => deleteItems(borrables), (n) => `✓ ${n} eliminada(s)`);
              }}>
              ✕ Eliminar
            </button>
            <button className="pdj-mini" onClick={() => setSeleccion(new Set())}>Limpiar</button>
          </div>
        )}

        {items.length === 0 && (
          <div className="pdj-vacio">
            <div className="pdj-vacio-ico">🎵</div>
            <div className="pdj-vacio-tit">Todavía no cargaste canciones</div>
            <div className="pdj-vacio-txt">
              Pegá links de YouTube arriba o importá una playlist del bar. Sin temas, el evento
              no puede arrancar.
            </div>
          </div>
        )}

        {items.length > 0 && visibles.length === 0 && (
          <div className="pdj-vacio">
            <div className="pdj-vacio-ico">🔍</div>
            <div className="pdj-vacio-tit">Ningún tema coincide con la búsqueda</div>
          </div>
        )}

        {visibles.map((item) => (
          <FilaCancion key={item.id} item={item} indice={indiceDe.get(item.id) ?? 0}
            event={event} current={current}
            seleccionado={seleccion.has(item.id)} onSeleccionar={seleccionar}
            onMover={(id, delta) => moverA(id, (indiceDe.get(id) ?? 0) + delta)}
            onIrAPosicion={(id, n) => moverA(id, n - 1)}
            refresh={refresh} onError={onError} drag={drag} />
        ))}
      </div>
    </>
  );
}
