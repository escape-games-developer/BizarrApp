import { useState, useCallback } from "react";
import {
  useYouTubePlaylistAdmin,
  useYouTubePlaylists,
  PLAYLIST_TYPES,
  parsePlaylistId,
} from "../../hooks/useYouTubePlaylists";

const COLORS = {
  videos:  { col:"#00E5FF", bg:"rgba(0,229,255,.08)",  bdr:"rgba(0,229,255,.3)"  },
  karaoke: { col:"#A855F7", bg:"rgba(168,85,247,.08)", bdr:"rgba(168,85,247,.3)" },
  ftl:     { col:"#FF2D78", bg:"rgba(255,45,120,.08)", bdr:"rgba(255,45,120,.3)" },
  pt:      { col:"#00F5A0", bg:"rgba(0,245,160,.08)",  bdr:"rgba(0,245,160,.3)"  },
};

function SourceBadge({ source, count }) {
  const isYT = source === "youtube";
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:5,
      padding:"3px 9px", borderRadius:10,
      background: isYT ? "rgba(255,0,0,.12)" : "rgba(255,214,0,.08)",
      border:`1px solid ${isYT ? "rgba(255,0,0,.3)" : "rgba(255,214,0,.2)"}`,
      fontSize:9.5, fontWeight:700,
      color: isYT ? "#FF6B6B" : "rgba(255,214,0,.7)",
    }}>
      {isYT ? "▶ YouTube" : "💾 Fallback"}
      <span style={{opacity:.6}}>· {count} videos</span>
    </div>
  );
}

