import { useState, useRef, useCallback, useEffect } from "react";
import { AvatarDisplay }   from "../../components/AvatarDisplay";
import { StepBar }         from "../../components/UI";
import { PRESET_AVATARS, TEAMS, GEO_RADIUS } from "../../constants/theme";
import { useGeoGate }      from "../../hooks/useGeoGate";
import { useAuth }         from "../../hooks/useAuth";

const STEP_LABELS = ["Identidad","Equipo","¡A jugar!","Cuenta","¡Listo!"];

// ─── Login ────────────────────────────────────────────────────────────────────
export function LoginView({ onLogin, onGoRegister }) {
  const [email,   setEmail]   = useState("");
  const [pass,    setPass]    = useState("");
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = useCallback(() => {
    setError(""); setLoading(true);
    setTimeout(() => {
      const result = onLogin(email, pass);
      if (!result.ok) { setError(result.error); }
      setLoading(false);
    }, 800);
  }, [email, pass, onLogin]);

  return (
    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",
      justifyContent:"center",minHeight:"60vh",padding:"0 4px" }}>
      <div style={{ fontSize:40,marginBottom:12 }}>🔑</div>
      <div style={{ fontFamily:"Syne,sans-serif",fontWeight:900,fontSize:22,
        color:"#FFD700",marginBottom:4,textAlign:"center" }}>
        ¡Bienvenido de nuevo!
      </div>
      <div style={{ fontSize:12,color:"rgba(245,230,192,.4)",marginBottom:20,textAlign:"center" }}>
        Ingresá con tu cuenta BizarrApp
      </div>
      <input className="input-field" type="email" placeholder="Tu email"
        value={email} onChange={(e)=>{ setEmail(e.target.value); setError(""); }}
        inputMode="email" autoCapitalize="none"/>
      <input className="input-field" type="password" placeholder="Contraseña"
        value={pass}  onChange={(e)=>{ setPass(e.target.value); setError(""); }}/>
      {error && (
        <div style={{ fontSize:11,color:"#FCA5A5",marginBottom:8,textAlign:"center" }}>
          {error}
        </div>
      )}
      <button className="btn-primary" style={{ marginTop:4, opacity:(!email||!pass||loading)?.4:1 }}
        disabled={!email||!pass||loading} onClick={handleLogin}>
        {loading ? "Verificando..." : "Entrar"}
      </button>
      <button onClick={onGoRegister} style={{ background:"none",border:"none",
        color:"rgba(255,215,0,.45)",fontSize:12,cursor:"pointer",marginTop:16,textDecoration:"underline" }}>
        ¿Primera vez? Registrate acá
      </button>
    </div>
  );
}

