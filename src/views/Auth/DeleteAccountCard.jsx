import { useState, useCallback } from "react";

// ─── Eliminar mi cuenta ───────────────────────────────────────────────────────
//
// Se abre desde el menú ⋮ del Perfil. Es irreversible, así que pide la
// contraseña (el celular puede quedar abierto sobre la mesa) y deja claro qué
// se pierde antes de habilitar el botón.
//
// `deleteAccount` es el de la instancia de `useAuth()` de App. Si sale bien,
// useAuth ya cerró la sesión y la app vuelve sola al login: esta tarjeta no
// tiene que hacer nada más.

export default function DeleteAccountCard({ deleteAccount, onCancel }) {
  const [password, setPassword] = useState("");
  const [show,     setShow]     = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");

  const canDelete = password.length > 0;

  const handleDelete = useCallback(async () => {
    if (!canDelete || saving) return;
    setSaving(true); setError("");
    try {
      const result = await deleteAccount(password);
      if (!result?.ok) setError(result?.error || "No se pudo eliminar la cuenta.");
    } catch (e) {
      setError(e?.message || "No se pudo eliminar la cuenta.");
    } finally {
      setSaving(false);
    }
  }, [canDelete, saving, deleteAccount, password]);

  return (
    <div className="card" style={{ border:"1px solid rgba(239,68,68,.35)", background:"rgba(239,68,68,.06)" }}>
      <div className="card-title" style={{ color:"#FCA5A5" }}>🗑️ Eliminar mi cuenta</div>

      <div style={{ fontSize:13, color:"rgba(245,230,192,.75)", lineHeight:1.55, marginBottom:8 }}>
        Se borran tu perfil, tus mensajes, votos, cupones y pedidos de video.
      </div>
      <div style={{ fontSize:13, fontWeight:700, color:"#FCA5A5", lineHeight:1.5, marginBottom:12 }}>
        No se puede deshacer.
      </div>

      <input className="input-field" type={show ? "text" : "password"}
        placeholder="Tu contraseña, para confirmar" autoComplete="current-password"
        value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }}/>

      <label style={{ display:"flex", alignItems:"center", gap:8, marginTop:2, marginBottom:10,
        fontSize:12, color:"rgba(245,230,192,.5)", cursor:"pointer" }}>
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)}/>
        Mostrar contraseña
      </label>

      {error && (
        <div style={{ fontSize:12, color:"#FCA5A5", marginBottom:10, lineHeight:1.5 }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ display:"flex", gap:8 }}>
        <button className="btn-ghost" style={{ flex:"0 0 auto" }} disabled={saving} onClick={onCancel}>
          Cancelar
        </button>
        <button disabled={!canDelete || saving} onClick={handleDelete} style={{
          flex:1, padding:12, borderRadius:12, cursor:(!canDelete || saving) ? "default" : "pointer",
          background:"#DC2626", border:"none", color:"#fff",
          fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:14,
          opacity:(!canDelete || saving) ? .4 : 1 }}>
          {saving ? "Eliminando…" : "Eliminar definitivamente"}
        </button>
      </div>
    </div>
  );
}