export default function PlaylistsPanel() {
  const { config, updatePlaylistId, removePlaylistId } = useYouTubePlaylistAdmin();
  const { playlists, sources, loading, lastSync, totalVideos, refresh } =
    useYouTubePlaylists(config);

  const [inputs,  setInputs]  = useState({});
  const [preview, setPreview] = useState(null);
  const [saving,  setSaving]  = useState({});

  const handleSave = useCallback(async (type) => {
    const raw = inputs[type] || "";
    const pid = parsePlaylistId(raw);
    if (!pid) return;
    setSaving(s => ({ ...s, [type]: true }));
    updatePlaylistId(type, pid);
    await refresh();
    setSaving(s => ({ ...s, [type]: false }));
  }, [inputs, updatePlaylistId, refresh]);

  const hasApiKey = !!(typeof import.meta !== "undefined" && import.meta.env?.VITE_YOUTUBE_API_KEY);
  const allFallback = Object.values(sources).every(s => s === "fallback");

  return (
    <div>
      {/* Status bar */}
      <div style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"11px 14px", borderRadius:13, marginBottom:14,
        background:"rgba(240,232,255,.04)", border:"1px solid rgba(240,232,255,.09)",
      }}>
        <div>
          <div style={{fontSize:12, fontWeight:700, color:"#F0E8FF", marginBottom:2}}>
            {totalVideos} videos disponibles
          </div>
          <div style={{fontSize:10, color:"rgba(240,232,255,.3)"}}>
            {allFallback
              ? "💾 Modo offline — usando catálogo local"
              : `▶ Sincronizado con YouTube${lastSync ? ` · ${lastSync.toLocaleTimeString("es-AR")}` : ""}`}
          </div>
        </div>
        <button onClick={refresh} disabled={loading} style={{
          padding:"7px 13px", borderRadius:9, border:"1px solid rgba(240,232,255,.15)",
          background:"rgba(240,232,255,.06)", color:"rgba(240,232,255,.6)",
          fontFamily:"Syne,sans-serif", fontWeight:700, fontSize:11,
          cursor:loading?"not-allowed":"pointer", opacity:loading?.5:1,
        }}>
          {loading ? "⏳ Sync..." : "🔄 Sincronizar"}
        </button>
      </div>

      {/* Info sobre modo dual */}
      <div style={{
        padding:"11px 14px", borderRadius:12, marginBottom:16,
        background:"rgba(255,214,0,.05)", border:"1px solid rgba(255,214,0,.15)",
        fontSize:11, color:"rgba(255,214,0,.7)", lineHeight:1.6,
      }}>
        <strong style={{color:"#FFD600"}}>Modo dual habilitado:</strong> si hay WiFi y una
        playlist de YouTube configurada, se usan esos videos. Si no hay red o no hay API key,
        el sistema usa automáticamente el catálogo local — sin mensajes de error para el usuario.
      </div>

      {/* Sin API key */}
      {!hasApiKey && (
        <div style={{
          padding:"11px 14px", borderRadius:12, marginBottom:14,
          background:"rgba(255,45,120,.08)", border:"1px solid rgba(255,45,120,.25)",
          fontSize:11, color:"#FCA5A5", lineHeight:1.5,
        }}>
          <strong>⚠️ VITE_YOUTUBE_API_KEY no configurada.</strong> Sin la API key de YouTube
          solo funciona el catálogo local. Podés seguir usando la app normalmente —
          los videos de fallback siempre están disponibles.
        </div>
      )}

      {/* Una card por tipo de playlist */}
      {PLAYLIST_TYPES.map(pt => {
        const videos   = playlists[pt.id] || [];
        const source   = sources[pt.id];
        const isYT     = source === "youtube";
        const curId    = config[pt.id];
        const col      = COLORS[pt.id];
        const isOpen   = preview === pt.id;
        const isSaving = saving[pt.id];

        return (
          <div key={pt.id} style={{
            background:"rgba(240,232,255,.04)",
            border:`1px solid ${isYT ? col.bdr : "rgba(240,232,255,.09)"}`,
            borderRadius:16, marginBottom:12, overflow:"hidden",
          }}>
            {/* Top bar del tipo */}
            <div style={{
              display:"flex", alignItems:"center", gap:10,
              padding:"11px 14px",
              borderBottom:"1px solid rgba(240,232,255,.07)",
            }}>
              <span style={{fontSize:20,flexShrink:0}}>{pt.icon}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:col.col}}>{pt.label}</div>
                <div style={{fontSize:9.5,color:"rgba(240,232,255,.3)",marginTop:1}}>{pt.module} · {pt.desc}</div>
              </div>
              <SourceBadge source={source} count={videos.length}/>
            </div>

            {/* Configuración de playlist ID */}
            <div style={{padding:"11px 14px"}}>
              <div style={{fontSize:10,color:"rgba(240,232,255,.35)",marginBottom:6}}>
                {isYT
                  ? `✓ Playlist de YouTube configurada (${videos.length} videos)`
                  : "Pegá la URL o ID de la playlist de YouTube para reemplazar el catálogo local"}
              </div>

              <div style={{display:"flex",gap:7}}>
                <input
                  style={{
                    flex:1, background:"rgba(240,232,255,.05)",
                    border:`1px solid ${isYT ? col.bdr : "rgba(240,232,255,.1)"}`,
                    borderRadius:10, padding:"8px 12px",
                    color:"#F0E8FF", fontFamily:"Space Grotesk,sans-serif",
                    fontSize:11, outline:"none",
                  }}
                  placeholder={curId || "https://youtube.com/playlist?list=PL..."}
                  value={inputs[pt.id] ?? curId ?? ""}
                  onChange={e => setInputs(s => ({ ...s, [pt.id]: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && handleSave(pt.id)}
                />
                <button onClick={() => handleSave(pt.id)}
                  disabled={isSaving || !inputs[pt.id]}
                  style={{
                    padding:"8px 14px", borderRadius:10, border:"none",
                    background:`linear-gradient(135deg,${col.col},${col.col}BB)`,
                    color:"#08040F", fontFamily:"Syne,sans-serif", fontWeight:800,
                    fontSize:11, cursor:"pointer", flexShrink:0,
                    opacity:(isSaving||!inputs[pt.id])?.4:1,
                  }}>
                  {isSaving ? "⏳" : "✓"}
                </button>
                {curId && (
                  <button onClick={() => { removePlaylistId(pt.id); setInputs(s => ({...s,[pt.id]:""})); }}
                    style={{
                      padding:"8px 11px", borderRadius:10,
                      background:"rgba(255,45,120,.1)", border:"1px solid rgba(255,45,120,.25)",
                      color:"#FCA5A5", fontFamily:"Syne,sans-serif", fontWeight:700,
                      fontSize:11, cursor:"pointer", flexShrink:0,
                    }}>
                    ✕
                  </button>
                )}
              </div>

              {/* Preview toggle */}
              <button onClick={() => setPreview(isOpen ? null : pt.id)}
                style={{
                  marginTop:9, padding:"5px 11px", borderRadius:8,
                  background: isOpen ? col.bg : "rgba(240,232,255,.05)",
                  border:`1px solid ${isOpen ? col.bdr : "rgba(240,232,255,.1)"}`,
                  color: isOpen ? col.col : "rgba(240,232,255,.35)",
                  fontFamily:"Syne,sans-serif", fontWeight:700, fontSize:10, cursor:"pointer",
                }}>
                {isOpen ? "▲ Ocultar" : `▼ Ver ${videos.length} videos`}
                {!isYT && <span style={{marginLeft:6,opacity:.5}}>· catálogo local</span>}
              </button>

              {/* Lista de videos */}
              {isOpen && (
                <div style={{marginTop:9, maxHeight:260, overflowY:"auto", scrollbarWidth:"thin"}}>
                  {videos.map((v, i) => (
                    <div key={v.ytId} style={{
                      display:"flex", alignItems:"center", gap:9,
                      padding:"6px 7px", borderRadius:8, marginBottom:4,
                      background:"rgba(240,232,255,.03)",
                      border:"1px solid rgba(240,232,255,.06)",
                    }}>
                      <div style={{fontSize:9.5,color:"rgba(240,232,255,.22)",width:18,textAlign:"right",flexShrink:0}}>{i+1}</div>
                      <img src={v.thumb} alt={v.title} style={{width:48,height:27,borderRadius:5,objectFit:"cover",flexShrink:0}}/>
                      <div style={{flex:1,overflow:"hidden"}}>
                        <div style={{fontSize:11,fontWeight:600,color:"#F0E8FF",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{v.title}</div>
                        {v.artist&&<div style={{fontSize:9.5,color:"rgba(240,232,255,.32)",marginTop:1}}>{v.artist}</div>}
                      </div>
                      {!isYT && <span style={{fontSize:9,color:"rgba(255,214,0,.35)",flexShrink:0}}>local</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Instrucciones */}
      <div style={{
        padding:"12px 14px", borderRadius:12, marginTop:4,
        background:"rgba(240,232,255,.03)", border:"1px solid rgba(240,232,255,.07)",
        fontSize:11, color:"rgba(240,232,255,.38)", lineHeight:1.6,
      }}>
        <div style={{fontWeight:700,color:"rgba(240,232,255,.55)",marginBottom:5}}>Cómo configurar YouTube</div>
        <div>1. Abrí tu canal y andá a la playlist que querés vincular</div>
        <div>2. Copiá la URL completa o solo el ID (empieza con <code style={{color:"#00E5FF",fontSize:10}}>PL</code>)</div>
        <div>3. Pegala en el campo del tipo correspondiente y guardá</div>
        <div>4. Si hay WiFi, los videos del canal reemplazan al catálogo local</div>
        <div style={{marginTop:7,color:"rgba(240,232,255,.22)",fontSize:10}}>
          Videos privados y eliminados se filtran automáticamente.
          Sin WiFi o sin API key, el catálogo local siempre está disponible.
        </div>
      </div>
    </div>
  );
}
