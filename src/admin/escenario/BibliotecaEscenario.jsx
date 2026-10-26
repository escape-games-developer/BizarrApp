import { useRef, useState } from "react";
import { useEscenarioBiblioteca } from "../../hooks/useEscenarioBiblioteca";
import {
  agregarYoutube, borrarPlaylist, borrarVideo, crearPlaylist, moverVideo,
  parseLineasYoutube, subirArchivo,
} from "../../services/escenarioBiblioteca";
import { ALLOWED_VIDEO_LABEL } from "../../services/dueloVideo";

/**
 * Biblioteca de videos de un juego de Escenario, en la columna derecha del
 * panel. Carga (links de YouTube «Link | Nombre» y archivos de la PC),
 * playlists con nombre y, con un participante preparado, el botón para
 * asignarle el video.
 *
 * Filtro de playlist: "todas" | "sin" (sin playlist) | id de playlist.
 */
// `simple` (panel del Anfitrión): sólo filtrar y asignar; no carga, borra ni mueve videos.
export default function BibliotecaEscenario({ juego, col, puedeAsignar, videoActualId, onAsignar, ocupado, simple = false }) {
  const { playlists, videos, loading, error } = useEscenarioBiblioteca(juego);
  const [filtro, setFiltro]       = useState("todas");
  const [lineas, setLineas]       = useState("");
  const [nuevaPl, setNuevaPl]     = useState("");
  const [creandoPl, setCreandoPl] = useState(false);
  const [busy, setBusy]           = useState(false);
  const [err, setErr]             = useState(null);
  const [nota, setNota]           = useState(null);
  const fileRef = useRef(null);

  // Si la playlist filtrada deja de existir (la borró otra PC), el filtro
  // vuelve a "todas": nunca se apunta a un id que ya no está.
  const plFiltrada = playlists.find((p) => p.id === filtro) || null;
  const filtroOk = filtro === "todas" || filtro === "sin" || plFiltrada ? filtro : "todas";

  // Donde caen los videos nuevos: la playlist filtrada, si hay una elegida.
  const destino = plFiltrada?.id || null;
  const nombreDestino = plFiltrada?.nombre;

  const correr = async (fn) => {
    if (busy) return;
    setBusy(true); setErr(null); setNota(null);
    try { await fn(); }
    catch (e) { setErr(e?.message || String(e)); }
    finally { setBusy(false); }
  };

  const agregarLinks = () => correr(async () => {
    const { validos, invalidas } = parseLineasYoutube(lineas);
    if (!validos.length) throw new Error("No hay ningún link de YouTube válido. Formato: Link | Nombre");
    await agregarYoutube(juego, validos, destino);
    setLineas("");
    setNota(`✓ ${validos.length} video${validos.length === 1 ? "" : "s"} agregado${validos.length === 1 ? "" : "s"}`
      + (invalidas.length ? ` · ${invalidas.length} línea${invalidas.length === 1 ? "" : "s"} sin link válido` : ""));
  });

  const subir = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    correr(async () => {
      await subirArchivo(juego, file, { playlistId: destino });
      setNota(`✓ ${file.name} subido`);
    });
  };

  const crearPl = () => correr(async () => {
    const r = await crearPlaylist(juego, nuevaPl);
    setNuevaPl(""); setCreandoPl(false); setFiltro(r.id);
  });

  const quitarPl = (p) => correr(async () => {
    if (!window.confirm(`¿Borrar la playlist «${p.nombre}»? Sus videos quedan sin playlist.`)) return;
    await borrarPlaylist(p.id);
    setFiltro("todas");
  });

  const quitarVideo = (v) => correr(async () => {
    if (!window.confirm(`¿Borrar «${v.nombre}» de la biblioteca?`)) return;
    await borrarVideo(v);
  });

  const visibles = videos.filter((v) =>
    filtroOk === "todas" ? true : filtroOk === "sin" ? !v.playlist_id : v.playlist_id === filtroOk);

  const chip = (activo) => ({
    padding: "4px 9px", fontSize: 10, borderRadius: 999, cursor: "pointer", whiteSpace: "nowrap",
    background: activo ? `${col}22` : "rgba(240,232,255,.04)",
    border: `1px solid ${activo ? col : "rgba(240,232,255,.12)"}`,
    color: activo ? col : "rgba(240,232,255,.6)", fontFamily: "inherit",
  });
  const input = {
    width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 9,
    background: "rgba(240,232,255,.05)", border: "1px solid rgba(240,232,255,.14)",
    color: "#F0E8FF", fontSize: 11.5, outline: "none", fontFamily: "inherit",
  };

  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <div className="ctitle" style={{ margin: 0 }}>🎬 Biblioteca</div>
        <div style={{ fontSize: 9.5, color: "rgba(240,232,255,.35)" }}>
          {videos.length} video{videos.length === 1 ? "" : "s"}
        </div>
      </div>

      {/* Playlists */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
        <button type="button" style={{ ...chip(filtroOk === "todas"), fontSize: 10 }} onClick={() => setFiltro("todas")}>Todas</button>
        {playlists.map((p) => (
          <span key={p.id} style={{ ...chip(filtroOk === p.id), display: "inline-flex", alignItems: "center", gap: 5, padding: 0 }}>
            <button type="button" onClick={() => setFiltro(p.id)}
              style={{ background: "none", border: "none", color: "inherit", fontFamily: "inherit", fontSize: 10,
                cursor: "pointer", padding: "4px 0 4px 9px" }}>
              {p.nombre}
            </button>
            {!simple && (
              <button type="button" title="Borrar playlist" disabled={busy} onClick={() => quitarPl(p)}
                style={{ background: "none", border: "none", color: "rgba(255,45,120,.7)", fontSize: 10,
                  cursor: "pointer", padding: "4px 8px 4px 0" }}>✕</button>
            )}
          </span>
        ))}
        {videos.some((v) => !v.playlist_id) && playlists.length > 0 && (
          <button type="button" style={chip(filtroOk === "sin")} onClick={() => setFiltro("sin")}>Sin playlist</button>
        )}
        {!simple && !creandoPl && (
          <button type="button" style={{ ...chip(false), borderStyle: "dashed" }} onClick={() => setCreandoPl(true)}>
            ＋ Playlist
          </button>
        )}
      </div>
      {creandoPl && (
        <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
          <input autoFocus value={nuevaPl} maxLength={80} placeholder="Nombre de la playlist"
            onChange={(e) => setNuevaPl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") crearPl(); if (e.key === "Escape") setCreandoPl(false); }}
            style={input}/>
          <button className="btn btn-p" style={{ padding: "6px 10px", fontSize: 10 }}
            disabled={busy || !nuevaPl.trim()} onClick={crearPl}>Crear</button>
          <button className="btn btn-g" style={{ padding: "6px 9px", fontSize: 10 }}
            onClick={() => { setCreandoPl(false); setNuevaPl(""); }}>✕</button>
        </div>
      )}

      {/* Agregar videos — siempre a la vista: links de YouTube y archivos de la PC */}
      {!simple && <div style={{ marginBottom: 10, padding: 10, borderRadius: 10, background: "rgba(240,232,255,.03)",
          border: "1px solid rgba(240,232,255,.08)" }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
            color: "rgba(240,232,255,.45)", marginBottom: 4 }}>Agregar videos</div>
          <div style={{ fontSize: 9.5, color: "rgba(240,232,255,.4)", marginBottom: 6 }}>
            Van a {nombreDestino ? <strong style={{ color: col }}>{nombreDestino}</strong> : "la biblioteca, sin playlist"}.
            {!nombreDestino && playlists.length > 0 && " Elegí una playlist arriba para cargar directo en ella."}
          </div>
          <textarea value={lineas} onChange={(e) => setLineas(e.target.value)} rows={3}
            placeholder={"Link | Nombre\nhttps://youtu.be/… | Coreo 1"}
            style={{ ...input, resize: "vertical", fontFamily: "ui-monospace,monospace", fontSize: 11 }}/>
          <button className="btn btn-p btn-full" style={{ padding: "7px 10px", fontSize: 10.5, marginTop: 6 }}
            disabled={busy || !lineas.trim()} onClick={agregarLinks}>
            ＋ Agregar links de YouTube
          </button>
          <input ref={fileRef} type="file" accept="video/mp4,video/webm" onChange={subir} style={{ display: "none" }}/>
          <button className="btn btn-full" disabled={busy} onClick={() => fileRef.current?.click()}
            style={{ padding: "7px 10px", fontSize: 10.5, marginTop: 6, background: "rgba(155,47,255,.1)",
              border: "1px dashed rgba(155,47,255,.45)", color: "#C9A3FF" }}>
            {busy ? "⏳ Procesando…" : "📂 Subir video desde la PC"}
          </button>
          <div style={{ fontSize: 9, color: "rgba(240,232,255,.3)", marginTop: 5 }}>
            {ALLOWED_VIDEO_LABEL} · máx 100 MB. El nombre es el del archivo.
          </div>
      </div>}

      {(err || error) && <div style={{ fontSize: 10.5, color: "#FF2D78", marginBottom: 8 }}>✕ {err || error}</div>}
      {!err && !error && nota && <div style={{ fontSize: 10.5, color: "#00F5A0", marginBottom: 8 }}>{nota}</div>}

      {puedeAsignar && (
        <div style={{ fontSize: 10, color: col, marginBottom: 6 }}>Tocá «Asignar» para darle el video al participante.</div>
      )}

      {/* Videos */}
      {loading ? (
        <div style={{ fontSize: 11, color: "rgba(240,232,255,.3)", padding: "8px 0" }}>Cargando biblioteca…</div>
      ) : visibles.length === 0 ? (
        <div style={{ fontSize: 11, color: "rgba(240,232,255,.35)", padding: "8px 0", lineHeight: 1.5 }}>
          {videos.length ? "No hay videos en esta playlist."
            : simple ? "Todavía no hay videos cargados." : "Todavía no hay videos. Agregá links o subí archivos."}
        </div>
      ) : (
        <div style={{ maxHeight: simple ? "none" : 360, overflowY: "auto" }}>
          {visibles.map((v) => {
            const elegido = v.id === videoActualId;
            return (
              <div key={v.id} style={{ padding: "7px 8px", marginBottom: 5, borderRadius: 10,
                background: elegido ? "rgba(0,245,160,.08)" : "rgba(240,232,255,.03)",
                border: `1px solid ${elegido ? "#00F5A0" : "rgba(240,232,255,.08)"}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  {v.fuente === "youtube"
                    ? <img src={`https://i.ytimg.com/vi/${v.yt_id}/default.jpg`} alt=""
                        style={{ width: 40, height: 26, objectFit: "cover", borderRadius: 4, flexShrink: 0 }}/>
                    : <div style={{ width: 40, height: 26, borderRadius: 4, flexShrink: 0, display: "grid", placeItems: "center",
                        background: "rgba(155,47,255,.15)", fontSize: 13 }}>🎞️</div>}
                  <div style={{ flex: 1, minWidth: 0, fontSize: 11, fontWeight: 700,
                    color: elegido ? "#00F5A0" : "#F0E8FF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    title={v.nombre}>
                    {v.nombre}
                  </div>
                  {!simple && (
                    <button type="button" title="Borrar de la biblioteca" disabled={busy} onClick={() => quitarVideo(v)}
                      style={{ background: "none", border: "none", color: "rgba(255,45,120,.65)", fontSize: 11,
                        cursor: "pointer", padding: 2, flexShrink: 0 }}>✕</button>
                  )}
                </div>
                <div style={{ display: "flex", gap: 5, marginTop: 6 }}>
                  {simple ? <div style={{ flex: 1 }}/> : (
                    <select value={v.playlist_id || ""} disabled={busy}
                      onChange={(e) => correr(() => moverVideo(v.id, e.target.value || null))}
                      style={{ ...input, padding: "4px 6px", fontSize: 10, flex: 1, minWidth: 0 }}>
                      <option value="">Sin playlist</option>
                      {playlists.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  )}
                  {puedeAsignar && (
                    <button className={elegido ? "btn btn-g" : "btn btn-p"} style={{ padding: "4px 10px", fontSize: 10 }}
                      disabled={ocupado || elegido} onClick={() => onAsignar(v)}>
                      {elegido ? "✓ Asignado" : "Asignar"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
