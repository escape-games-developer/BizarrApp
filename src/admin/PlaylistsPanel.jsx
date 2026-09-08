import React, { useState, useEffect, useRef } from "react";
import { useInternalPlaylists } from "../hooks/realtime/useInternalPlaylists";
import { searchYouTube, fetchYoutubePlaylist } from "../hooks/useYouTubePlaylists";

/**
 * Recorte de un tema: desde qué segundo arranca y en cuál se da por terminado.
 *
 * Es la misma configuración que ya tenía DJ Democracy por tema (el ⚙ del
 * editor), ahora también en el catálogo central — de acá la toma Follow the
 * Leader cuando manda la canción al DJ.
 *
 * Fin vacío = suena hasta el final del video. El error se muestra acá mismo:
 * la base tiene los CHECK, pero el operador tiene que leer algo entendible.
 */
function FilaRecorte({ item, onGuardar }) {
  const [abierto, setAbierto] = React.useState(false);
  const [ini, setIni] = React.useState(item.trim_start_seconds ?? 0);
  const [fin, setFin] = React.useState(item.trim_end_seconds ?? "");
  const [estado, setEstado] = React.useState(null);
  const [guardando, setGuardando] = React.useState(false);

  React.useEffect(() => {
    setIni(item.trim_start_seconds ?? 0);
    setFin(item.trim_end_seconds ?? "");
    setEstado(null);
  }, [item.id, item.trim_start_seconds, item.trim_end_seconds]);

  const tieneRecorte = (item.trim_start_seconds ?? 0) > 0 || item.trim_end_seconds != null;

  const guardar = async () => {
    setGuardando(true); setEstado(null);
    const { error } = await onGuardar(item.id, { start: ini, end: fin });
    setGuardando(false);
    setEstado(error ? { tipo: "error", texto: error } : { tipo: "ok", texto: "✓ Recorte guardado" });
    if (!error) setTimeout(() => setEstado(null), 2200);
  };

  const inputStyle = {
    width: 72, background: "#1A0D2E", border: "1px solid #9B2FFF44", color: "#F0E8FF",
    padding: "5px 8px", borderRadius: 5, fontSize: 12, outline: "none",
  };

  return (
    <>
      <button onClick={() => setAbierto(a => !a)}
        title="Recorte de inicio y fin"
        style={{
          background: abierto || tieneRecorte ? "#9B2FFF22" : "transparent",
          border: `1px solid ${tieneRecorte ? "#9B2FFF" : "#9B2FFF33"}`,
          color: tieneRecorte ? "#C4A5FF" : "#7A6E8A",
          fontSize: 11, padding: "4px 8px", borderRadius: 6, cursor: "pointer", flexShrink: 0,
        }}>
        ✂{tieneRecorte ? ` ${item.trim_start_seconds ?? 0}-${item.trim_end_seconds ?? "fin"}` : ""}
      </button>

      {abierto && (
        <div style={{
          flexBasis: "100%", marginTop: 8, padding: "9px 10px", borderRadius: 8,
          background: "#08040F", border: "1px solid #9B2FFF33",
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        }}>
          <label style={{ fontSize: 10.5, color: "#7A6E8A" }}>
            Inicio (s)
            <input type="number" min={0} value={ini}
              onChange={e => setIni(e.target.value)}
              style={{ ...inputStyle, marginLeft: 6 }}/>
          </label>
          <label style={{ fontSize: 10.5, color: "#7A6E8A" }}>
            Fin (s)
            <input type="number" min={0} value={fin} placeholder="—"
              onChange={e => setFin(e.target.value)}
              style={{ ...inputStyle, marginLeft: 6 }}/>
          </label>
          <button onClick={guardar} disabled={guardando}
            style={{
              background: "#00F5A0", border: "none", color: "#08040F", fontSize: 11,
              fontWeight: 800, padding: "6px 12px", borderRadius: 6,
              cursor: guardando ? "wait" : "pointer",
            }}>
            {guardando ? "Guardando…" : "Guardar"}
          </button>
          <span style={{ fontSize: 10, color: "#7A6E8A", flexBasis: "100%" }}>
            Segundo absoluto del video. Fin vacío = hasta el final.
          </span>
          {estado && (
            <span style={{
              flexBasis: "100%", fontSize: 11, fontWeight: 600,
              color: estado.tipo === "error" ? "#FF2D78" : "#00F5A0",
            }}>{estado.texto}</span>
          )}
        </div>
      )}
    </>
  );
}

// Paleta de colores predefinidos para categorías nuevas
const COLOR_PALETTE = [
  "#9B2FFF", "#FF2D78", "#FFD600", "#00F5A0", "#FF9500",
  "#00E5FF", "#FF6B9D", "#A8E10C", "#FF4D4D", "#7A6E8A",
];

