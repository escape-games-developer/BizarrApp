import { useState, useCallback } from "react";
import { BlockedView, VideoRow } from "../../components/UI";
import { useYouTubePlaylists } from "../../hooks/useYouTubePlaylists";
import { ytThumb } from "../../constants/theme";

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
      <textarea style={{width:"100%",height:80,resize:"none",background:"rgba(240,232,255,.05)",border:"1.5px solid rgba(240,232,255,.1)",borderRadius:13,padding:"11px 14px",color:"#F0E8FF",fontFamily:"Space Grotesk,sans-serif",fontSize:13,outline:"none",boxSizing:"border-box",marginBottom:4}}
        placeholder="¿Qué querés decirle al bar?" value={text}
        onChange={e=>setText(e.target.value.slice(0,100))}/>
      <div style={{textAlign:"right",fontSize:10,color:"rgba(240,232,255,.22)",marginBottom:10}}>{text.length}/100</div>
      <button className="btn-enviar" style={{width:"100%",padding:14,border:"none",borderRadius:14,background:"rgba(220,38,38,1)",color:"#FFD600",fontFamily:"Syne,sans-serif",fontSize:14,fontWeight:800,cursor:"pointer",opacity:!text.trim()?.3:1,outline:"none",WebkitTapHighlightColor:"transparent",textShadow:"-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000"}}
        disabled={!text.trim()} onClick={send}>Mandar mensaje</button>
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
            style={{position:"relative",width:"100%",maxWidth:340,background:"linear-gradient(160deg,#120A1F,#0A0712)",border:"none",borderRadius:20,padding:20,boxShadow:"0 20px 60px rgba(0,0,0,.6)"}}
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

            <button className="btn-enviar"
              onClick={()=>{ onSendVideo?.(selVideo); setSent(true); }}
              style={{width:"100%",padding:14,border:"none",borderRadius:14,background:"rgba(220,38,38,1)",color:"#FFD600",fontFamily:"Syne,sans-serif",fontSize:14,fontWeight:800,cursor:"pointer",marginBottom:8,outline:"none",WebkitTapHighlightColor:"transparent",textShadow:"-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000"}}
            >Pedir este video</button>
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

export default function PantallaView({ user, messages, onSend, isRestricted, onGoProfile, ytConfig, onSendVideo }) {
  const [tab, setTab] = useState("mensajes");
  const [pressed, setPressed] = useState(null);
  const { playlists = {}, loading, errors = {} } = useYouTubePlaylists(ytConfig||{});

  if (isRestricted) return (
    <BlockedView icon="📺" label="Mandalo a Pantalla"
      reason={!user?.registered?"Registrate para mandar mensajes y videos a la pantalla.":"Verificá tu ubicación en el bar."}
      onCTA={onGoProfile} ctaLabel={!user?.registered?"👤 Registrarme":"📍 Verificar ubicación"}/>
  );
  return (
    <div>
      <div role="heading" aria-level={1} style={{marginTop:0,marginBottom:14}}>
        <img src="/placas/Directo_a_pantall-removebg-preview.png" alt="Directo a pantalla"
          style={{width:"96%",maxWidth:"98%",height:"auto",objectFit:"contain",display:"block",margin:"0 auto"}}/>
      </div>
      <div style={{display:"flex",gap:44,marginTop:-12,marginBottom:16,justifyContent:"center"}}>
        {[{id:"mensajes",img:"/placas/Mensajes-removebg-preview.png",alt:"Mensajes"},{id:"videos",img:"/placas/Videos-removebg-preview.png",alt:"Videoclips"}].map(t=>{
          const isSel = tab===t.id, isPressed = pressed===t.id;
          return (
          <button key={t.id} className="btn-pantalla"
            onClick={()=>setTab(t.id)}
            onPointerDown={()=>setPressed(t.id)}
            onPointerUp={()=>setPressed(null)}
            onPointerLeave={()=>setPressed(null)}
            onPointerCancel={()=>setPressed(null)}
            style={{width:79,maxWidth:79,aspectRatio:"1/1",padding:0,borderRadius:"50%",overflow:"hidden",border:"2px solid rgba(240,232,255,.12)",cursor:"pointer",background:(isSel||isPressed)?"rgba(220,38,38,1)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",boxShadow:"none",transform:isPressed?"scale(.96)":"scale(1)",transition:"background-color 200ms ease, transform 150ms ease",WebkitTapHighlightColor:"transparent",outline:"none",userSelect:"none"}}>
            <img src={t.img} alt={t.alt} style={{width:"88%",height:"88%",objectFit:"contain"}}/>
            {t.id==="videos"&&playlists.videos?.length>0&&<span style={{position:"absolute",top:3,right:6,fontSize:9,fontWeight:700,opacity:.9,color:"rgba(255,255,255,.92)"}}>{playlists.videos.length}</span>}
          </button>
          );
        })}
      </div>
      {tab==="mensajes"&&<MensajesTab user={user} messages={messages} onSend={onSend}/>}
      {tab==="videos"&&<VideosTab videos={playlists.videos||[]} loading={loading} error={errors.videos} onSendVideo={onSendVideo} user={user}/>}
    </div>
  );
}
