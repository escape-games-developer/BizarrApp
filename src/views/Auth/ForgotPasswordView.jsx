import { useState, useCallback } from "react";
import { useAuth } from "../../hooks/useAuth";

// ─── Olvidé mi contraseña ─────────────────────────────────────────────────────
//
// Dispara el mail de recuperación. El link de ese mail vuelve a
// /auth/callback?next=reset, donde el cliente escribe la contraseña nueva.

export default function ForgotPasswordView({ onBack, initialEmail = "" }) {
  const { requestPasswordReset } = useAuth();

  const [email,   setEmail]   = useState(initialEmail);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = useCallback(async () => {
    if (loading) return;
    setError(""); setLoading(true);
    try {
      const result = await requestPasswordReset(email);
      if (result?.ok) setSent(true);
      else setError(result?.error || "No pudimos enviar el mail. Probá de nuevo.");
    } catch (e) {
      setError(e?.message || "No pudimos enviar el mail. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [email, loading, requestPasswordReset]);

  if (sent) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", minHeight:"60vh", padding:"0 4px", textAlign:"center" }}>
      <div style={{ fontSize:44, marginBottom:14 }}>📬</div>
      <div style={{ fontFamily:"Syne,sans-serif", fontWeight:900, fontSize:21,
        color:"#FFD700", marginBottom:10 }}>
        Revisá tu mail
      </div>
      <div style={{ fontSize:12.5, color:"rgba(245,230,192,.5)", lineHeight:1.7,
        maxWidth:290, marginBottom:8 }}>
        Si <strong style={{ color:"rgba(245,230,192,.8)" }}>{email.toLowerCase().trim()}</strong> tiene
        una cuenta en BizarrApp, te mandamos un link para elegir una contraseña nueva.
      </div>
      <div style={{ fontSize:11, color:"rgba(245,230,192,.3)", lineHeight:1.6,
        maxWidth:280, marginBottom:22 }}>
        El link vence en 1 hora. Si no lo ves, mirá en Spam o Promociones.
      </div>
      <button className="btn-primary" onClick={onBack}>Volver a iniciar sesión</button>
      <button onClick={() => setSent(false)} style={{ background:"none", border:"none",
        color:"rgba(255,215,0,.45)", fontSize:12, cursor:"pointer", marginTop:16,
        textDecoration:"underline" }}>
        Usar otro email
      </button>
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", minHeight:"60vh", padding:"0 4px" }}>
      <div style={{ fontSize:40, marginBottom:12 }}>🤔</div>
      <div style={{ fontFamily:"Syne,sans-serif", fontWeight:900, fontSize:21,
        color:"#FFD700", marginBottom:6, textAlign:"center" }}>
        ¿Te olvidaste la contraseña?
      </div>
      <div style={{ fontSize:12, color:"rgba(245,230,192,.42)", marginBottom:20,
        textAlign:"center", lineHeight:1.6, maxWidth:280 }}>
        Poné tu email y te mandamos un link para crear una nueva.
      </div>

      <input className="input-field" type="email" placeholder="Tu email"
        value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }}
        inputMode="email" autoCapitalize="none" autoComplete="email"/>

      {error && (
        <div style={{ fontSize:11, color:"#FCA5A5", marginBottom:8, textAlign:"center" }}>
          {error}
        </div>
      )}

      <button className="btn-primary" style={{ marginTop:4,
        opacity:(!email.includes("@") || loading) ? .4 : 1 }}
        disabled={!email.includes("@") || loading} onClick={handleSend}>
        {loading ? "Enviando…" : "📨 Enviarme el link"}
      </button>

      <button onClick={onBack} style={{ background:"none", border:"none",
        color:"rgba(255,215,0,.45)", fontSize:12, cursor:"pointer", marginTop:16,
        textDecoration:"underline" }}>
        ← Volver a iniciar sesión
      </button>
    </div>
  );
}