export default function PlaylistsPanel() {
  const {
    playlists,
    categories,
    loading,
    createPlaylist,
    deletePlaylist,
    renamePlaylist,
    setPlaylistCategories,
    addItemToPlaylist,
    importItemsToPlaylist,
    setItemTrims,
    removeItemFromPlaylist,
    addByUrl,
    createCategory,
    deleteCategory,
    renameCategory,
  } = useInternalPlaylists();

  // Estados de playlists
  const [newName, setNewName] = useState("");
  const [newCategoryIds, setNewCategoryIds] = useState([]);
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [editingNameId, setEditingNameId] = useState(null);
  const [editingNameValue, setEditingNameValue] = useState("");
  const [editingCatsId, setEditingCatsId] = useState(null);
  const [editingCatsValue, setEditingCatsValue] = useState([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Estados de categorías (sección de gestión)
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState(COLOR_PALETTE[0]);
  const [editingCatId, setEditingCatId] = useState(null);
  const [editingCatName, setEditingCatName] = useState("");
  const [editingCatColor, setEditingCatColor] = useState("");
  const [catStatus, setCatStatus] = useState(null);

  // Estados de agregar canción a playlist
  const [addingTo, setAddingTo] = useState(null);
  const [addTab, setAddTab] = useState("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [urlStatus, setUrlStatus] = useState(null);
  const searchTimerRef = useRef(null);

  // Importador de playlist de YouTube (pestaña "Playlist")
  const [plInput,     setPlInput]     = useState("");
  const [plLoading,   setPlLoading]   = useState(false);
  const [plPreview,   setPlPreview]   = useState([]);   // [{ytId,title,artist,thumb}]
  const [plElegidos,  setPlElegidos]  = useState(() => new Set());
  const [plImporting, setPlImporting] = useState(false);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!addingTo || addTab !== "search") return;
    if (searchQuery.trim().length < 3) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      const { results } = await searchYouTube(searchQuery, 8);
      setSearchResults(results);
      setSearching(false);
    }, 400);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery, addingTo, addTab]);

  // ─── HANDLERS PLAYLISTS ───

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const result = await createPlaylist(newName, null, newCategoryIds);
    setCreating(false);
    if (result) {
      setNewName("");
      setNewCategoryIds([]);
      setExpandedId(result.id);
    }
  };

  const toggleNewCategory = (catId) => {
    setNewCategoryIds(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  const startEditCategories = (playlist) => {
    setEditingCatsId(playlist.id);
    setEditingCatsValue(playlist.categoryIds || []);
  };

  const toggleEditCategory = (catId) => {
    setEditingCatsValue(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  const confirmEditCategories = async () => {
    if (!editingCatsId) return;
    await setPlaylistCategories(editingCatsId, editingCatsValue);
    setEditingCatsId(null);
    setEditingCatsValue([]);
  };

  const handleAddFromSearch = async (videoData) => {
    if (!addingTo) return;
    const result = await addItemToPlaylist(addingTo, {
      ytId: videoData.ytId,
      title: videoData.title,
      artist: videoData.artist,
      thumb: videoData.thumb,
    });
    if (result?.duplicate) {
      setUrlStatus({type:"error", text:"Este tema ya está en la playlist"});
      setTimeout(()=>setUrlStatus(null), 2500);
    }
  };

  // Paso 1 del import: leer la playlist de YouTube y mostrarla.
  // Reusa fetchYoutubePlaylist — el mismo lector paginado que ya alimentaba las
  // playlists del cliente. No hay una segunda implementación del paginado.
  const handleFetchPlaylist = async () => {
    if (!plInput.trim()) return;
    setPlLoading(true);
    setUrlStatus(null);
    setPlPreview([]);
    setPlElegidos(new Set());
    const { videos, error } = await fetchYoutubePlaylist(plInput);
    setPlLoading(false);
    if (error) { setUrlStatus({type:"error", text:error}); return; }
    setPlPreview(videos);
    // Vienen todos tildados menos los que la playlist ya tiene.
    const playlist = playlists.find(pl => pl.id === addingTo);
    const yaEstan = new Set((playlist?.items || []).map(i => i.yt_id));
    setPlElegidos(new Set(videos.filter(v => !yaEstan.has(v.ytId)).map(v => v.ytId)));
    setUrlStatus({type:"info", text:`Se encontraron ${videos.length} temas. Revisá y confirmá.`});
  };

  const togglePlElegido = (ytId) => {
    setPlElegidos(prev => {
      const next = new Set(prev);
      if (next.has(ytId)) next.delete(ytId); else next.add(ytId);
      return next;
    });
  };

  // Paso 2: importar los tildados, en el orden de YouTube.
  const handleImportPlaylist = async () => {
    if (!addingTo || !plElegidos.size) return;
    setPlImporting(true);
    setUrlStatus({type:"info", text:"Importando…"});
    try {
      const elegidos = plPreview.filter(v => plElegidos.has(v.ytId));
      const r = await importItemsToPlaylist(addingTo, elegidos);
      const partes = [`${r.agregadas} agregada${r.agregadas === 1 ? "" : "s"}`];
      if (r.omitidas) partes.push(`${r.omitidas} omitida${r.omitidas === 1 ? "" : "s"} (ya estaban)`);
      if (r.errores)  partes.push(`${r.errores} con error`);
      setUrlStatus({
        type: r.errores ? "error" : "success",
        text: (r.errores ? "⚠ " : "✓ ") + partes.join(" · ") +
              (r.detalleErrores?.length ? " — " + r.detalleErrores.join("; ") : ""),
      });
      if (!r.errores) { setPlPreview([]); setPlElegidos(new Set()); setPlInput(""); }
    } catch (err) {
      setUrlStatus({type:"error", text: err?.message || String(err)});
    } finally {
      setPlImporting(false);
    }
  };

  const handleAddFromUrl = async () => {
    if (!addingTo || !urlInput.trim()) return;
    setUrlStatus({type:"info", text:"Procesando..."});
    const result = await addByUrl(addingTo, urlInput);
    if (result.error) {
      setUrlStatus({type:"error", text: result.error});
    } else {
      setUrlStatus({type:"success", text:"✓ Tema agregado"});
      setUrlInput("");
      setTimeout(()=>setUrlStatus(null), 2500);
    }
  };

  const startRename = (playlist) => {
    setEditingNameId(playlist.id);
    setEditingNameValue(playlist.name);
  };

  const confirmRename = async () => {
    if (!editingNameId) return;
    const current = playlists.find(p=>p.id===editingNameId);
    if (editingNameValue.trim() && editingNameValue !== current?.name) {
      await renamePlaylist(editingNameId, editingNameValue);
    }
    setEditingNameId(null);
    setEditingNameValue("");
  };

  const confirmDelete = async (id) => {
    await deletePlaylist(id);
    setDeleteConfirmId(null);
    if (expandedId === id) setExpandedId(null);
  };

  // ─── HANDLERS CATEGORÍAS ───

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    const result = await createCategory(newCatName, newCatColor);
    if (result?.duplicate) {
      setCatStatus({type:"error", text:"Ya existe una categoría con ese nombre"});
      setTimeout(()=>setCatStatus(null), 2500);
      return;
    }
    if (result) {
      setNewCatName("");
      setNewCatColor(COLOR_PALETTE[0]);
      setCatStatus({type:"success", text:`✓ Categoría "${result.name}" creada`});
      setTimeout(()=>setCatStatus(null), 2500);
    }
  };

  const handleDeleteCategory = async (cat) => {
    if (cat.is_system) {
      setCatStatus({type:"error", text:"No se pueden borrar categorías del sistema"});
      setTimeout(()=>setCatStatus(null), 2500);
      return;
    }
    await deleteCategory(cat.id);
  };

  const startEditCat = (cat) => {
    setEditingCatId(cat.id);
    setEditingCatName(cat.name);
    setEditingCatColor(cat.color);
  };

  const confirmEditCat = async () => {
    if (!editingCatId) return;
    await renameCategory(editingCatId, editingCatName, editingCatColor);
    setEditingCatId(null);
    setEditingCatName("");
    setEditingCatColor("");
  };

  return (
    <div style={{padding:"20px 24px",maxWidth:900,margin:"0 auto"}}>
      <style>{`
        .pl-scroll::-webkit-scrollbar { width: 4px; }
        .pl-scroll::-webkit-scrollbar-thumb { background: #9B2FFF44; border-radius: 2px; }
      `}</style>

      {/* HEADER */}
      <div style={{marginBottom:20,display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:16}}>
        <div>
          <h2 style={{fontSize:22,fontWeight:800,color:"#F0E8FF",margin:0,marginBottom:4}}>
            🎵 Playlists internas
          </h2>
          <p style={{fontSize:13,color:"#7A6E8A",margin:0}}>
            Catálogo de canciones del bar. Compartidas entre todas las noches.
          </p>
        </div>
        <button onClick={()=>setShowCategoryManager(s=>!s)}
          style={{
            background:showCategoryManager?"#9B2FFF22":"transparent",
            border:`1px solid ${showCategoryManager?"#9B2FFF":"#9B2FFF44"}`,
            color:showCategoryManager?"#F0E8FF":"#9B2FFF",
            padding:"8px 14px",borderRadius:8,cursor:"pointer",
            fontSize:12,fontWeight:700,whiteSpace:"nowrap",
          }}>
          🏷️ {showCategoryManager?"Ocultar":"Gestionar"} categorías ({categories.length})
        </button>
      </div>

      {/* GESTOR DE CATEGORÍAS */}
      {showCategoryManager && (
        <div style={{
          background:"#1A0D2E",border:"1px solid #9B2FFF44",borderRadius:12,
          padding:16,marginBottom:20,
        }}>
          <div style={{fontSize:13,fontWeight:700,color:"#9B2FFF",marginBottom:12,textTransform:"uppercase",letterSpacing:1}}>
            Crear categoría
          </div>

          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12,flexWrap:"wrap"}}>
            <input
              type="text"
              value={newCatName}
              onChange={e=>setNewCatName(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&handleCreateCategory()}
              placeholder="Nombre de la categoría..."
              style={{
                flex:1,minWidth:200,background:"#08040F",border:"1px solid #9B2FFF44",
                color:"#F0E8FF",padding:"8px 12px",borderRadius:6,
                fontSize:13,outline:"none",
              }}
            />
            <div style={{display:"flex",gap:4}}>
              {COLOR_PALETTE.map(color => (
                <button key={color} onClick={()=>setNewCatColor(color)}
                  style={{
                    width:28,height:28,borderRadius:6,
                    border:newCatColor===color?"2px solid #F0E8FF":"2px solid transparent",
                    background:color,cursor:"pointer",padding:0,
                  }}
                  title={color}
                />
              ))}
            </div>
            <button onClick={handleCreateCategory}
              disabled={!newCatName.trim()}
              style={{
                background:"#9B2FFF",border:"none",color:"white",
                padding:"8px 14px",borderRadius:6,
                cursor:newCatName.trim()?"pointer":"not-allowed",
                fontSize:12,fontWeight:700,
                opacity:newCatName.trim()?1:.5,
              }}>
              + Crear
            </button>
          </div>

          {catStatus && (
            <div style={{
              padding:"6px 10px",borderRadius:6,marginBottom:10,
              background:catStatus.type==="error"?"#FF2D7822":"#00F5A022",
              border:`1px solid ${catStatus.type==="error"?"#FF2D78":"#00F5A0"}`,
              color:catStatus.type==="error"?"#FF2D78":"#00F5A0",
              fontSize:11,fontWeight:600,
            }}>
              {catStatus.text}
            </div>
          )}

          <div style={{fontSize:13,fontWeight:700,color:"#9B2FFF",marginBottom:8,marginTop:14,textTransform:"uppercase",letterSpacing:1}}>
            Existentes
          </div>

          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {categories.map(cat => {
              const isEditing = editingCatId === cat.id;
              if (isEditing) {
                return (
                  <div key={cat.id} style={{
                    background:"#08040F",border:`2px solid ${editingCatColor||cat.color}`,
                    borderRadius:8,padding:"6px 10px",display:"flex",gap:6,alignItems:"center",
                  }}>
                    <input
                      type="text"
                      value={editingCatName}
                      onChange={e=>setEditingCatName(e.target.value)}
                      onKeyDown={e=>{
                        if (e.key==="Enter") confirmEditCat();
                        if (e.key==="Escape") {setEditingCatId(null);}
                      }}
                      autoFocus
                      style={{background:"transparent",border:"none",color:"#F0E8FF",fontSize:12,fontWeight:600,outline:"none",width:90}}
                    />
                    <div style={{display:"flex",gap:3}}>
                      {COLOR_PALETTE.map(color => (
                        <button key={color} onClick={()=>setEditingCatColor(color)}
                          style={{
                            width:16,height:16,borderRadius:3,
                            border:editingCatColor===color?"2px solid #F0E8FF":"none",
                            background:color,cursor:"pointer",padding:0,
                          }}
                        />
                      ))}
                    </div>
                    <button onClick={confirmEditCat}
                      style={{background:"#00F5A0",border:"none",color:"#08040F",fontSize:10,fontWeight:800,padding:"3px 7px",borderRadius:4,cursor:"pointer"}}>
                      ✓
                    </button>
                    <button onClick={()=>setEditingCatId(null)}
                      style={{background:"transparent",border:"1px solid #FF2D7844",color:"#FF2D78",fontSize:10,padding:"3px 7px",borderRadius:4,cursor:"pointer"}}>
                      ✕
                    </button>
                  </div>
                );
              }
              return (
                <div key={cat.id} style={{
                  background:`${cat.color}22`,
                  border:`1px solid ${cat.color}66`,
                  borderRadius:8,padding:"6px 10px",display:"flex",gap:6,alignItems:"center",
                }}>
                  <span style={{fontSize:12,fontWeight:700,color:cat.color}}>
                    {cat.name}
                  </span>
                  {cat.is_system && (
                    <span style={{fontSize:9,color:"#7A6E8A",fontWeight:600,opacity:.7}}>
                      SYS
                    </span>
                  )}
                  <button onClick={()=>startEditCat(cat)}
                    title="Editar"
                    style={{background:"transparent",border:"none",color:cat.color,opacity:.7,cursor:"pointer",fontSize:11,padding:0}}>
                    ✎
                  </button>
                  {!cat.is_system && (
                    <button onClick={()=>handleDeleteCategory(cat)}
                      title="Borrar"
                      style={{background:"transparent",border:"none",color:"#FF2D78",opacity:.7,cursor:"pointer",fontSize:11,padding:0}}>
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CREAR NUEVA PLAYLIST */}
      <div style={{
        background:"#1A0D2E",border:"1px solid #9B2FFF44",borderRadius:12,
        padding:16,marginBottom:20,
      }}>
        <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:12}}>
          <input
            type="text"
            value={newName}
            onChange={e=>setNewName(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&handleCreate()}
            placeholder="Nombre de la nueva playlist..."
            style={{
              flex:1,background:"#08040F",border:"1px solid #9B2FFF44",
              color:"#F0E8FF",padding:"10px 14px",borderRadius:8,
              fontSize:14,outline:"none",
            }}
          />
          <button onClick={handleCreate}
            disabled={!newName.trim() || creating}
            style={{
              background:"#9B2FFF",border:"none",color:"white",
              padding:"10px 18px",borderRadius:8,cursor:newName.trim()?"pointer":"not-allowed",
              fontSize:13,fontWeight:700,
              opacity:(!newName.trim()||creating)?.5:1,
            }}>
            {creating ? "Creando..." : "+ Crear playlist"}
          </button>
        </div>

        <div>
          <div style={{fontSize:11,color:"#7A6E8A",marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>
            Categorías ({newCategoryIds.length} seleccionadas)
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
            {categories.map(cat => {
              const isSelected = newCategoryIds.includes(cat.id);
              return (
                <button key={cat.id} onClick={()=>toggleNewCategory(cat.id)}
                  style={{
                    background:isSelected?`${cat.color}33`:"transparent",
                    border:`1px solid ${isSelected?cat.color:cat.color+"44"}`,
                    color:isSelected?cat.color:cat.color+"88",
                    padding:"4px 9px",borderRadius:6,
                    fontSize:11,fontWeight:600,cursor:"pointer",
                    opacity:isSelected?1:.7,
                  }}>
                  {isSelected && "✓ "}{cat.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* LISTA DE PLAYLISTS */}
      {loading && (
        <div style={{textAlign:"center",color:"#7A6E8A",padding:40,fontSize:14}}>
          Cargando playlists...
        </div>
      )}

      {!loading && playlists.length === 0 && (
        <div style={{
          textAlign:"center",padding:60,
          background:"#1A0D2E33",borderRadius:12,
          border:"2px dashed #9B2FFF33",
        }}>
          <div style={{fontSize:48,marginBottom:12,opacity:.5}}>🎵</div>
          <div style={{fontSize:15,color:"#F0E8FF",marginBottom:6,fontWeight:600}}>
            Sin playlists creadas
          </div>
          <div style={{fontSize:12,color:"#7A6E8A"}}>
            Creá tu primera playlist arriba para empezar
          </div>
        </div>
      )}

      {!loading && playlists.map(playlist => {
        const isExpanded = expandedId === playlist.id;
        const isRenaming = editingNameId === playlist.id;
        const isEditingCats = editingCatsId === playlist.id;
        const isAddingThis = addingTo === playlist.id;
        const isConfirmingDelete = deleteConfirmId === playlist.id;

        return (
          <div key={playlist.id} style={{
            background:"#1A0D2E",border:`1px solid ${isExpanded?"#9B2FFF88":"#9B2FFF22"}`,
            borderRadius:12,marginBottom:10,overflow:"hidden",
          }}>
            <div style={{
              padding:"14px 16px",display:"flex",alignItems:"center",gap:12,
              cursor:isRenaming?"default":"pointer",
              background:isExpanded?"#9B2FFF11":"transparent",
            }}
            onClick={()=>{
              if (isRenaming || isConfirmingDelete || isEditingCats) return;
              setExpandedId(isExpanded ? null : playlist.id);
              setAddingTo(null);
            }}>
              <span style={{fontSize:18,opacity:isExpanded?1:.6,flexShrink:0}}>
                {isExpanded ? "▼" : "▶"}
              </span>

              <div style={{flex:1,minWidth:0}}>
                {isRenaming ? (
                  <input
                    type="text"
                    value={editingNameValue}
                    onChange={e=>setEditingNameValue(e.target.value)}
                    onKeyDown={e=>{
                      if (e.key==="Enter") confirmRename();
                      if (e.key==="Escape") { setEditingNameId(null); }
                    }}
                    onBlur={confirmRename}
                    onClick={e=>e.stopPropagation()}
                    autoFocus
                    style={{
                      width:"100%",background:"#08040F",border:"1px solid #9B2FFF",
                      color:"#F0E8FF",padding:"6px 10px",borderRadius:6,fontSize:15,outline:"none",
                    }}
                  />
                ) : (
                  <>
                    <div style={{fontSize:15,fontWeight:700,color:"#F0E8FF",marginBottom:3}}>
                      {playlist.name}
                    </div>
                    {playlist.categories?.length > 0 && (
                      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                        {playlist.categories.map(cat => (
                          <span key={cat.id} style={{
                            fontSize:9,fontWeight:700,
                            padding:"1px 6px",borderRadius:4,
                            background:`${cat.color}22`,
                            color:cat.color,
                            border:`1px solid ${cat.color}55`,
                          }}>
                            {cat.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <span style={{
                background:"#9B2FFF22",color:"#9B2FFF",
                fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:10,
                flexShrink:0,
              }}>
                {playlist.itemCount || 0} {playlist.itemCount===1?"tema":"temas"}
              </span>

              {!isRenaming && !isConfirmingDelete && !isEditingCats && (
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <button onClick={e=>{e.stopPropagation();startEditCategories(playlist);}}
                    title="Editar categorías"
                    style={{
                      background:"transparent",border:"1px solid #9B2FFF44",
                      color:"#9B2FFF",fontSize:12,padding:"5px 9px",borderRadius:6,cursor:"pointer",
                    }}>
                    🏷️
                  </button>
                  <button onClick={e=>{e.stopPropagation();startRename(playlist);}}
                    title="Renombrar"
                    style={{
                      background:"transparent",border:"1px solid #9B2FFF44",
                      color:"#9B2FFF",fontSize:12,padding:"5px 9px",borderRadius:6,cursor:"pointer",
                    }}>
                    ✎
                  </button>
                  <button onClick={e=>{e.stopPropagation();setDeleteConfirmId(playlist.id);}}
                    title="Borrar"
                    style={{
                      background:"transparent",border:"1px solid #FF2D7855",
                      color:"#FF2D78",fontSize:12,padding:"5px 9px",borderRadius:6,cursor:"pointer",
                    }}>
                    🗑
                  </button>
                </div>
              )}

              {isConfirmingDelete && (
                <div style={{display:"flex",gap:6,flexShrink:0,alignItems:"center"}}>
                  <span style={{fontSize:12,color:"#FF2D78",fontWeight:700}}>¿Borrar?</span>
                  <button onClick={e=>{e.stopPropagation();confirmDelete(playlist.id);}}
                    style={{background:"#FF2D78",border:"none",color:"white",fontSize:11,padding:"5px 9px",borderRadius:6,cursor:"pointer",fontWeight:700}}>
                    Sí
                  </button>
                  <button onClick={e=>{e.stopPropagation();setDeleteConfirmId(null);}}
                    style={{background:"transparent",border:"1px solid #9B2FFF44",color:"#F0E8FF",fontSize:11,padding:"5px 9px",borderRadius:6,cursor:"pointer"}}>
                    No
                  </button>
                </div>
              )}
            </div>

            {/* EDITAR CATEGORÍAS (panel inline) */}
            {isEditingCats && (
              <div style={{borderTop:"1px solid #9B2FFF22",padding:"12px 16px",background:"#08040F"}}>
                <div style={{fontSize:11,color:"#9B2FFF",marginBottom:8,textTransform:"uppercase",letterSpacing:1,fontWeight:700}}>
                  Seleccionar categorías ({editingCatsValue.length})
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:12}}>
                  {categories.map(cat => {
                    const isSelected = editingCatsValue.includes(cat.id);
                    return (
                      <button key={cat.id} onClick={()=>toggleEditCategory(cat.id)}
                        style={{
                          background:isSelected?`${cat.color}33`:"transparent",
                          border:`1px solid ${isSelected?cat.color:cat.color+"44"}`,
                          color:isSelected?cat.color:cat.color+"88",
                          padding:"4px 9px",borderRadius:6,
                          fontSize:11,fontWeight:600,cursor:"pointer",
                          opacity:isSelected?1:.7,
                        }}>
                        {isSelected && "✓ "}{cat.name}
                      </button>
                    );
                  })}
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={confirmEditCategories}
                    style={{background:"#00F5A0",border:"none",color:"#08040F",fontSize:11,fontWeight:800,padding:"6px 12px",borderRadius:6,cursor:"pointer"}}>
                    ✓ Guardar
                  </button>
                  <button onClick={()=>{setEditingCatsId(null);setEditingCatsValue([]);}}
                    style={{background:"transparent",border:"1px solid #FF2D7844",color:"#FF2D78",fontSize:11,padding:"6px 12px",borderRadius:6,cursor:"pointer"}}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {isExpanded && !isEditingCats && (
              <div style={{borderTop:"1px solid #9B2FFF22",padding:"12px 16px"}}>

                {!isAddingThis && (
                  <button onClick={()=>{
                    setAddingTo(playlist.id);
                    setAddTab("search");
                    setSearchQuery("");
                    setSearchResults([]);
                    setUrlInput("");
                    setUrlStatus(null);
                    setPlInput("");
                    setPlPreview([]);
                    setPlElegidos(new Set());
                  }}
                  style={{
                    width:"100%",padding:"10px",
                    background:"transparent",border:"2px dashed #9B2FFF44",
                    color:"#9B2FFF",borderRadius:8,cursor:"pointer",
                    fontSize:13,fontWeight:700,marginBottom:10,
                  }}>
                    + Agregar canción
                  </button>
                )}

                {isAddingThis && (
                  <div style={{background:"#08040F",border:"1px solid #9B2FFF44",borderRadius:10,padding:12,marginBottom:12}}>
                    <div style={{display:"flex",gap:6,marginBottom:10}}>
                      <button onClick={()=>setAddTab("search")}
                        style={{
                          flex:1,padding:"6px 10px",borderRadius:6,
                          border:`1px solid ${addTab==="search"?"#9B2FFF":"#9B2FFF33"}`,
                          background:addTab==="search"?"#9B2FFF22":"transparent",
                          color:addTab==="search"?"#F0E8FF":"#7A6E8A",
                          fontSize:11,fontWeight:600,cursor:"pointer",
                        }}>
                        🔍 Buscar
                      </button>
                      <button onClick={()=>setAddTab("url")}
                        style={{
                          flex:1,padding:"6px 10px",borderRadius:6,
                          border:`1px solid ${addTab==="url"?"#9B2FFF":"#9B2FFF33"}`,
                          background:addTab==="url"?"#9B2FFF22":"transparent",
                          color:addTab==="url"?"#F0E8FF":"#7A6E8A",
                          fontSize:11,fontWeight:600,cursor:"pointer",
                        }}>
                        🔗 Video
                      </button>
                      <button onClick={()=>setAddTab("playlist")}
                        style={{
                          flex:1,padding:"6px 10px",borderRadius:6,
                          border:`1px solid ${addTab==="playlist"?"#9B2FFF":"#9B2FFF33"}`,
                          background:addTab==="playlist"?"#9B2FFF22":"transparent",
                          color:addTab==="playlist"?"#F0E8FF":"#7A6E8A",
                          fontSize:11,fontWeight:600,cursor:"pointer",
                        }}>
                        📋 Playlist
                      </button>
                      <button onClick={()=>{setAddingTo(null);setUrlStatus(null);}}
                        style={{padding:"6px 10px",borderRadius:6,border:"1px solid #FF2D7844",background:"transparent",color:"#FF2D78",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                        ✕
                      </button>
                    </div>

                    {addTab === "search" && (
                      <div>
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={e=>setSearchQuery(e.target.value)}
                          placeholder="Buscar en YouTube..."
                          style={{
                            width:"100%",background:"#1A0D2E",border:"1px solid #9B2FFF44",
                            color:"#F0E8FF",padding:"8px 12px",borderRadius:6,
                            fontSize:13,outline:"none",marginBottom:8,boxSizing:"border-box",
                          }}
                        />
                        <div className="pl-scroll" style={{maxHeight:280,overflowY:"auto"}}>
                          {searching && <div style={{textAlign:"center",color:"#7A6E8A",padding:14,fontSize:12}}>Buscando...</div>}
                          {!searching && searchResults.length === 0 && searchQuery.length >= 3 && (
                            <div style={{textAlign:"center",color:"#7A6E8A",padding:14,fontSize:12}}>Sin resultados</div>
                          )}
                          {searchResults.map(r => {
                            const alreadyAdded = playlist.items?.some(i => i.yt_id === r.ytId);
                            return (
                              <div key={r.ytId} style={{
                                display:"flex",alignItems:"center",gap:10,padding:6,
                                borderRadius:6,marginBottom:4,
                                background:alreadyAdded?"#00F5A011":"transparent",
                              }}>
                                <img src={r.thumb} style={{width:54,height:34,borderRadius:4,objectFit:"cover",flexShrink:0}}/>
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{fontSize:12,color:"#F0E8FF",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                                    {r.title}
                                  </div>
                                  <div style={{fontSize:10,color:"#7A6E8A"}}>{r.artist}</div>
                                </div>
                                <button onClick={()=>handleAddFromSearch(r)} disabled={alreadyAdded}
                                  style={{
                                    background:alreadyAdded?"transparent":"#00F5A0",
                                    border:alreadyAdded?"1px solid #00F5A044":"none",
                                    color:alreadyAdded?"#00F5A0":"#08040F",
                                    fontSize:10,fontWeight:800,padding:"4px 9px",borderRadius:5,
                                    cursor:alreadyAdded?"default":"pointer",flexShrink:0,
                                  }}>
                                  {alreadyAdded ? "✓ Agregado" : "+ Agregar"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {addTab === "url" && (
                      <div>
                        <div style={{display:"flex",gap:6,marginBottom:8}}>
                          <input
                            type="text"
                            value={urlInput}
                            onChange={e=>setUrlInput(e.target.value)}
                            onKeyDown={e=>e.key==="Enter"&&handleAddFromUrl()}
                            placeholder="https://youtube.com/watch?v=... o ID del video"
                            style={{flex:1,background:"#1A0D2E",border:"1px solid #9B2FFF44",color:"#F0E8FF",padding:"8px 12px",borderRadius:6,fontSize:13,outline:"none"}}
                          />
                          <button onClick={handleAddFromUrl} disabled={!urlInput.trim()}
                            style={{background:"#9B2FFF",border:"none",color:"white",padding:"8px 14px",borderRadius:6,cursor:urlInput.trim()?"pointer":"not-allowed",fontSize:12,fontWeight:700,opacity:urlInput.trim()?1:.5}}>
                            Agregar
                          </button>
                        </div>
                        <div style={{fontSize:10,color:"#7A6E8A",lineHeight:1.4}}>
                          Aceptado: youtube.com/watch?v=XXX, youtu.be/XXX, youtube.com/shorts/XXX, o el ID directo
                        </div>
                      </div>
                    )}

                    {addTab === "playlist" && (
                      <div>
                        <div style={{display:"flex",gap:6,marginBottom:8}}>
                          <input
                            type="text"
                            value={plInput}
                            onChange={e=>setPlInput(e.target.value)}
                            onKeyDown={e=>e.key==="Enter"&&handleFetchPlaylist()}
                            placeholder="https://youtube.com/playlist?list=... o el ID de la lista"
                            style={{flex:1,background:"#1A0D2E",border:"1px solid #9B2FFF44",color:"#F0E8FF",padding:"8px 12px",borderRadius:6,fontSize:13,outline:"none"}}
                          />
                          <button onClick={handleFetchPlaylist} disabled={!plInput.trim()||plLoading}
                            style={{background:"#9B2FFF",border:"none",color:"white",padding:"8px 14px",borderRadius:6,cursor:plInput.trim()&&!plLoading?"pointer":"not-allowed",fontSize:12,fontWeight:700,opacity:plInput.trim()&&!plLoading?1:.5,whiteSpace:"nowrap"}}>
                            {plLoading ? "Leyendo…" : "Traer temas"}
                          </button>
                        </div>
                        <div style={{fontSize:10,color:"#7A6E8A",lineHeight:1.4,marginBottom:8}}>
                          Se importan hasta 150 temas, en el orden de YouTube. Los que ya están en
                          esta playlist se destildan solos.
                        </div>

                        {plPreview.length > 0 && (
                          <>
                            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                              <div style={{flex:1,fontSize:11,color:"#F0E8FF",fontWeight:700}}>
                                {plElegidos.size} de {plPreview.length} seleccionados
                              </div>
                              <button onClick={()=>setPlElegidos(new Set(plPreview.map(v=>v.ytId)))}
                                style={{background:"transparent",border:"1px solid #9B2FFF44",color:"#9B2FFF",fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:5,cursor:"pointer"}}>
                                Todos
                              </button>
                              <button onClick={()=>setPlElegidos(new Set())}
                                style={{background:"transparent",border:"1px solid #9B2FFF44",color:"#7A6E8A",fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:5,cursor:"pointer"}}>
                                Ninguno
                              </button>
                            </div>
                            <div className="pl-scroll" style={{maxHeight:280,overflowY:"auto",marginBottom:8}}>
                              {plPreview.map((v,idx) => {
                                const yaEsta = playlist.items?.some(i => i.yt_id === v.ytId);
                                const tildado = plElegidos.has(v.ytId);
                                return (
                                  <div key={v.ytId} onClick={()=>togglePlElegido(v.ytId)}
                                    style={{
                                      display:"flex",alignItems:"center",gap:9,padding:6,
                                      borderRadius:6,marginBottom:4,cursor:"pointer",
                                      background:tildado?"#9B2FFF18":"transparent",
                                      opacity:yaEsta&&!tildado?.55:1,
                                    }}>
                                    <input type="checkbox" readOnly checked={tildado}
                                      style={{accentColor:"#9B2FFF",flexShrink:0,pointerEvents:"none"}}/>
                                    <span style={{fontSize:10,color:"#7A6E8A",width:22,flexShrink:0,textAlign:"right"}}>{idx+1}</span>
                                    <img src={v.thumb} alt="" style={{width:54,height:34,borderRadius:4,objectFit:"cover",flexShrink:0}}/>
                                    <div style={{flex:1,minWidth:0}}>
                                      <div style={{fontSize:12,color:"#F0E8FF",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                                        {v.title}
                                      </div>
                                      <div style={{fontSize:10,color:"#7A6E8A"}}>
                                        {yaEsta ? "Ya está en la playlist" : (v.artist || "—")}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <button onClick={handleImportPlaylist} disabled={!plElegidos.size||plImporting}
                              style={{width:"100%",background:"#00F5A0",border:"none",color:"#08040F",padding:"9px 14px",borderRadius:6,cursor:plElegidos.size&&!plImporting?"pointer":"not-allowed",fontSize:12,fontWeight:800,opacity:plElegidos.size&&!plImporting?1:.5}}>
                              {plImporting ? "Importando…" : `Importar ${plElegidos.size} tema${plElegidos.size===1?"":"s"}`}
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {urlStatus && (
                      <div style={{
                        marginTop:8,padding:"6px 10px",borderRadius:6,
                        background:urlStatus.type==="error"?"#FF2D7822":urlStatus.type==="success"?"#00F5A022":"#9B2FFF22",
                        border:`1px solid ${urlStatus.type==="error"?"#FF2D78":urlStatus.type==="success"?"#00F5A0":"#9B2FFF"}`,
                        color:urlStatus.type==="error"?"#FF2D78":urlStatus.type==="success"?"#00F5A0":"#9B2FFF",
                        fontSize:11,fontWeight:600,
                      }}>
                        {urlStatus.text}
                      </div>
                    )}
                  </div>
                )}

                {playlist.items?.length === 0 && (
                  <div style={{textAlign:"center",color:"#7A6E8A",padding:20,fontSize:12}}>
                    Sin canciones todavía
                  </div>
                )}

                {playlist.items?.map(item => (
                  <div key={item.id} style={{
                    display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",
                    padding:8,borderRadius:8,marginBottom:4,
                    background:"#08040F66",
                  }}>
                    <img src={item.thumb_url || `https://img.youtube.com/vi/${item.yt_id}/mqdefault.jpg`}
                      style={{width:48,height:30,borderRadius:4,objectFit:"cover",flexShrink:0,background:"#9B2FFF22"}}
                      onError={(e)=>{e.target.style.opacity=.3}}
                    />
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:600,color:"#F0E8FF",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                        {item.title}
                      </div>
                      {item.artist && (
                        <div style={{fontSize:10,color:"#7A6E8A",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                          {item.artist}
                        </div>
                      )}
                    </div>
                    <FilaRecorte item={item} onGuardar={setItemTrims}/>
                    <button onClick={()=>removeItemFromPlaylist(item.id)}
                      title="Quitar de la playlist"
                      style={{background:"transparent",border:"1px solid #FF2D7844",color:"#FF2D78",fontSize:11,padding:"4px 9px",borderRadius:6,cursor:"pointer",flexShrink:0}}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