// ─── Registro en 5 pasos ──────────────────────────────────────────────────────
export default function ProfileView({ user, onSave, onRegister, regStep, setRegStep }) {
  const step    = regStep;
  const setStep = setRegStep;

  // Form state
  const [name,      setName]      = useState(user?.name||"");
  const [avatarSrc, setAvatarSrc] = useState("preset");
  const [selAv,     setSelAv]     = useState(user?.avatarId||null);
  const [photoUrl,  setPhotoUrl]  = useState(user?.photoUrl||null);
  const [team,      setTeam]      = useState(user?.team||null);
  const [email,     setEmail]     = useState(user?.email||"");
  const [phone,     setPhone]     = useState(user?.phone||"");
  const [pass,      setPass]      = useState("");
  const [passConf,  setPassConf]  = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [editing,   setEditing]   = useState(false);
  const fileRef = useRef();

  const { logout } = useAuth();

  // Geo
  const { geoState, distMeters, loading: geoLoading, retry: requestGeo } = useGeoGate();
  const geoOk = geoState === "ok";

  useEffect(() => {
    if (geoState === "ok" && !user?.geoOk) onSave({ geoOk: true });
  }, [geoState]);

  const selAvData   = PRESET_AVATARS.find((a) => a.id === selAv);
  const previewUser = avatarSrc==="photo"&&photoUrl
    ? { photoUrl, name }
    : selAv ? { avatarId:selAv, avatarEmoji:selAvData?.emoji, name } : { name };

  const handleFile = useCallback((e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => setPhotoUrl(ev.target.result);
    r.readAsDataURL(f);
  }, []);

  const canStep1 = name.trim().length > 0 && (selAv || (avatarSrc==="photo"&&photoUrl));
  const canStep4 = email.includes("@") && pass.length >= 6 && pass === passConf && phone.replace(/\D/g,"").length >= 8;

  const handleSave = useCallback(() => {
    const profile = {
      name: name.trim(),
      ...(avatarSrc==="photo"&&photoUrl
        ? { photoUrl, avatarId:null, avatarEmoji:null }
        : { avatarId:selAv, avatarEmoji:selAvData?.emoji||null, photoUrl:null }),
      team, email:email.toLowerCase().trim(),
      phone:phone.replace(/\D/g,""), geoOk, registered:true,
    };
    const result = onRegister(profile, pass);
    if (result.ok) { setEmailSent(true); setEditing(false); setStep(5); }
  }, [name,avatarSrc,photoUrl,selAv,selAvData,team,email,phone,geoOk,pass,onRegister,setStep]);

  // Ya registrado → saltar a paso 5
  if (user?.registered && !editing && step === 1) { setStep(5); return null; }

  return (
    <div>
      <div className="sec-hdr"><span style={{ fontSize:20 }}>👤</span><h3>Mi Perfil</h3></div>
      <StepBar steps={STEP_LABELS} current={step}/>

      {/* ── PASO 1: Identidad ── */}
      {step===1 && (
        <>
          <div style={{ textAlign:"center",marginBottom:16 }}>
            <div style={{ display:"flex",justifyContent:"center",marginBottom:10 }}>
              <AvatarDisplay user={previewUser} size={72} fontSize={32}/>
            </div>
            <div style={{ fontFamily:"Syne,sans-serif",fontWeight:900,fontSize:20,color:"#FFD700" }}>
              {name||"Tu nombre"}
            </div>
            <div style={{ fontSize:11,color:"rgba(245,230,192,.35)",marginTop:4 }}>
              Así te verán en pantalla y en los mensajes
            </div>
          </div>
          <div className="card">
            <div className="card-title">Nombre o seudónimo</div>
            <input className="input-field" placeholder="¿Cómo querés que te vean?"
              value={name} onChange={(e)=>setName(e.target.value.slice(0,24))} maxLength={24}/>
            <div style={{ textAlign:"right",fontSize:10,color:"rgba(245,230,192,.25)",marginTop:-4,marginBottom:4 }}>
              {name.length}/24
            </div>
          </div>
          <div className="card">
            <div className="card-title">Tu avatar</div>
            <div style={{ display:"flex",gap:6,marginBottom:12 }}>
              {[{id:"preset",label:"😀 Elegir"},{id:"photo",label:"📷 Foto propia"}].map((t)=>(
                <button key={t.id} onClick={()=>setAvatarSrc(t.id)} style={{
                  flex:1,padding:"8px",borderRadius:9,border:"1px solid",cursor:"pointer",
                  fontFamily:"Syne,sans-serif",fontSize:12,fontWeight:700,
                  background: avatarSrc===t.id?"rgba(255,215,0,.12)":"rgba(255,255,255,.03)",
                  borderColor:avatarSrc===t.id?"rgba(255,215,0,.35)":"rgba(255,255,255,.08)",
                  color:      avatarSrc===t.id?"#FFD700":"rgba(245,230,192,.4)",
                }}>{t.label}</button>
              ))}
            </div>
            {avatarSrc==="preset" && (
              <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8 }}>
                {PRESET_AVATARS.map((av)=>(
                  <div key={av.id}
                    onClick={()=>setSelAv(av.id)}
                    style={{
                      aspectRatio:"1",borderRadius:12,display:"flex",alignItems:"center",
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
                <div onClick={()=>fileRef.current.click()} style={{
                  height:100,borderRadius:12,border:"2px dashed rgba(255,215,0,.2)",
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
          </div>
          <button className="btn-primary" disabled={!canStep1} onClick={()=>setStep(2)}>
            Siguiente →
          </button>
        </>
      )}

      {/* ── PASO 2: Equipo ── */}
      {step===2 && (
        <>
          <div style={{ textAlign:"center",marginBottom:18 }}>
            <div style={{ fontSize:36,marginBottom:8 }}>⚔️</div>
            <div style={{ fontFamily:"Syne,sans-serif",fontWeight:900,fontSize:22,color:"#FFD700",marginBottom:6 }}>
              Elegí tu equipo
            </div>
            <div style={{ fontSize:12,color:"rgba(245,230,192,.45)",lineHeight:1.6,maxWidth:260,margin:"0 auto" }}>
              Vas a competir con este equipo en el Desafío Demente y en todos los juegos de la noche.
            </div>
          </div>
          <div style={{ display:"flex",gap:10,marginBottom:18 }}>
            {Object.values(TEAMS).map((t)=>(
              <button key={t.id} onClick={()=>setTeam(t.id)} style={{
                flex:1,padding:"20px 8px",borderRadius:18,border:"2px solid",
                borderColor:team===t.id?t.color:t.border,
                background:team===t.id?t.bg:"rgba(255,255,255,.03)",
                cursor:"pointer",transition:"all .22s",
                transform:team===t.id?"scale(1.05)":"scale(1)",
              }}>
                <div style={{ fontSize:48,marginBottom:8 }}>{t.emoji}</div>
                <div style={{ fontFamily:"Syne,sans-serif",fontWeight:900,fontSize:16,color:t.color }}>
                  {t.name}
                </div>
                {team===t.id && (
                  <div style={{ marginTop:6,fontSize:11,color:t.color,fontWeight:700 }}>✓ Seleccionado</div>
                )}
              </button>
            ))}
          </div>
          <div style={{ display:"flex",gap:8 }}>
            <button className="btn-ghost" style={{ flex:"0 0 auto" }} onClick={()=>setStep(1)}>← Volver</button>
            <button className="btn-primary" style={{ flex:1 }} disabled={!team} onClick={()=>setStep(3)}>
              Siguiente →
            </button>
          </div>
        </>
      )}

      {/* ── PASO 3: Claim ── */}
      {step===3 && (
        <>
          <div style={{ textAlign:"center",marginBottom:20,padding:"0 4px" }}>
            {team && (
              <div style={{ display:"inline-flex",alignItems:"center",gap:8,padding:"6px 16px",
                borderRadius:20,marginBottom:16,
                background:TEAMS[team].bg,border:`1px solid ${TEAMS[team].border}` }}>
                <span style={{ fontSize:20 }}>{TEAMS[team].emoji}</span>
                <span style={{ fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:13,color:TEAMS[team].color }}>
                  {TEAMS[team].name}
                </span>
              </div>
            )}
            <div style={{ fontSize:36,marginBottom:12 }}>🎮🎰🧠</div>
            <div style={{ fontFamily:"Syne,sans-serif",fontWeight:900,fontSize:20,color:"#FFD700",
              marginBottom:10,lineHeight:1.2 }}>
              ¿Querés participar en los juegos, sorteos y el Desafío Demente?
            </div>
            <div style={{ fontSize:13,color:"rgba(245,230,192,.55)",lineHeight:1.7,marginBottom:18 }}>
              Completá tu registro y participás en el{" "}
              <strong style={{ color:"#FFD700" }}>Rey del Orto</strong>,{" "}
              el <strong style={{ color:"#A855F7" }}>Desafío Demente</strong>,{" "}
              el escenario y mucho más.
            </div>
            {[
              {icon:"🎰",text:"Rey del Orto — tu pantalla puede quedar en verde"},
              {icon:"🧠",text:"Desafío Demente — trivia Team Batata vs Membrillo"},
              {icon:"💃",text:"Subí al escenario como protagonista de la noche"},
              {icon:"📢",text:"Mandá mensajes a la pantalla gigante del bar"},
              {icon:"🍺",text:"Ganá cupones de descuento en consumición"},
            ].map((item,i)=>(
              <div key={i} style={{ display:"flex",alignItems:"center",gap:10,padding:"9px 12px",
                marginBottom:6,background:"rgba(255,215,0,.05)",border:"1px solid rgba(255,215,0,.1)",
                borderRadius:10 }}>
                <span style={{ fontSize:18,flexShrink:0 }}>{item.icon}</span>
                <span style={{ fontSize:12,color:"rgba(245,230,192,.75)" }}>{item.text}</span>
              </div>
            ))}
          </div>
          <div style={{ display:"flex",gap:8,marginBottom:10 }}>
            <button className="btn-ghost" style={{ flex:"0 0 auto" }} onClick={()=>setStep(2)}>← Volver</button>
            <button className="btn-primary" style={{ flex:1,background:"linear-gradient(135deg,#A855F7,#EC4899)" }}
              onClick={()=>setStep(4)}>
              ¡Sí, me registro! →
            </button>
          </div>
          <button onClick={()=>{
            onSave({ name:name.trim(),avatarId:selAv,avatarEmoji:selAvData?.emoji||null,
              photoUrl:avatarSrc==="photo"?photoUrl:null,team,geoOk:false,registered:false });
            setStep(5);
          }} style={{ width:"100%",background:"none",border:"1px solid rgba(255,255,255,.08)",
            borderRadius:10,padding:"10px",color:"rgba(245,230,192,.28)",fontSize:11,cursor:"pointer" }}>
            Ahora no, solo quiero ver la carta
          </button>
        </>
      )}

      {/* ── PASO 4: Cuenta ── */}
      {step===4 && (
        <>
          <div style={{ textAlign:"center",marginBottom:16 }}>
            <div style={{ fontSize:28,marginBottom:6 }}>🔐</div>
            <div style={{ fontFamily:"Syne,sans-serif",fontWeight:900,fontSize:18,color:"#FFD700",marginBottom:6 }}>
              Creá tu cuenta BizarrApp
            </div>
            <div style={{ fontSize:12,color:"rgba(245,230,192,.45)",lineHeight:1.5 }}>
              La próxima vez que vengas te reconocemos al instante.
            </div>
          </div>
          <div className="card">
            <div className="card-title">📧 Email</div>
            <input className="input-field" type="email" placeholder="tu@email.com"
              value={email} onChange={(e)=>setEmail(e.target.value)} inputMode="email" autoCapitalize="none"/>
          </div>
          <div className="card">
            <div className="card-title">📱 Teléfono</div>
            <div style={{ fontSize:11,color:"rgba(245,230,192,.35)",marginBottom:8 }}>
              Para avisarte si ganás un premio.
            </div>
            <input className="input-field" type="tel" placeholder="+54 11 XXXX XXXX"
              value={phone} onChange={(e)=>setPhone(e.target.value.replace(/[^\d\s+\-()]/g,"").slice(0,18))}
              inputMode="tel"/>
          </div>
          <div className="card">
            <div className="card-title">🔑 Contraseña</div>
            <input className="input-field" type="password" placeholder="Mínimo 6 caracteres"
              value={pass} onChange={(e)=>setPass(e.target.value)}/>
            <input className="input-field" type="password" placeholder="Repetí la contraseña"
              value={passConf} onChange={(e)=>setPassConf(e.target.value)}/>
            {passConf && pass !== passConf && (
              <div style={{ fontSize:10,color:"rgba(239,68,68,.7)",marginTop:-4 }}>Las contraseñas no coinciden</div>
            )}
          </div>
          <div className="card">
            <div className="card-title">📍 Verificar ubicación</div>
            <div style={{ fontSize:11,color:"rgba(245,230,192,.38)",marginBottom:10,lineHeight:1.4 }}>
              Verificamos que estás dentro de Bizarren (hasta {GEO_RADIUS}m). Necesario para los juegos.
            </div>
            {geoState==="idle" && (
              <button className="btn-primary" style={{ padding:"10px" }} onClick={requestGeo}>
                📍 Verificar que estoy en el bar
              </button>
            )}
            {geoState==="checking" && (
              <div style={{ textAlign:"center",padding:"10px 0",color:"rgba(255,215,0,.5)",fontSize:12 }}>
                Verificando...
              </div>
            )}
            {geoState==="ok" && (
              <div style={{ display:"flex",alignItems:"center",gap:10,padding:"9px 12px",
                background:"rgba(34,197,94,.1)",border:"1px solid rgba(34,197,94,.3)",borderRadius:10 }}>
                <span style={{ fontSize:20 }}>✅</span>
                <div>
                  <div style={{ fontSize:12,fontWeight:700,color:"#86EFAC" }}>Estás en el bar</div>
                  <div style={{ fontSize:10,color:"rgba(245,230,192,.4)" }}>Acceso completo habilitado</div>
                </div>
              </div>
            )}
            {["far","denied","error","unavailable"].includes(geoState) && (
              <div style={{ padding:"9px 12px",background:"rgba(239,68,68,.1)",
                border:"1px solid rgba(239,68,68,.25)",borderRadius:10 }}>
                <div style={{ fontSize:11,fontWeight:700,color:"#FCA5A5",marginBottom:2 }}>
                  {geoState==="far" ? `Estás a ${distMeters}m del bar` :
                   geoState==="denied" ? "Permiso denegado" : "No se pudo verificar"}
                </div>
                <div style={{ fontSize:10,color:"rgba(245,230,192,.38)",marginBottom:7,lineHeight:1.4 }}>
                  {geoState==="denied" ? "Activá la ubicación en Ajustes del celular." : "Sin ubicación solo podés ver la carta."}
                </div>
                <button className="btn-primary" style={{ padding:"7px",fontSize:11 }}
                  onClick={requestGeo} disabled={geoLoading}>🔄 Reintentar</button>
              </div>
            )}
            {!geoOk && (
              <div style={{ marginTop:8,fontSize:10,color:"rgba(245,230,192,.25)",textAlign:"center" }}>
                Podés completar el registro sin ubicación y activarla cuando llegues al bar.
              </div>
            )}
          </div>
          <div style={{ display:"flex",gap:8 }}>
            <button className="btn-ghost" style={{ flex:"0 0 auto" }} onClick={()=>setStep(3)}>← Volver</button>
            <button className="btn-primary" style={{ flex:1 }} disabled={!canStep4} onClick={handleSave}>
              ✓ Crear mi cuenta
            </button>
          </div>
        </>
      )}

      {/* ── PASO 5: ¡Listo! ── */}
      {step===5 && user && (
        <>
          {emailSent && (
            <div style={{ display:"flex",gap:10,alignItems:"flex-start",padding:"12px 14px",
              background:"rgba(34,197,94,.1)",border:"1px solid rgba(34,197,94,.25)",
              borderRadius:12,marginBottom:16 }}>
              <span style={{ fontSize:20,flexShrink:0 }}>📧</span>
              <div>
                <div style={{ fontSize:12,fontWeight:700,color:"#86EFAC",marginBottom:2 }}>Email enviado</div>
                <div style={{ fontSize:11,color:"rgba(245,230,192,.55)",lineHeight:1.4 }}>
                  Te mandamos los datos de tu cuenta a <strong>{user.email}</strong>
                </div>
              </div>
            </div>
          )}
          <div style={{ textAlign:"center",marginBottom:18 }}>
            <div style={{ display:"flex",justifyContent:"center",marginBottom:12 }}>
              <AvatarDisplay user={user} size={80} fontSize={36}/>
            </div>
            <div style={{ fontFamily:"Syne,sans-serif",fontWeight:900,fontSize:22,color:"#FFD700" }}>
              ¡Hola, {user.name}!
            </div>
            {user.team && (
              <div style={{ display:"inline-flex",alignItems:"center",gap:8,marginTop:10,
                padding:"6px 16px",borderRadius:20,
                background:TEAMS[user.team].bg,border:`1px solid ${TEAMS[user.team].border}` }}>
                <span style={{ fontSize:18 }}>{TEAMS[user.team].emoji}</span>
                <span style={{ fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:13,color:TEAMS[user.team].color }}>
                  {TEAMS[user.team].name}
                </span>
              </div>
            )}
          </div>
          <div className="card">
            <div className="card-title">Tu cuenta BizarrApp</div>
            {[
              {icon:"👤",label:"Nombre",   val:user.name,                        ok:!!user.name},
              {icon:"🎭",label:"Avatar",   val:"Configurado",                    ok:!!(user.avatarId||user.photoUrl)},
              {icon:user.team?TEAMS[user.team].emoji:"❓",
                          label:"Equipo", val:user.team?TEAMS[user.team].name:"Sin elegir",ok:!!user.team},
              {icon:"📧",label:"Email",    val:user.email||"—",                  ok:!!user.email},
              {icon:"📱",label:"Teléfono", val:user.phone?"Registrado":"—",      ok:!!user.phone},
              {icon:"📍",label:"Ubicación",val:user.geoOk?"Verificada":"No verificada",ok:!!user.geoOk},
            ].map((row,i)=>(
              <div key={i} style={{ display:"flex",alignItems:"center",gap:8,padding:"8px 10px",
                borderRadius:9,marginBottom:5,
                background:row.ok?"rgba(34,197,94,.06)":"rgba(255,255,255,.03)",
                border:`1px solid ${row.ok?"rgba(34,197,94,.18)":"rgba(255,255,255,.06)"}` }}>
                <span style={{ fontSize:15 }}>{row.icon}</span>
                <span style={{ flex:1,fontSize:12,fontWeight:600,color:"rgba(245,230,192,.8)" }}>{row.label}</span>
                <span style={{ fontSize:11,color:row.ok?"#86EFAC":"rgba(245,230,192,.3)" }}>{row.val}</span>
                <span style={{ fontSize:12,color:row.ok?"#86EFAC":"rgba(245,230,192,.18)" }}>{row.ok?"✓":"○"}</span>
                {!row.ok && row.label==="Ubicación" && <button onClick={requestGeo} style={{background:"none",border:"none",cursor:"pointer",fontSize:14}}>📍</button>}
              </div>
            ))}
          </div>
          {!user.geoOk && user.registered && (
            <div style={{ padding:"10px 14px",background:"rgba(239,68,68,.08)",
              border:"1px solid rgba(239,68,68,.2)",borderRadius:10,
              fontSize:11,color:"rgba(245,230,192,.5)",lineHeight:1.5,marginBottom:12 }}>
              📍 Para activar los juegos verificá tu ubicación. Editá el perfil y habilitá la ubicación cuando estés en el bar.
            </div>
          )}
          <button className="btn-primary" onClick={()=>{ setEditing(true); setStep(1); }}>✏️ Editar perfil</button>
          <button
            onClick={logout}
            style={{ width:"100%", marginTop:10, padding:"12px", borderRadius:12,
              background:"rgba(255,45,120,.1)", border:"1px solid rgba(255,45,120,.3)",
              color:"#FF2D78", fontFamily:"Syne,sans-serif", fontWeight:800,
              fontSize:13, cursor:"pointer" }}>
            🚪 Cerrar sesión
          </button>
        </>
      )}
    </div>
  );
}
