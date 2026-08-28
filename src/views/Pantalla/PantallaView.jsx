import { useState, useCallback } from "react";
import { BlockedView, VideoRow } from "../../components/UI";
import { useYouTubePlaylists } from "../../hooks/useYouTubePlaylists";
import { ytThumb } from "../../constants/theme";
import DjVotingTab from "./DjVotingTab";

function MensajesTab({ user, messages, onSend }) {
  const [text, setText] = useState("");
  const send = useCallback(() => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  }, [text, onSend]);
  const myMsgs = (messages||[]).filter(m => m.userId==="me"||m.user_id===user?.id);
  const statusInfo = {
    approved:{ label:"✓ En pantalla",         color:"#00F5A0", bg:"rgba(0,245,160,.08)",  border:"rgba(0,245,160,.25)"  },
    rejected:{ label:"✕ No aprobado",          color:"#FF2D78", bg:"rgba(255,45,120,.08)", border:"rgba(255,45,120,.22)" },
    pending: { label:"⏳ Esperando aprobación",color:"rgba(255,214,0,.7)",bg:"rgba(255,214,0,.05)",border:"rgba(255,214,0,.15)"},
  };
  return (
    <>
      <div style={{fontSize:12,color:"rgba(240,232,255,.4)",marginBottom:12,lineHeight:1.5}}>
        El staff revisa tu mensaje antes de mostrarlo en la pantalla gigante.
      </div>
      <textarea style={{width:"100%",height:80,resize:"none",background:"rgba(240,232,255,.05)",border:"1.5px solid rgba(240,232,255,.1)",borderRadius:13,padding:"11px 14px",color:"#F0E8FF",fontFamily:"DM Sans,sans-serif",fontSize:13,outline:"none",boxSizing:"border-box",marginBottom:4}}
        placeholder="¿Qué querés decirle al bar?" value={text}
        onChange={e=>setText(e.target.value.slice(0,100))}/>
      <div style={{textAlign:"right",fontSize:10,color:"rgba(240,232,255,.22)",marginBottom:10}}>{text.length}/100</div>
      <button className="btn-primary" style={{opacity:!text.trim()?.3:1}}
        disabled={!text.trim()} onClick={send}>📢 Mandar mensaje</button>
      {myMsgs.length>0&&(<>
        <div style={{fontSize:10,fontWeight:700,color:"rgba(240,232,255,.35)",letterSpacing:"1px",marginTop:18,marginBottom:8}}>TUS MENSAJES</div>
        {myMsgs.map((m,i)=>{const st=statusInfo[m.status]||statusInfo.pending;return(
          <div key={i} style={{padding:"9px 12px",marginBottom:6,borderRadius:11,background:st.bg,border:`1px solid ${st.border}`}}>
            <div style={{fontSize:12,color:"rgba(240,232,255,.8)",marginBottom:4}}>{m.text}</div>
            <div style={{fontSize:10,fontWeight:700,color:st.color}}>{st.label}</div>
          </div>
        );})}
      </>)}
    </>
  );
}

function VideosTab({ videos, loading, error, onSendVideo, user }) {
  const [selVideo, setSelVideo] = useState(null);
  const [sent,     setSent]     = useState(false);
  const reset = useCallback(()=>{setSent(false);setSelVideo(null);},[]);

  if (loading) return (
    <div style={{textAlign:"center",padding:"32px 0"}}>
      <div style={{fontSize:28,marginBottom:10,opacity:.4}}>🎵</div>
      <div style={{fontSize:12,color:"rgba(240,232,255,.3)"}}>Cargando playlist del bar...</div>
    </div>
  );
  if (error) return (
    <div style={{padding:"12px 14px",background:"rgba(255,45,120,.08)",border:"1px solid rgba(255,45,120,.2)",borderRadius:12,fontSize:12,color:"#FCA5A5"}}>
      ⚠️ No se pudo cargar la playlist: {error}
    </div>
  );
  if (!videos.length) return (
    <div style={{textAlign:"center",padding:"28px 0",color:"rgba(240,232,255,.25)",fontSize:12}}>
      <div style={{fontSize:32,marginBottom:8,opacity:.3}}>🎵</div>
      El staff aún no configuró la playlist de videos.
    </div>
  );
  if (sent) return (
    <div style={{textAlign:"center",padding:"22px 14px"}}>
      <div style={{fontSize:36,marginBottom:10}}>🎵</div>
      <div style={{fontFamily:"Syne,sans-serif",fontSize:15,fontWeight:900,color:"#00E5FF",marginBottom:6}}>{selVideo?.title}</div>
      <div style={{fontSize:12,color:"#00F5A0",marginBottom:16}}>✓ Pedido enviado — el staff lo suelta cuando corresponde</div>
      <button onClick={reset} style={{padding:"8px 18px",background:"rgba(240,232,255,.07)",border:"1px solid rgba(240,232,255,.15)",borderRadius:10,color:"rgba(240,232,255,.5)",fontFamily:"Syne,sans-serif",fontSize:12,fontWeight:700,cursor:"pointer"}}>
        Pedir otro video
      </button>
    </div>
  );
  return (
    <>
      <div style={{fontSize:12,color:"rgba(240,232,255,.4)",marginBottom:12,lineHeight:1.5}}>
        Elegí un video de la playlist del bar. El staff lo proyecta cuando quiere.
      </div>
      {videos.map(v=>(
        <VideoRow key={v.ytId} video={v} selected={selVideo?.ytId===v.ytId} onSelect={setSelVideo} color="#00E5FF"/>
      ))}
      {selVideo && (
        <div
          onClick={() => setSelVideo(null)}
          style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,.7)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}
        >
          <div
            onClick={e=>e.stopPropagation()}
            style={{position:"relative",width:"100%",maxWidth:340,background:"#0D0700",border:"1px solid rgba(255,215,0,.18)",borderRadius:16,padding:20,boxShadow:"0 20px 60px rgba(0,0,0,.6)"}}
          >
            <button
              onClick={()=>setSelVideo(null)}
              style={{position:"absolute",top:12,right:12,width:30,height:30,borderRadius:"50%",border:"1px solid rgba(240,232,255,.15)",background:"rgba(240,232,255,.06)",color:"rgba(240,232,255,.6)",fontSize:15,cursor:"pointer",lineHeight:1,display:"flex",alignItems:"center",justifyContent:"center"}}
            >✕</button>

            <img
              src={ytThumb(selVideo.ytId)}
              alt={selVideo.title}
              style={{width:"100%",aspectRatio:"16/9",objectFit:"cover",borderRadius:12,marginBottom:14}}
            />
            <div style={{fontFamily:"Syne,sans-serif",fontSize:16,fontWeight:900,color:"#F0E8FF",marginBottom:4,lineHeight:1.25}}>
              {selVideo.title}
            </div>
            {selVideo.artist && (
              <div style={{fontSize:12,color:"rgba(0,229,255,.7)",marginBottom:18}}>{selVideo.artist}</div>
            )}

            <button className="btn-primary"
              onClick={()=>{ onSendVideo?.(selVideo); setSent(true); }}
              style={{marginBottom:8}}
            >🎵 Pedir este video</button>
            <button
              onClick={()=>setSelVideo(null)}
              style={{width:"100%",padding:11,border:"1px solid rgba(240,232,255,.12)",borderRadius:12,background:"transparent",color:"rgba(240,232,255,.5)",fontFamily:"Syne,sans-serif",fontSize:13,fontWeight:700,cursor:"pointer"}}
            >Volver</button>
          </div>
        </div>
      )}
    </>
  );
}

