import { AvatarDisplay }  from "../../../components/AvatarDisplay";
import { StepBar }        from "../../../components/UI";
import ChangePasswordCard from "../../Auth/ChangePasswordCard";

/**
 * Diseño Original (legacy) de "Mi Perfil" — el paso 5 tal como existía antes
 * de separar lógica y presentación. Se conserva sin cambios visuales como base
 * de comparación para los diseños nuevos.
 *
 * Sólo presentación: todo lo que necesita llega en `profile` (ver
 * useProfileController). No llamar acá a Supabase, Auth ni al GPS.
 */
export default function ProfileDesignOriginal({ profile }) {
  const { user, team, emailSent, steps, currentStep, completion,
          needsLocation, canChangePassword, actions } = profile;
  const { requestGeo, startEdit, logout, changePassword } = actions;

  return (
    <div>
      <div className="sec-hdr"><span style={{ fontSize:20 }}>👤</span><h3>Mi Perfil</h3></div>
      <StepBar steps={steps} current={currentStep}/>

      {/* ── PASO 5: ¡Listo! ── */}
      <>
        {emailSent && (
          <div style={{ display:"flex",gap:10,alignItems:"flex-start",padding:"12px 14px",
            background:"rgba(34,197,94,.1)",border:"1px solid rgba(34,197,94,.25)",
            borderRadius:12,marginBottom:16 }}>
            <span style={{ fontSize:20,flexShrink:0 }}>🎉</span>
            <div>
              <div style={{ fontSize:12,fontWeight:700,color:"#86EFAC",marginBottom:2 }}>¡Cuenta activa!</div>
              <div style={{ fontSize:11,color:"rgba(245,230,192,.55)",lineHeight:1.4 }}>
                ¡Bienvenido/a a BizarrApp, <strong>{user.name}</strong>! Tu cuenta quedó lista. ¡Ya podés jugar!
              </div>
            </div>
          </div>
        )}
        <div style={{ textAlign:"center",marginBottom:18 }}>
          <div style={{ display:"flex",justifyContent:"center",marginBottom:12 }}>
            <AvatarDisplay user={user} size={80} fontSize={36}/>
          </div>
          <div style={{ fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:22,color:"#FFD700" }}>
            ¡Hola, {user.name}!
          </div>
          {user.team && (
            <div style={{ display:"inline-flex",alignItems:"center",gap:8,marginTop:10,
              padding:"6px 16px",borderRadius:20,
              background:team.bg,border:`1px solid ${team.border}` }}>
              <span style={{ fontSize:18 }}>{team.emoji}</span>
              <span style={{ fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:13,color:team.color }}>
                {team.name}
              </span>
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-title">Tu cuenta BizarrApp</div>
          {completion.map((row,i)=>(
            <div key={i} style={{ display:"flex",alignItems:"center",gap:8,padding:"8px 10px",
              borderRadius:9,marginBottom:5,
              background:row.ok?"rgba(34,197,94,.06)":"rgba(255,255,255,.03)",
              border:`1px solid ${row.ok?"rgba(34,197,94,.18)":"rgba(255,255,255,.06)"}` }}>
              <span style={{ fontSize:15 }}>{row.icon}</span>
              <span style={{ flex:1,fontSize:12,fontWeight:600,color:"rgba(245,230,192,.8)" }}>{row.label}</span>
              <span style={{ fontSize:11,color:row.ok?"#86EFAC":"rgba(245,230,192,.3)" }}>{row.val}</span>
              <span style={{ fontSize:12,color:row.ok?"#86EFAC":"rgba(245,230,192,.18)" }}>{row.ok?"✓":"○"}</span>
              {!row.ok && row.id==="location" && <button onClick={requestGeo} style={{background:"none",border:"none",cursor:"pointer",fontSize:14}}>📍</button>}
            </div>
          ))}
        </div>
        {needsLocation && (
          <div style={{ padding:"10px 14px",background:"rgba(239,68,68,.08)",
            border:"1px solid rgba(239,68,68,.2)",borderRadius:10,
            fontSize:11,color:"rgba(245,230,192,.5)",lineHeight:1.5,marginBottom:12 }}>
            📍 Para activar los juegos verificá tu ubicación. Editá el perfil y habilitá la ubicación cuando estés en el bar.
          </div>
        )}
        {canChangePassword && <ChangePasswordCard changePassword={changePassword}/>}
        <button className="btn-primary" onClick={startEdit}>✏️ Editar perfil</button>
        <button
          onClick={logout}
          style={{ width:"100%", marginTop:10, padding:"12px", borderRadius:12,
            background:"rgba(255,45,120,.1)", border:"1px solid rgba(255,45,120,.3)",
            color:"#FF2D78", fontFamily:"'DM Sans',sans-serif", fontWeight:700,
            fontSize:13, cursor:"pointer" }}>
          🚪 Cerrar sesión
        </button>
      </>
    </div>
  );
}
