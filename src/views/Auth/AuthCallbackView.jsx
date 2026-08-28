import { useState, useEffect, useCallback, useRef } from "react";
import globalCss from "../../constants/styles";
import { supabase } from "../../lib/supabase";
import { hydrateProfile } from "../../hooks/useAuth";
import { appViewUrl, HOME_VIEW } from "../../lib/authRedirect";
import {
  readAuthParams, hasAuthPayload, isRecovery,
  consumeAuthCallback, clearAuthParamsFromUrl,
} from "../../lib/authCallback";

// ─── /auth/callback ───────────────────────────────────────────────────────────
//
// Única puerta de entrada de los dos mails de Supabase Auth:
//
//   Confirmar cuenta  → canjea la sesión, completa `profiles` y manda al
//                       cliente al menú Noti de la WebApp.
//   Recuperar contraseña → canjea la sesión y muestra el formulario de
//                       contraseña nueva (contraseña + repetir contraseña).
//
// Es una ruta propia y no un estado de la WebApp porque Supabase necesita una
// URL fija y absoluta para el `redirectTo` del mail.

const AuthShell = ({ children }) => (
  <>
    <style>{globalCss}</style>
    <div className="app-root">
      <div className="phone-shell">
        <header className="app-header">
          <div className="app-header-brand">
            <img src="/logo.png" alt="Bizarren" className="app-header-logo"
              onError={(e) => { e.target.style.display = "none"; }}/>
            <span className="app-header-name">BizarrApp</span>
          </div>
        </header>
        <main className="app-content">{children}</main>
      </div>
    </div>
  </>
);

const Centered = ({ children }) => (
  <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
    justifyContent:"center", minHeight:"70vh", padding:"0 4px", textAlign:"center" }}>
    {children}
  </div>
);

const Title = ({ children }) => (
  <div style={{ fontFamily:"Syne,sans-serif", fontWeight:900, fontSize:22,
    color:"#FFD700", marginBottom:8 }}>{children}</div>
);

const Sub = ({ children }) => (
  <div style={{ fontSize:12.5, color:"rgba(245,230,192,.5)", lineHeight:1.6,
    maxWidth:280, marginBottom:20 }}>{children}</div>
);