export default function PantallaView({ user, messages, onSend, isRestricted, isGuest = false, onGoProfile, ytConfig, onSendVideo }) {
  // El QR del evento apunta a /?pantallaCode=XXXXXX: abre directo la votación.
  const [tab, setTab] = useState(() =>
    new URLSearchParams(window.location.search).get("pantallaCode") ? "dj" : "mensajes");
  const [pressed, setPressed] = useState(null);
  const { playlists = {}, loading, errors = {} } = useYouTubePlaylists(ytConfig||{});

  // El geo-gate se aplica DENTRO de cada pestaña, no sobre la sección entera:
  // antes cortaba acá y la botonera nunca llegaba a renderizarse, así que la
  // pestaña 🎧 Música era invisible para cualquiera sin ubicación verificada.
  const bloqueado = (
    <BlockedView icon="📺" label="Mandalo a Pantalla"
      reason={!user?.registered?"Registrate para mandar mensajes y videos a la pantalla.":"Verificá tu ubicación en el bar."}
      onCTA={onGoProfile} ctaLabel={!user?.registered?"👤 Registrarme":"📍 Verificar ubicación"}/>
  );
  return (
    <div>
      <div className="sec-hdr">
        <span style={{fontSize:20}}>📺</span>
        <h3>Mandalo a Pantalla</h3>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:16}}>
        {[{id:"mensajes",label:"💬 Mensajes"},{id:"videos",label:"🎵 Videoclips"},{id:"dj",label:"🎧 Música"}].map(t=>{
          const isSel = tab===t.id, isPressed = pressed===t.id;
          return (
          <button key={t.id} className="btn-pantalla"
            onClick={()=>setTab(t.id)}
            onPointerDown={()=>setPressed(t.id)}
            onPointerUp={()=>setPressed(null)}
            onPointerLeave={()=>setPressed(null)}
            onPointerCancel={()=>setPressed(null)}
            style={{flex:1,padding:"9px 8px",borderRadius:10,border:`1.5px solid ${isSel?"rgba(255,215,0,.4)":"rgba(245,230,192,.1)"}`,fontFamily:"Syne,sans-serif",fontWeight:700,fontSize:12,cursor:"pointer",background:isSel?"rgba(255,215,0,.1)":"rgba(245,230,192,.03)",color:isSel?"#FFD700":"rgba(245,230,192,.4)",transform:isPressed?"scale(.98)":"scale(1)"}}>
            {t.label}{t.id==="videos"&&playlists.videos?.length>0&&<span style={{marginLeft:6,fontSize:9,opacity:.6}}>{playlists.videos.length}</span>}
          </button>
          );
        })}
      </div>
      {tab==="mensajes"&&(isRestricted ? bloqueado : <MensajesTab user={user} messages={messages} onSend={onSend}/>)}
      {tab==="videos"&&(isRestricted ? bloqueado : <VideosTab videos={playlists.videos||[]} loading={loading} error={errors.videos} onSendVideo={onSendVideo} user={user}/>)}
      {/* Votación musical en vivo (módulo Pantalla/Escenario) */}
      {tab==="dj"&&<DjVotingTab user={user} isRestricted={isRestricted} isGuest={isGuest} onGoProfile={onGoProfile}/>}
    </div>
  );
}
