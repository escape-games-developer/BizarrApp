import { useState, useCallback } from "react";
import { BlockedView, VideoRow } from "../../components/UI";
import { useYouTubePlaylists } from "../../hooks/useYouTubePlaylists";

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
      <button style={{width:"100%",padding:14,border:"none",borderRadius:14,background:"linear-gradient(135deg,#00E5FF,#00F5A0)",color:"#08040F",fontFamily:"Syne,sans-serif",fontSize:14,fontWeight:800,cursor:"pointer",opacity:!text.trim()?.3:1}}
        disabled={!text.trim()} onClick={send}>📢 Mandar a pantalla</button>
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

function VideosTab({ videos, loading, error }) {
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
      <button disabled={!selVideo} onClick={()=>setSent(true)}
        style={{width:"100%",padding:14,border:"none",borderRadius:14,marginTop:4,background:"linear-gradient(135deg,#00E5FF,#00F5A0)",color:"#08040F",fontFamily:"Syne,sans-serif",fontSize:14,fontWeight:800,cursor:"pointer",opacity:!selVideo?.3:1}}>
        🎵 Pedir este video
      </button>
    </>
  );
}

export default function PantallaView({ user, messages, onSend, isRestricted, onGoProfile, ytConfig }) {
  const [tab, setTab] = useState("mensajes");
  const { playlists, loading, errors } = useYouTubePlaylists(ytConfig||{});

  if (isRestricted) return (
    <BlockedView icon="📺" label="Mandalo a Pantalla"
      reason={!user?.registered?"Registrate para mandar mensajes y videos a la pantalla.":"Verificá tu ubicación en el bar."}
      onCTA={onGoProfile} ctaLabel={!user?.registered?"👤 Registrarme":"📍 Verificar ubicación"}/>
  );
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:18}}>
        <span style={{fontSize:20}}>📺</span>
        <div style={{fontFamily:"Syne,sans-serif",fontWeight:900,fontSize:24,background:"linear-gradient(135deg,#00E5FF,#00F5A0)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>
          Mandalo a Pantalla
        </div>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:16}}>
        {[{id:"mensajes",label:"💬 Mensajes"},{id:"videos",label:"🎵 Videoclips"}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"9px 8px",borderRadius:10,border:`1.5px solid ${tab===t.id?"rgba(0,229,255,.4)":"rgba(240,232,255,.1)"}`,fontFamily:"Syne,sans-serif",fontWeight:700,fontSize:12,cursor:"pointer",background:tab===t.id?"rgba(0,229,255,.1)":"rgba(240,232,255,.03)",color:tab===t.id?"#00E5FF":"rgba(240,232,255,.4)"}}>
            {t.label}{t.id==="videos"&&playlists.videos?.length>0&&<span style={{marginLeft:6,fontSize:9,opacity:.6}}>{playlists.videos.length}</span>}
          </button>
        ))}
      </div>
      {tab==="mensajes"&&<MensajesTab user={user} messages={messages} onSend={onSend}/>}
      {tab==="videos"&&<VideosTab videos={playlists.videos||[]} loading={loading} error={errors.videos}/>}
    </div>
  );
}
