import { useState, useCallback } from "react";
import { useAuth } from "../../hooks/useAuth";

// ─── Sección "Contraseña" del perfil ──────────────────────────────────────────
//
// Cambio de contraseña con la sesión ya iniciada. Pide la actual porque el
// celular puede quedar abierto sobre la mesa del bar: sin ese paso, cualquiera
// que lo agarre se queda con la cuenta.

export default function ChangePasswordCard() {
  const { changePassword } = useAuth();

  const [open,     setOpen]     = useState(false);
  const [current,  setCurrent]  = useState("");
  const [pass,     setPass]     = useState("");
  const [passConf, setPassConf] = useState("");
  const [show,     setShow]     = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");
  const [done,     setDone]     = useState(false);

  const canSave = current.length > 0 && pass.length >= 6 && pass === passConf;

  const reset = useCallback(() => {
    setCurrent(""); setPass(""); setPassConf(""); setError(""); setShow(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!canSave || saving) return;
    setSaving(true); setError("");
    try {
      const result = await changePassword(current, pass);
      if (result?.ok) { reset(); setDone(true); setOpen(false); }
      else setError(result?.error || "No se pudo cambiar la contraseña.");
    } catch (e) {
      setError(e?.message || "No se pudo cambiar la contraseña.");
    } finally {
      setSaving(false);
    }
  }, [canSave, saving, changePassword, current, pass, reset]);

  return (
    <div className="card">
      <div className="card-title">🔑 Contraseña</div>

      {done && !open && (
        <div style={{ display:"flex", gap:8, alignItems:"center", padding:"9px 12px",
          marginBottom:8, background:"rgba(34,197,94,.1)",
          border:"1px solid rgba(34,197,94,.28)", borderRadius:10 }}>
          <span style={{ fontSize:15 }}>✅</span>
          <span style={{ fontSize:11.5, color:"#86EFAC" }}>
            Contraseña actualizada. Usala la próxima vez que entres.
          </span>
        </div>
      )}

      {!open ? (
        <>
          <div style={{ fontSize:11, color:"rgba(245,230,192,.35)", marginBottom:10, lineHeight:1.5 }}>
            Cambiala cuando quieras. Necesitás saber la actual.
          </div>
          <button className="btn-ghost" style={{ width:"100%" }}
            onClick={() => { setDone(false); setOpen(true); }}>
            Cambiar mi contraseña
          </button>
        </>
      ) : (
        <>
          <input className="input-field" type={show ? "text" : "password"}
            placeholder="Contraseña actual" autoComplete="current-password"
            value={current} onChange={(e) => { setCurrent(e.target.value); setError(""); }}/>
          <input className="input-field" type={show ? "text" : "password"}
            placeholder="Contraseña nueva (mín. 6)" autoComplete="new-password"
            value={pass} onChange={(e) => { setPass(e.target.value); setError(""); }}/>
          <input className="input-field" type={show ? "text" : "password"}
            placeholder="Repetí la contraseña nueva" autoComplete="new-password"
            value={passConf} onChange={(e) => { setPassConf(e.target.value); setError(""); }}/>

          <label style={{ display:"flex", alignItems:"center", gap:8, marginTop:2, marginBottom:8,
            fontSize:11, color:"rgba(245,230,192,.45)", cursor:"pointer" }}>
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)}/>
            Mostrar contraseñas
          </label>

          {passConf && pass !== passConf && (
            <div style={{ fontSize:10.5, color:"rgba(239,68,68,.8)", marginTop:-4, marginBottom:8 }}>
              Las contraseñas nuevas no coinciden.
            </div>
          )}
          {error && (
            <div style={{ fontSize:11, color:"#FCA5A5", marginBottom:8, lineHeight:1.5 }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{ display:"flex", gap:8 }}>
            <button className="btn-ghost" style={{ flex:"0 0 auto" }} disabled={saving}
              onClick={() => { reset(); setOpen(false); }}>
              Cancelar
            </button>
            <button className="btn-primary" style={{ flex:1, opacity:(!canSave || saving) ? .4 : 1 }}
              disabled={!canSave || saving} onClick={handleSave}>
              {saving ? "Guardando…" : "✓ Guardar"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