export default function AuthCallbackView() {
  // idle → validating → recovery | done | error
  const [phase,   setPhase]   = useState("validating");
  const [error,   setError]   = useState("");
  const [params]              = useState(() => readAuthParams());
  const ranRef                = useRef(false);

  // Contraseña nueva
  const [pass,     setPass]     = useState("");
  const [passConf, setPassConf] = useState("");
  const [show,     setShow]     = useState(false);
  const [saving,   setSaving]   = useState(false);

  const goToApp = useCallback((extra = {}) => {
    window.location.replace(appViewUrl(HOME_VIEW, extra));
  }, []);

  // ── Canjear el link por una sesión ──────────────────────────────────────────
  useEffect(() => {
    // StrictMode monta dos veces en dev. El código del mail es de un solo uso:
    // canjearlo dos veces devuelve "invalid flow state" y rompe un link válido.
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      if (!hasAuthPayload(params)) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError("Entraste sin un link de validación. Abrí el mail que te mandamos y tocá el botón.");
          setPhase("error");
          return;
        }
      }

      const result = await consumeAuthCallback(params);
      clearAuthParamsFromUrl();

      if (!result.ok) { setError(result.error); setPhase("error"); return; }

      // Recuperación: NO mandamos al cliente a la app todavía. La sesión que
      // trae el link sirve justo para una cosa — fijar la contraseña nueva.
      if (isRecovery(params)) { setPhase("recovery"); return; }

      // Confirmación de cuenta: completamos `profiles` (el trigger ya creó la
      // fila; acá sumamos lo que quedó en este celular, como la foto) y
      // arrancamos la app desde el menú Noti.
      if (result.user) await hydrateProfile(result.user);
      setPhase("done");
      setTimeout(() => goToApp({ confirmed: "1" }), 1400);
    })();
  }, [params, goToApp]);

  // ── Guardar contraseña nueva ────────────────────────────────────────────────
  const canSave = pass.length >= 6 && pass === passConf;

  const handleSavePassword = useCallback(async () => {
    if (!canSave || saving) return;
    setSaving(true); setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("El link venció. Volvé a la app y pedí uno nuevo desde \"Olvidé mi contraseña\".");
        return;
      }
      const { error: upErr } = await supabase.auth.updateUser({ password: pass });
      if (upErr) {
        setError(/same|different/i.test(upErr.message)
          ? "La contraseña nueva tiene que ser distinta a la anterior."
          : upErr.message);
        return;
      }
      // El link de recuperación ya dejó la sesión iniciada: hidratamos el
      // perfil para que la app lo reconozca sin pedirle login de nuevo.
      if (session.user) await hydrateProfile(session.user);
      setPhase("done");
      setTimeout(() => goToApp({ passwordChanged: "1" }), 1400);
    } finally {
      setSaving(false);
    }
  }, [canSave, saving, pass, goToApp]);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (phase === "validating") return (
    <AuthShell>
      <Centered>
        <div style={{ fontSize:44, marginBottom:14, animation:"goldGlow 2s ease infinite" }}>🔐</div>
        <Title>Validando tu link…</Title>
        <Sub>Un segundo, estamos confirmando los datos con el servidor.</Sub>
      </Centered>
    </AuthShell>
  );

  if (phase === "error") return (
    <AuthShell>
      <Centered>
        <div style={{ fontSize:44, marginBottom:14 }}>⚠️</div>
        <Title>No pudimos validar el link</Title>
        <Sub>{error}</Sub>
        <button className="btn-primary" onClick={() => goToApp()}>
          Volver a BizarrApp
        </button>
      </Centered>
    </AuthShell>
  );

  if (phase === "done") return (
    <AuthShell>
      <Centered>
        <div style={{ fontSize:52, marginBottom:14 }}>🎉</div>
        <Title>¡Listo!</Title>
        <Sub>Te llevamos a BizarrApp…</Sub>
      </Centered>
    </AuthShell>
  );

  // phase === "recovery" — formulario de contraseña nueva
  return (
    <AuthShell>
      <div style={{ paddingTop:8 }}>
        <div className="sec-hdr"><span style={{ fontSize:20 }}>🔑</span><h3>Nueva contraseña</h3></div>

        <div style={{ textAlign:"center", marginBottom:16 }}>
          <div style={{ fontSize:12.5, color:"rgba(245,230,192,.5)", lineHeight:1.6 }}>
            Elegí una contraseña nueva para tu cuenta BizarrApp.
          </div>
        </div>

        <div className="card">
          <div className="card-title">🔒 Contraseña nueva</div>
          <input className="input-field" type={show ? "text" : "password"}
            placeholder="Mínimo 6 caracteres" autoComplete="new-password"
            value={pass} onChange={(e) => { setPass(e.target.value); setError(""); }}/>

          <div className="card-title" style={{ marginTop:4 }}>🔒 Repetir contraseña</div>
          <input className="input-field" type={show ? "text" : "password"}
            placeholder="Escribila de nuevo" autoComplete="new-password"
            value={passConf} onChange={(e) => { setPassConf(e.target.value); setError(""); }}/>

          <label style={{ display:"flex", alignItems:"center", gap:8, marginTop:2,
            fontSize:11, color:"rgba(245,230,192,.45)", cursor:"pointer" }}>
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)}/>
            Mostrar contraseñas
          </label>

          {pass.length > 0 && pass.length < 6 && (
            <div style={{ fontSize:10.5, color:"rgba(255,215,0,.6)", marginTop:6 }}>
              Te faltan {6 - pass.length} caracteres.
            </div>
          )}
          {passConf && pass !== passConf && (
            <div style={{ fontSize:10.5, color:"rgba(239,68,68,.8)", marginTop:6 }}>
              Las contraseñas no coinciden.
            </div>
          )}
        </div>

        {error && (
          <div style={{ display:"flex", gap:8, alignItems:"flex-start", padding:"10px 12px",
            marginBottom:10, background:"rgba(239,68,68,.1)",
            border:"1px solid rgba(239,68,68,.3)", borderRadius:10 }}>
            <span style={{ fontSize:15, flexShrink:0 }}>⚠️</span>
            <span style={{ fontSize:11, color:"#FCA5A5", lineHeight:1.5 }}>{error}</span>
          </div>
        )}

        <button className="btn-primary" disabled={!canSave || saving}
          style={{ opacity:(!canSave || saving) ? .4 : 1 }} onClick={handleSavePassword}>
          {saving ? "Guardando…" : "✓ Guardar contraseña"}
        </button>

        <button onClick={() => goToApp()} style={{ width:"100%", marginTop:12, background:"none",
          border:"none", color:"rgba(255,215,0,.45)", fontSize:12, cursor:"pointer",
          textDecoration:"underline" }}>
          Cancelar y volver a la app
        </button>
      </div>
    </AuthShell>
  );
}
