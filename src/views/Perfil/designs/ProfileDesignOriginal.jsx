import { useState, useEffect } from "react";
import { AvatarDisplay }  from "../../../components/AvatarDisplay";
import { StepBar }        from "../../../components/UI";
import { useMediaQuery }  from "../../../hooks/useMediaQuery";
import ChangePasswordCard from "../../Auth/ChangePasswordCard";
import DeleteAccountCard  from "../../Auth/DeleteAccountCard";
import ProfileEditCard    from "../ProfileEditCard";
import { JORGE_PROFILE_SKIN } from "./profileSkins";

/**
 * Diseño de "Mi Perfil" — el paso 5 del Perfil del cliente. Con la piel por
 * defecto es el Diseño Jorge (la Vista Original); ProfileDesignCantoni lo
 * dibuja con la piel Cantoni. Ver profileSkins.js.
 *
 * Con cuenta creada y confirmada (`hasAccount`) el Perfil deja de ser un
 * registro: no muestra la barra de pasos y las acciones de la cuenta (editar,
 * cambiar contraseña, eliminar cuenta) viven en el menú ⋮, arriba a la
 * derecha. Sin cuenta —quien eligió "solo la carta"— sigue la barra y
 * "Editar perfil" abre el wizard, que es la forma de completar el registro.
 *
 * Entra en la pantalla sin scroll: ocupa el alto del área de contenido, el
 * cuerpo se reparte el espacio y "Cerrar sesión" queda fijo abajo. Según el
 * alto de la pantalla hay tres tamaños (ver SIZES).
 *
 * Sólo presentación: todo lo que necesita llega en `profile` (ver
 * useProfileController). No llamar acá a Supabase, Auth ni al GPS.
 */

// Medidas por alto de pantalla: normal (> 720 px), short (≤ 720), tiny (≤ 620).
const SIZES = {
  normal: { avatar:80, emoji:36, hello:24, badge:14, rowPad:"9px 12px", rowGap:5, label:14,   value:13,   gap:14, card:14 },
  short:  { avatar:64, emoji:30, hello:21, badge:13, rowPad:"7px 11px", rowGap:4, label:13.5, value:12.5, gap:10, card:11 },
  tiny:   { avatar:50, emoji:24, hello:19, badge:12, rowPad:"5px 10px", rowGap:3, label:13,   value:12,   gap:8,  card:9  },
};

// Menú ⋮. El fondo transparente a pantalla completa cierra el menú al tocar
// afuera.
function AccountMenu({ items, onClose, skin }) {
  return (
    <>
      <div onClick={onClose} style={{ position:"fixed",inset:0,zIndex:40 }}/>
      <div role="menu" style={{ position:"absolute",top:"100%",right:0,marginTop:4,zIndex:41,
        minWidth:210,padding:6,borderRadius:12,background:skin.surface,
        border:`1px solid ${skin.menuBorder}`,boxShadow:"0 10px 28px rgba(0,0,0,.55)" }}>
        {items.map((it)=>(
          <button key={it.id} role="menuitem" onClick={()=>{ onClose(); it.onSelect(); }} style={{
            display:"flex",alignItems:"center",gap:10,width:"100%",padding:"11px 12px",
            background:"none",border:"none",borderRadius:8,cursor:"pointer",textAlign:"left",
            fontFamily:skin.uiFont,fontSize:14,fontWeight:600,
            color:it.danger ? "#FCA5A5" : skin.muted(.85) }}>
            <span style={{ fontSize:16 }}>{it.icon}</span>{it.label}
          </button>
        ))}
      </div>
    </>
  );
}

// Aviso de una línea (cuenta nueva, cambios guardados, contraseña cambiada).
function Banner({ icon, children, s, skin }) {
  return (
    <div style={{ flexShrink:0,display:"flex",gap:8,alignItems:"center",
      padding:"8px 12px",marginBottom:s.gap,
      background:"rgba(34,197,94,.1)",border:"1px solid rgba(34,197,94,.28)",borderRadius:10 }}>
      <span style={{ fontSize:16,flexShrink:0 }}>{icon}</span>
      <span style={{ fontSize:13,color:skin.ok,lineHeight:1.35 }}>{children}</span>
    </div>
  );
}

