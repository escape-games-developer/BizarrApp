import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  addItems, importPlaylist, updateItem, deleteItem, refillCandidates,
  parseYoutubeLines,
} from "../../services/pantallaDj";
import { P, portada, conSigno, colorScore, estadoTema } from "../../components/pantalla/pantallaUi";

function SongMetadataEditor({ item, refresh, onError }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [artist, setArtist] = useState(item.artist || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) { setTitle(item.title); setArtist(item.artist || ""); }
  }, [editing, item.artist, item.title]);

  const cancel = () => {
    setTitle(item.title);
    setArtist(item.artist || "");
    setEditing(false);
  };

  const save = async () => {
    const nextTitle = title.trim();
    if (!nextTitle) { onError("El título de la canción no puede estar vacío."); return; }
    const nextArtist = artist.trim();
    if (nextTitle === item.title && nextArtist === (item.artist || "")) {
      setEditing(false);
      return;
    }
    setSaving(true);
    onError(null);
    try {
      await updateItem(item.id, { title: nextTitle, artist: nextArtist || null });
      await refresh();
      setEditing(false);
    } catch (error) {
      onError(error);
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (event) => {
    if (event.key === "Enter") { event.preventDefault(); save(); }
    if (event.key === "Escape") { event.preventDefault(); cancel(); }
  };

  if (!editing) return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
        <div className="pdj-tema-tit" style={{ minWidth: 0 }}>{item.title}</div>
        <button type="button" className="pdj-ico" title="Editar título y artista"
          aria-label={`Editar ${item.title}`} onClick={() => setEditing(true)}
          style={{ width: 25, height: 25, flexShrink: 0 }}>✏️</button>
      </div>
      <div className="pdj-tema-art">{item.artist || "—"}</div>
    </>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", gap: 5, alignItems: "center" }}>
      <input autoFocus className="pdj-input" value={title} disabled={saving}
        aria-label="Título de la canción" onChange={(event) => setTitle(event.target.value)}
        onKeyDown={onKeyDown} style={{ gridColumn: "1", padding: "7px 8px", minWidth: 0 }} />
      <button type="button" className="pdj-ico pdj-ico-on" title="Guardar" aria-label="Guardar"
        disabled={saving || !title.trim()} onClick={save}>✓</button>
      <button type="button" className="pdj-ico" title="Cancelar" aria-label="Cancelar"
        disabled={saving} onClick={cancel}>×</button>
      <input className="pdj-input" value={artist} disabled={saving}
        aria-label="Artista de la canción" placeholder="Artista (opcional)"
        onChange={(event) => setArtist(event.target.value)} onKeyDown={onKeyDown}
        style={{ gridColumn: "1 / -1", padding: "7px 8px", minWidth: 0 }} />
    </div>
  );
}

/**
 * Curaduría de la playlist del evento.
 *
 * Es el único lugar donde entran canciones: el cliente nunca pide ni busca
 * temas, sólo vota los que están acá. Dos caminos, como quedó acordado: pegar
 * links de YouTube (igual que el admin de DJ Democracy) o importar una playlist
 * que el bar ya tenga cargada en BizarrApp.
 */
