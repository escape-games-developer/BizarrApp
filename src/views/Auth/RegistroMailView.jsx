import { useCallback, useState } from "react";

// ─── Registro «con mail primero» ──────────────────────────────────────────────
//
// Modalidad activable desde Admin → Ajustes → Registro de clientes. El cliente
// pone sólo el mail; el link del mail vuelve a /auth/callback?next=registro y
// de ahí al formulario de registro con el mail fijo (ver useAuth:
// requestEmailSignup / completeEmailSignup).

const MAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const centrado = { display:"flex", flexDirection:"column", alignItems:"center",
  justifyContent:"center", minHeight:"60vh", padding:"0 4px", textAlign:"center" };
const titulo = { fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:22, color:"#FFD700", marginBottom:6 };
const sub = { fontSize:12.5, color:"rgba(245,230,192,.5)", lineHeight:1.6, maxWidth:290, marginBottom:20 };
const enlace = { background:"none", border:"none", color:"rgba(255,215,0,.5)", fontSize:12,
  cursor:"pointer", marginTop:14, textDecoration:"underline" };

export function RegistroMailView({ onSolicitar, onVolver }) {
  const [email,   setEmail]   = useState("");
  const [enviado, setEnviado] = useState(null);   // mail al que se mandó el link
  const [enviando, setEnviando] = useState(false);
  const [reenviado, setReenviado] = useState(false);
  const [error,   setError]   = useState("");

  const valido = MAIL_RE.test(email.trim());

  const enviar = useCallback(async (destino) => {
    setError(""); setEnviando(true);
    try {
      const r = await onSolicitar(destino);
      if (!r?.ok) { setError(r?.error || "No pudimos mandar el mail. Probá de nuevo."); return false; }
      setEnviado(destino);
      return true;
    } finally {
      setEnviando(false);
    }
  }, [onSolicitar]);

  if (enviado) return (
    <div style={centrado}>
      <div style={{ fontSize:48, marginBottom:14 }}>📬</div>
      <div style={titulo}>Revisá tu mail</div>
      <div style={sub}>
        Te mandamos un link a <strong style={{ color:"rgba(245,230,192,.85)" }}>{enviado}</strong>.
        Tocalo y seguís con el registro desde ahí.
      </div>
      <div style={{ fontSize:11, color:"rgba(245,230,192,.3)", lineHeight:1.6, maxWidth:280, marginBottom:20 }}>
        Si no lo ves, mirá en Spam o Promociones.
      </div>
      {error && <div style={{ fontSize:11, color:"#FCA5A5", marginBottom:10 }}>{error}</div>}
      {reenviado
        ? <div style={{ fontSize:11.5, color:"#86EFAC", marginBottom:14 }}>✅ Mail reenviado.</div>
        : <button className="btn-ghost" style={{ width:"100%", marginBottom:10 }} disabled={enviando}
            onClick={async () => { if (await enviar(enviado)) setReenviado(true); }}>
            {enviando ? "Enviando..." : "📨 Reenviarme el mail"}
          </button>}
      <button style={enlace} onClick={() => { setEnviado(null); setReenviado(false); setError(""); }}>
        ← Me equivoqué de email
      </button>
    </div>
  );

  return (
    <div style={centrado}>
      <div style={{ fontSize:40, marginBottom:12 }}>✉️</div>
      <div style={titulo}>Creá tu cuenta</div>
      <div style={sub}>Poné tu mail y te mandamos un link para validarlo. Después completás tus datos.</div>
      <input className="input-field" type="email" placeholder="tu@email.com" value={email}
        onChange={(e) => { setEmail(e.target.value); setError(""); }}
        onKeyDown={(e) => { if (e.key === "Enter" && valido && !enviando) enviar(email.trim().toLowerCase()); }}
        inputMode="email" autoCapitalize="none" autoComplete="email"/>
      {error && <div style={{ fontSize:11, color:"#FCA5A5", marginBottom:8, lineHeight:1.5 }}>{error}</div>}
      <button className="btn-primary" style={{ marginTop:4, opacity:(!valido || enviando) ? .4 : 1 }}
        disabled={!valido || enviando} onClick={() => enviar(email.trim().toLowerCase())}>
        {enviando ? "Enviando..." : "Enviarme el link"}
      </button>
      <button style={enlace} onClick={onVolver}>← Ya tengo cuenta</button>
    </div>
  );
}

/** Con las dos modalidades activas, el cliente elige cómo registrarse. */
export function ElegirRegistroView({ onMail, onCompleto, onVolver }) {
  const opcion = { width:"100%", textAlign:"left", padding:"14px 16px", borderRadius:14, marginBottom:10,
    background:"#000000", border:"1px solid rgba(255,215,0,.2)", color:"#F5E6C0", cursor:"pointer" };
  return (
    <div style={centrado}>
      <div style={{ fontSize:40, marginBottom:12 }}>🎉</div>
      <div style={titulo}>Creá tu cuenta</div>
      <div style={sub}>¿Cómo querés registrarte?</div>
      <button style={opcion} onClick={onMail}>
        <div style={{ fontWeight:700, fontSize:14, color:"#FFD700", marginBottom:3 }}>✉️ Empezar con mi mail</div>
        <div style={{ fontSize:11.5, color:"rgba(245,230,192,.55)", lineHeight:1.5 }}>
          Validás el mail primero y después completás tus datos.
        </div>
      </button>
      <button style={opcion} onClick={onCompleto}>
        <div style={{ fontWeight:700, fontSize:14, color:"#FFD700", marginBottom:3 }}>📝 Completar el formulario</div>
        <div style={{ fontSize:11.5, color:"rgba(245,230,192,.55)", lineHeight:1.5 }}>
          Cargás todo de una y al final confirmás el mail.
        </div>
      </button>
      <button style={enlace} onClick={onVolver}>← Ya tengo cuenta</button>
    </div>
  );
}