// Título de los modos editar / contraseña / eliminar.
function ModeTitle({ children, skin }) {
  return (
    <div style={{ flexShrink:0,fontFamily:skin.titleFont,fontWeight:skin.titleWeight,fontSize:18,
      color:skin.accent,marginBottom:12 }}>
      {children}
    </div>
  );
}

export default function ProfileDesignOriginal({ profile, skin = JORGE_PROFILE_SKIN }) {
  const { user, team, emailSent, steps, currentStep, completion,
          canChangePassword, hasAccount, actions } = profile;
  const { requestGeo, startEdit, saveProfile, logout, changePassword, deleteAccount } = actions;
  const { muted, ok: OK_GREEN } = skin;

  const short = useMediaQuery("(max-height: 720px)");
  const tiny  = useMediaQuery("(max-height: 620px)");
  const s     = SIZES[tiny ? "tiny" : short ? "short" : "normal"];

  // view → datos · edit → formulario en el lugar · password · delete
  const [mode,     setMode]     = useState("view");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice,   setNotice]   = useState("");

  // El aviso de "guardado" se va solo: no tiene que quedar ocupando lugar.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const open = (m) => () => { setNotice(""); setMode(m); };
  const menuItems = [
    { id:"edit",     icon:"✏️", label:"Editar",             onSelect:open("edit") },
    canChangePassword &&
    { id:"password", icon:"🔑", label:"Cambiar contraseña", onSelect:open("password") },
    deleteAccount &&
    { id:"delete",   icon:"🗑️", label:"Eliminar cuenta",    onSelect:open("delete"), danger:true },
  ].filter(Boolean);

  return (
    <div style={{ height:"100%",minHeight:0,display:"flex",flexDirection:"column" }}>
      {!hasAccount && <div style={{ flexShrink:0 }}><StepBar steps={steps} current={currentStep}/></div>}

      {emailSent && mode === "view" && (
        <Banner icon="🎉" s={s} skin={skin}>
          ¡Cuenta activa! Bienvenido/a, <strong>{user.name}</strong>. ¡Ya podés jugar!
        </Banner>
      )}
      {notice && <Banner icon="✅" s={s} skin={skin}>{notice}</Banner>}

      {/* ── Cuerpo: se reparte el alto disponible ── */}
      {mode === "edit" ? (
        <>
          <ModeTitle skin={skin}>✏️ Editar perfil</ModeTitle>
          <ProfileEditCard user={user} onSave={saveProfile} compact={short}
            onCancel={()=>setMode("view")}
            onSaved={()=>{ setMode("view"); setNotice("Listo, guardamos tus cambios."); }}/>
        </>
      ) : mode === "password" ? (
        <div style={{ flex:1,minHeight:0,overflowY:"auto" }}>
          <ModeTitle skin={skin}>🔑 Cambiar contraseña</ModeTitle>
          <ChangePasswordCard changePassword={changePassword} startOpen
            onClose={(changed)=>{
              setMode("view");
              if (changed) setNotice("Contraseña actualizada. Usala la próxima vez que entres.");
            }}/>
        </div>
      ) : mode === "delete" ? (
        <div style={{ flex:1,minHeight:0,overflowY:"auto" }}>
          <DeleteAccountCard deleteAccount={deleteAccount} onCancel={()=>setMode("view")}/>
        </div>
      ) : (
        <div style={{ flex:1,minHeight:0,overflowY:"auto",display:"flex",flexDirection:"column",gap:s.gap }}>
          {/* Identidad: avatar, saludo y equipo, centrados — con el ⋮ arriba a la derecha */}
          <div style={{ position:"relative",textAlign:"center",flexShrink:0 }}>
            {hasAccount && (
              <div style={{ position:"absolute",top:0,right:0,zIndex:2 }}>
                <button aria-label="Opciones de la cuenta" aria-haspopup="menu" aria-expanded={menuOpen}
                  onClick={()=>setMenuOpen((o)=>!o)} style={{
                    width:38,height:38,borderRadius:10,cursor:"pointer",
                    background:menuOpen ? skin.kebab.bgOn : skin.kebab.bg,
                    border:`1px solid ${skin.kebab.border}`,color:skin.accent,
                    fontSize:22,lineHeight:1,display:"flex",alignItems:"center",justifyContent:"center" }}>
                  ⋮
                </button>
                {menuOpen && <AccountMenu items={menuItems} onClose={()=>setMenuOpen(false)} skin={skin}/>}
              </div>
            )}
            <div style={{ display:"flex",justifyContent:"center",marginBottom:s.gap }}>
              <AvatarDisplay user={user} size={s.avatar} fontSize={s.emoji}/>
            </div>
            <div style={{ fontFamily:skin.titleFont,fontWeight:skin.titleWeight,fontSize:s.hello,color:skin.accent,
              padding:"0 44px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
              ¡Hola, {user.name}!
            </div>
            {user.team && (
              <div style={{ display:"inline-flex",alignItems:"center",gap:8,marginTop:s.gap - 2,
                padding:"5px 16px",borderRadius:20,
                background:team.bg,border:`1px solid ${team.border}` }}>
                <span style={{ fontSize:s.badge + 4 }}>{team.emoji}</span>
                <span style={{ fontFamily:skin.uiFont,fontWeight:700,fontSize:s.badge,color:team.color }}>
                  {team.name}
                </span>
              </div>
            )}
          </div>

          {/* Datos de la cuenta, en listado */}
          <div style={{ padding:s.card,borderRadius:13,
            background:skin.surface,border:`1px solid ${skin.border}` }}>
            <div className="card-title" style={{ fontSize:11,marginBottom:s.rowGap + 4 }}>Tu cuenta BizarrApp</div>
            {completion.map((row)=>{
              const locate = !row.ok && row.id === "location";
              return (
                <div key={row.id} onClick={locate ? requestGeo : undefined}
                  role={locate ? "button" : undefined}
                  style={{ display:"flex",alignItems:"center",gap:8,padding:s.rowPad,
                    borderRadius:9,marginBottom:s.rowGap,cursor:locate ? "pointer" : "default",
                    background:locate ? "rgba(239,68,68,.08)" : row.ok ? "rgba(34,197,94,.06)" : "rgba(255,255,255,.03)",
                    border:`1px solid ${locate ? "rgba(239,68,68,.25)" : row.ok ? "rgba(34,197,94,.18)" : "rgba(255,255,255,.06)"}` }}>
                  <span style={{ fontSize:s.label + 2 }}>{row.icon}</span>
                  <span style={{ fontSize:s.label,fontWeight:600,color:muted(.85),flexShrink:0 }}>{row.label}</span>
                  <span style={{ flex:1,minWidth:0,textAlign:"right",overflow:"hidden",textOverflow:"ellipsis",
                    whiteSpace:"nowrap",fontSize:s.value,
                    color:locate ? "#FCA5A5" : row.ok ? OK_GREEN : muted(.35) }}>
                    {locate ? "Tocá para verificar" : row.val}
                  </span>
                  <span style={{ fontSize:s.value + 1,color:locate ? "#FCA5A5" : row.ok ? OK_GREEN : muted(.2) }}>
                    {locate ? "📍" : row.ok ? "✓" : "○"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Pie: siempre visible ── */}
      {mode === "view" && (
        <div style={{ flexShrink:0,paddingTop:s.gap }}>
          {/* Sin cuenta, "Editar perfil" es la forma de completar el registro. */}
          {!hasAccount && (
            <button className="btn-primary" style={{ marginBottom:8 }} onClick={startEdit}>
              ✏️ Editar perfil
            </button>
          )}
          <button
            onClick={logout}
            style={{ width:"100%", padding:short ? "11px" : "13px", borderRadius:12,
              background:skin.logout.bg, border:`1px solid ${skin.logout.border}`,
              color:skin.logout.color, fontFamily:skin.uiFont, fontWeight:700,
              fontSize:14, cursor:"pointer" }}>
            🚪 Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