export default function PlaylistTab({ event, items, current, refresh, onError }) {
  const [texto,      setTexto]      = useState("");
  const [busy,       setBusy]       = useState(false);
  const [aviso,      setAviso]      = useState(null);
  const [buscar,     setBuscar]     = useState("");
  const [playlists,  setPlaylists]  = useState([]);
  const [playlistId, setPlaylistId] = useState("");

  useEffect(() => {
    supabase.from("playlists").select("id,name").order("position")
      .then(({ data, error }) => { if (!error) setPlaylists(data || []); });
  }, []);

  const flash = (msg) => { setAviso(msg); setTimeout(() => setAviso(null), 3500); };

  const run = useCallback(async (fn) => {
    setBusy(true); onError(null);
    try { await fn(); await refresh(); }
    catch (err) { onError(err); }
    finally { setBusy(false); }
  }, [refresh, onError]);

  const agregar = () => {
    const { items: parsed, errors } = parseYoutubeLines(texto);
    if (!parsed.length) { onError("No se reconoció ningún link de YouTube válido."); return; }
    run(async () => {
      const n = await addItems(event.id, parsed);
      setTexto("");
      flash(`✓ ${n} canción(es) agregada(s)${errors.length ? ` · ${errors.length} línea(s) ignorada(s)` : ""}`);
    });
  };

  const importar = () => {
    if (!playlistId) return;
    run(async () => {
      const n = await importPlaylist(event.id, playlistId);
      flash(n > 0 ? `✓ ${n} canción(es) importada(s)` : "La playlist no aportó temas nuevos.");
    });
  };

  const mover = (item, delta) => {
    const ordenados = [...items].sort((a, b) => a.position - b.position);
    const idx  = ordenados.findIndex((i) => i.id === item.id);
    const otro = ordenados[idx + delta];
    if (!otro) return;
    run(async () => {
      await updateItem(item.id, { position: otro.position });
      await updateItem(otro.id, { position: item.position });
    });
  };

  const metricas = useMemo(() => ({
    total:       items.length,
    activos:     items.filter((i) => i.enabled).length,
    candidatos:  items.filter((i) => i.is_active_candidate && i.id !== event.current_item_id).length,
    reproducidos: items.filter((i) => i.times_played > 0).length,
  }), [items, event.current_item_id]);

  const q = buscar.trim().toLowerCase();
  const visibles = useMemo(() => items
    .filter((i) => !q || `${i.title} ${i.artist || ""}`.toLowerCase().includes(q))
    .sort((a, b) => a.position - b.position), [items, q]);

  return (
    <>
      {aviso && <div className="pdj-card" style={{
        background: "rgba(0,245,160,.08)", borderColor: "rgba(0,245,160,.28)",
        color: P.verde, fontSize: 12, padding: "11px 14px",
      }}>{aviso}</div>}

      {/* Métricas */}
      <div className="pdj-card pdj-card-acento">
        <div className="pdj-card-titulo">
          <span style={{ fontSize: 15 }}>🎵</span>
          <h4>Playlist del evento</h4>
        </div>
        <div className="pdj-sub" style={{ marginTop: -4 }}>
          Administrá los temas que pueden participar de la votación.
        </div>
        <div className="pdj-metricas">
          {[
            { v: metricas.total,        l: "Temas",        c: P.amarillo },
            { v: metricas.activos,      l: "Habilitados",  c: P.verde },
            { v: metricas.candidatos,   l: "Candidatas",   c: P.cyan },
            { v: metricas.reproducidos, l: "Reproducidas", c: P.violeta },
          ].map((m) => (
            <div key={m.l} className="pdj-metrica" style={{ background: `${m.c}12`, borderColor: `${m.c}30` }}>
              <div className="pdj-metrica-v" style={{ color: m.c }}>{m.v}</div>
              <div className="pdj-metrica-l">{m.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Agregar de YouTube */}
      <div className="pdj-card">
        <div className="pdj-card-titulo">
          <span style={{ fontSize: 15 }}>▶️</span><h4>Agregar videos de YouTube</h4>
        </div>
        <textarea className="pdj-input" value={texto} disabled={busy}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={"Pegá uno o varios links de YouTube…\n\nURL\nURL | Título\nURL | Título | Artista | Inicio | Fin"} />
        <div className="pdj-campo-hint">
          Acepta youtube.com/watch?v=…, youtu.be/…, /shorts/… o el ID directo.
          Inicio y Fin son segundos de recorte, opcionales.
        </div>
        <button className="pdj-mini pdj-mini-p" style={{ marginTop: 11, padding: "11px 20px" }}
          disabled={busy || !texto.trim()} onClick={agregar}>
          {busy ? "Agregando…" : "+ Agregar canciones"}
        </button>
      </div>

      {/* Importar del bar */}
      <div className="pdj-card">
        <div className="pdj-card-titulo">
          <span style={{ fontSize: 15 }}>↧</span><h4>Importar una playlist del bar</h4>
        </div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          <select className="pdj-input" style={{ flex: "1 1 180px" }}
            value={playlistId} onChange={(e) => setPlaylistId(e.target.value)}>
            <option value="">Elegí una playlist…</option>
            {playlists.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="pdj-mini pdj-mini-a" style={{ padding: "11px 18px" }}
            disabled={busy || !playlistId} onClick={importar}>
            ↧ Importar
          </button>
        </div>
        <div className="pdj-campo-hint">
          Trae los temas de <strong>Contenido › Playlists YouTube</strong>. Saltea los que el evento
          ya tiene, así se puede reimportar sin duplicar.
        </div>
      </div>

      {/* Lista */}
      <div className="pdj-card">
        <div className="pdj-card-titulo">
          <span style={{ fontSize: 15 }}>≡</span>
          <h4>Temas cargados</h4>
          <button className="pdj-mini" disabled={busy}
            title="Rearma la ventana de candidatas según las reglas del evento"
            onClick={() => run(() => refillCandidates(event.id))}>
            ↻ Recalcular candidatas
          </button>
        </div>

        <input className="pdj-input" placeholder="🔍 Buscar por título o artista…"
          value={buscar} onChange={(e) => setBuscar(e.target.value)} style={{ marginBottom: 11 }} />

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

        {visibles.map((item, i) => {
          const est = estadoTema(item, event);
          const esActual = item.id === current?.id;
          const clase = ["pdj-tema"];
          if (esActual) clase.push("pdj-tema-sonando");
          if (!item.enabled) clase.push("pdj-tema-off");

          return (
            <div key={item.id} className={clase.join(" ")}>
              <span className="pdj-tema-pos">{i + 1}</span>

              {portada(item)
                ? <img className="pdj-tema-cover" src={portada(item)} alt="" loading="lazy" decoding="async" />
                : <div className="pdj-tema-cover" style={{ display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 17, opacity: .4 }}>🎵</div>}

              <div className="pdj-tema-info">
                <SongMetadataEditor item={item} refresh={refresh} onError={onError} />
                <div style={{ display: "flex", gap: 5, marginTop: 4, alignItems: "center", flexWrap: "wrap" }}>
                  <span className="pdj-chip" style={{ background: est.bg, color: est.color }}>
                    {esActual && "● "}{est.label}
                  </span>
                  {item.source_type === "youtube" && (
                    <span className="pdj-chip" style={{
                      background: "rgba(240,232,255,.05)", color: P.tenue2,
                    }}>YOUTUBE</span>
                  )}
                  {item.times_played > 0 && (
                    <span style={{ fontSize: 9.5, color: P.tenue2 }}>{item.times_played}× sonada</span>
                  )}
                </div>
              </div>

              <div className="pdj-rank-score" style={{ minWidth: 44 }}>
                <b style={{ color: colorScore(item.score), fontFamily: "'Syne',sans-serif",
                  fontWeight: 900, fontSize: 17, display: "block" }}>{conSigno(item.score)}</b>
                <span style={{ fontSize: 8, color: P.tenue2, letterSpacing: ".5px" }}>PTS</span>
              </div>

              <div className="pdj-tema-acts">
                <button className="pdj-ico" title="Subir" aria-label="Subir en la lista"
                  onClick={() => mover(item, -1)}>▲</button>
                <button className="pdj-ico" title="Bajar" aria-label="Bajar en la lista"
                  onClick={() => mover(item, 1)}>▼</button>
                <button className={`pdj-ico${item.pinned ? " pdj-ico-on" : ""}`}
                  title={item.pinned ? "Dejar de fijar" : "Fijar: entra siempre a la ventana"}
                  aria-label="Fijar tema"
                  onClick={() => run(() => updateItem(item.id, { pinned: !item.pinned }))}>📌</button>
                <button className={`pdj-ico${item.locked ? " pdj-ico-on" : ""}`}
                  title={item.locked ? "Desbloquear" : "Bloquear: no se relega ni se descarta"}
                  aria-label="Bloquear tema"
                  onClick={() => run(() => updateItem(item.id, { locked: !item.locked }))}>🔒</button>
                <button className={`pdj-ico${item.enabled ? " pdj-ico-on" : ""}`}
                  title={item.enabled ? "Deshabilitar" : "Habilitar"}
                  aria-label="Habilitar o deshabilitar tema"
                  onClick={() => run(() => updateItem(item.id, { enabled: !item.enabled }))}>
                  {item.enabled ? "👁" : "🚫"}
                </button>
                <button className="pdj-ico pdj-ico-peligro" title="Eliminar de la playlist"
                  aria-label="Eliminar tema"
                  onClick={() => {
                    if (window.confirm(`¿Eliminar "${item.title}" de la playlist?`)) {
                      run(() => deleteItem(item.id));
                    }
                  }}>✕</button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
