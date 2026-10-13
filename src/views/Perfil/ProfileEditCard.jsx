import { useState, useCallback } from "react";
import { AvatarDisplay } from "../../components/AvatarDisplay";
import { PRESET_AVATARS, TEAMS } from "../../constants/theme";
import AvatarPicker from "./AvatarPicker";

// ─── Editar perfil en el lugar ────────────────────────────────────────────────
//
// Para quien ya tiene cuenta: los datos se editan acá mismo, sin volver a los
// pasos del registro. `onSave` es la acción `saveProfile` del controlador y
// devuelve { ok, error }.
//
// El email queda de sólo lectura: cambiarlo pasa por Supabase Auth y exige
// confirmar la casilla nueva por mail, así que no es un dato más del perfil.
//
// Ocupa el alto que le da el Perfil (sin scroll): el formulario se reparte en
// el espacio y Cancelar / Guardar quedan fijos abajo.

const LABEL = { fontSize:11,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",
  color:"rgba(255,215,0,.55)",marginBottom:5 };

export default function ProfileEditCard({ user, onSave, onCancel, onSaved, compact = false }) {
  const [name,      setName]      = useState(user.name || "");
  const [avatarSrc, setAvatarSrc] = useState(user.photoUrl ? "photo" : "preset");
  const [selAv,     setSelAv]     = useState(user.avatarId || null);
  const [photoUrl,  setPhotoUrl]  = useState(user.photoUrl || null);
  const [team,      setTeam]      = useState(user.team || null);
  const [phone,     setPhone]     = useState(user.phone || "");
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");

  const selAvData   = PRESET_AVATARS.find((a) => a.id === selAv);
  const usePhoto    = avatarSrc === "photo" && !!photoUrl;
  const previewUser = usePhoto
    ? { photoUrl, name }
    : selAv ? { avatarId:selAv, avatarEmoji:selAvData?.emoji, name } : { name };

  const phoneDigits = phone.replace(/\D/g, "");
  const missing = [
    !name.trim()               && "tu nombre",
    !(usePhoto || selAv)       && "un avatar",
    !team                      && "un equipo",
    phoneDigits.length < 8     && "el teléfono (mín. 8 dígitos)",
  ].filter(Boolean);
  const canSave = missing.length === 0;

  const handleSave = useCallback(async () => {
    if (!canSave || saving) return;
    setSaving(true); setError("");
    try {
      const result = await onSave({
        name:  name.trim(),
        ...(usePhoto
          ? { photoUrl, avatarId:null, avatarEmoji:null }
          : { avatarId:selAv, avatarEmoji:selAvData?.emoji || null, photoUrl:null }),
        team,
        phone: phoneDigits,
      });
      if (result?.ok === false) setError(result.error || "No se pudieron guardar los cambios.");
      else onSaved?.();
    } catch (e) {
      setError(e?.message || "No se pudieron guardar los cambios.");
    } finally {
      setSaving(false);
    }
  }, [canSave, saving, onSave, name, usePhoto, photoUrl, selAv, selAvData, team, phoneDigits, onSaved]);

  const gap   = compact ? 10 : 14;
  const input = { marginBottom:0, padding:compact ? "9px 12px" : "11px 14px" };

  return (
    <div style={{ flex:1,minHeight:0,display:"flex",flexDirection:"column" }}>
      <div style={{ flex:1,minHeight:0,overflowY:"auto",display:"flex",flexDirection:"column",gap }}>
        {/* Nombre, con el avatar elegido al lado */}
        <div style={{ display:"flex",alignItems:"center",gap:12 }}>
          <AvatarDisplay user={previewUser} size={compact ? 44 : 56} fontSize={compact ? 20 : 26}/>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ ...LABEL,display:"flex",justifyContent:"space-between" }}>
              <span>Nombre o seudónimo</span>
              <span style={{ color:"rgba(245,230,192,.25)",letterSpacing:0 }}>{name.length}/24</span>
            </div>
            <input className="input-field" style={input} placeholder="¿Cómo querés que te vean?"
              value={name} onChange={(e)=>{ setName(e.target.value.slice(0,24)); setError(""); }} maxLength={24}/>
          </div>
        </div>

        <div>
          <div style={LABEL}>Avatar</div>
          <AvatarPicker compact avatarSrc={avatarSrc} setAvatarSrc={setAvatarSrc}
            selAv={selAv} setSelAv={setSelAv} photoUrl={photoUrl} onPhoto={setPhotoUrl}/>
        </div>

        <div>
          <div style={LABEL}>Equipo</div>
          <div style={{ display:"flex",gap:8 }}>
            {Object.values(TEAMS).map((t)=>(
              <button key={t.id} onClick={()=>{ setTeam(t.id); setError(""); }} style={{
                flex:1,padding:compact ? "7px 6px" : "10px 6px",borderRadius:12,border:"2px solid",cursor:"pointer",
                borderColor:team===t.id?t.color:t.border,
                background:team===t.id?t.bg:"rgba(255,255,255,.03)",
                display:"flex",alignItems:"center",justifyContent:"center",gap:6,
              }}>
                <span style={{ fontSize:compact ? 17 : 20 }}>{t.emoji}</span>
                <span style={{ fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:13.5,color:t.color }}>
                  {t.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={LABEL}>Teléfono</div>
          <input className="input-field" style={input} type="tel" inputMode="tel" placeholder="Ej: 1123456789"
            value={phone} onChange={(e)=>{ setPhone(e.target.value); setError(""); }}/>
        </div>

        <div style={{ fontSize:12.5,color:"rgba(245,230,192,.4)",lineHeight:1.4 }}>
          📧 <span style={{ color:"rgba(245,230,192,.7)",wordBreak:"break-all" }}>{user.email}</span>
          <span style={{ color:"rgba(245,230,192,.28)" }}> · tu usuario para entrar, no se puede cambiar.</span>
        </div>
      </div>

      <div style={{ flexShrink:0,paddingTop:gap }}>
        {(error || !canSave) && (
          <div style={{ fontSize:12.5,lineHeight:1.4,marginBottom:8,textAlign:"center",
            color:error ? "#FCA5A5" : "rgba(245,230,192,.5)" }}>
            {error ? `⚠️ ${error}` : `Falta completar: ${missing.join(" · ")}`}
          </div>
        )}
        <div style={{ display:"flex",gap:8 }}>
          <button className="btn-ghost" style={{ flex:"0 0 auto" }} onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
          <button className="btn-primary" style={{ flex:1, padding:compact ? 11 : 13, opacity:(!canSave||saving)?.4:1 }}
            disabled={!canSave||saving} onClick={handleSave}>
            {saving ? "Guardando…" : "✓ Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
