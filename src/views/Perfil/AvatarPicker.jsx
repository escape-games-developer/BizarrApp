import { useRef, useCallback } from "react";
import { PRESET_AVATARS } from "../../constants/theme";

// ─── Selector de avatar ───────────────────────────────────────────────────────
//
// Preset o foto propia. Lo usan el paso 1 del registro y la edición del perfil:
// el estado vive en quien lo monta, acá sólo se dibuja y se lee el archivo.
//
// `compact`: los presets en una tira horizontal y la foto más baja, para que la
// edición del perfil entre en la pantalla sin scroll vertical.

export default function AvatarPicker({ avatarSrc, setAvatarSrc, selAv, setSelAv, photoUrl, onPhoto, compact = false }) {
  const fileRef = useRef(null);

  const handleFile = useCallback((e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => onPhoto(ev.target.result);
    r.readAsDataURL(f);
  }, [onPhoto]);

  return (
    <>
      <div style={{ display:"flex",gap:6,marginBottom:compact?8:12 }}>
        {[{id:"preset",label:"😀 Elegir"},{id:"photo",label:"📷 Foto propia"}].map((t)=>(
          <button key={t.id} onClick={()=>setAvatarSrc(t.id)} style={{
            flex:1,padding:compact?"6px":"8px",borderRadius:9,border:"1px solid",cursor:"pointer",
            fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:700,
            background: avatarSrc===t.id?"rgba(255,215,0,.12)":"rgba(255,255,255,.03)",
            borderColor:avatarSrc===t.id?"rgba(255,215,0,.35)":"rgba(255,255,255,.08)",
            color:      avatarSrc===t.id?"#FFD700":"rgba(245,230,192,.4)",
          }}>{t.label}</button>
        ))}
      </div>
      {avatarSrc==="preset" && (
        <div style={compact
          ? { display:"flex",gap:8,overflowX:"auto",padding:"3px 2px 6px",scrollbarWidth:"thin" }
          : { display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8 }}>
          {PRESET_AVATARS.map((av)=>(
            <div key={av.id}
              onClick={()=>setSelAv(av.id)}
              style={{
                ...(compact ? { width:44,height:44,flexShrink:0,fontSize:20 } : { aspectRatio:"1" }),
                borderRadius:12,display:"flex",alignItems:"center",
                justifyContent:"center",fontSize:22,cursor:"pointer",transition:"all .18s",
                background:`linear-gradient(135deg,${av.bg[0]},${av.bg[1]})`,
                border:`2px solid ${selAv===av.id?"#FFD700":"transparent"}`,
                transform:selAv===av.id?"scale(1.08)":"scale(1)",
              }}>
              {av.emoji}
            </div>
          ))}
        </div>
      )}
      {avatarSrc==="photo" && (
        <>
          <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleFile}/>
          <div onClick={()=>fileRef.current?.click()} style={{
            height:compact?56:100,borderRadius:12,border:"2px dashed rgba(255,215,0,.2)",
            display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
            cursor:"pointer",overflow:"hidden",
          }}>
            {photoUrl
              ? <img src={photoUrl} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }}/>
              : <>
                  <div style={{ fontSize:28,marginBottom:6 }}>📷</div>
                  <div style={{ fontSize:11,color:"rgba(255,215,0,.4)" }}>Seleccionar foto</div>
                </>
            }
          </div>
        </>
      )}
    </>
  );
}
