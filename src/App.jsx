import { useState, useCallback, useMemo, useEffect } from "react";

import globalCss                from "./constants/styles";
import { useAuth }              from "./hooks/useAuth";
import { useGameState }         from "./hooks/realtime/useGameState";
import { useMessages }          from "./hooks/realtime/useMessages";
import { useVideoRequests }     from "./hooks/realtime/useVideoRequests";
import { useBanners }           from "./hooks/realtime/useBanners";
import { usePresence }          from "./hooks/realtime/usePresence";
import { AvatarDisplay }        from "./components/AvatarDisplay";
import { PushPermissionBanner } from "./components/PushPermissionBanner";
import { NotificationBell }     from "./components/NotificationBell";
import { DueloTeaserBanner }    from "./components/DueloTeaserBanner";

import { useYouTubePlaylistAdmin } from "./hooks/useYouTubePlaylists";
import CartaView     from "./views/Carta/CartaView";
import NovedadesView from "./views/Novedades/NovedadesView";
import JuegosView    from "./views/Juegos/JuegosView";
import EscenarioView from "./views/Escenario/EscenarioView";
import PantallaView  from "./views/Pantalla/PantallaView";
import ProfileView, { LoginView } from "./views/Perfil/ProfileView";
import ForgotPasswordView from "./views/Auth/ForgotPasswordView";

const LOGO_URL         = "/logo.png";
const RESTRICTED_VIEWS = ["games", "escenario", "pantalla"];
const VIEWS            = ["novedades", "menu", "pantalla", "games", "escenario", "profile"];

export default function BizarrApp() {
  const { user, regStep, setRegStep, register, login, loginAsGuest,
          updateUser, isLoggedIn, isGuest } = useAuth();

  const [view,     setView]     = useState(() => {
    const params    = new URLSearchParams(window.location.search);
    // `view` es el parámetro público (lo usan el push, el QR y la vuelta del
    // mail de confirmación); `designerView` queda para el modo diseñador.
    const requested = params.get("view") || params.get("designerView");
    return VIEWS.includes(requested) ? requested : "novedades";
  });

  // Cartel de vuelta del mail: /auth/callback nos manda con ?confirmed=1 o
  // ?passwordChanged=1 después de validar el link.
  const [authNotice, setAuthNotice] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("confirmed"))       return "confirmed";
    if (params.get("passwordChanged")) return "passwordChanged";
    return null;
  });
  // Qué juego está abierto adentro de la vista Juegos (ej: 'duelo')
  const [gameOpen, setGameOpen] = useState(null);
  // Configuración de playlists de YouTube (persiste en localStorage)
  const { config: ytConfig } = useYouTubePlaylistAdmin();
  // "login" | "register" | "forgot"
  const [authMode,    setAuthMode]    = useState("login");
  const [forgotEmail, setForgotEmail] = useState("");

  // Estado global del juego — sincronizado via Supabase Realtime
  const { session, gameState, loading: stateLoading } = useGameState();

  // Presencia: check-in del usuario en la sesión activa
  usePresence(session?.id, user);

  // Mensajes del usuario
  const { messages, send: sendMsg } = useMessages(session?.id, "user");
  const { send: sendVideo } = useVideoRequests(session?.id);

  // Novedades publicadas por el staff (cards 1440x600)
  const { banners, loading: bannersLoading } = useBanners(session?.id);

  // El gate real de Juegos/Escenario/Pantalla es el `geo_ok` guardado en el
  // perfil, no `useGeoGate` — ese hook solo corre dentro del wizard de registro.
  // Por eso el invitado se destraba acá y no allá.
  const isRestricted = !user?.geoOk && !isGuest;

  // Deep-link desde push: /?view=games&game=duelo abre el duelo directo (una sola vez).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("view") === "games" && params.get("game") === "duelo") {
      setView("games");
      setGameOpen("duelo");
    }
    // Deep-link del QR de Pantalla/Escenario: /?pantallaCode=XXXXXX
    if (params.get("pantallaCode")) setView("pantalla");

    // Los avisos de la vuelta del mail son de una sola vez: los sacamos de la
    // URL para que un refresh o un "compartir link" no los repita.
    if (params.has("confirmed") || params.has("passwordChanged")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("confirmed");
      url.searchParams.delete("passwordChanged");
      window.history.replaceState({}, document.title, url.pathname + url.search);
    }
  }, []);

  // El cartel de confirmación se va solo: es una felicitación, no una alerta.
  useEffect(() => {
    if (!authNotice) return;
    const t = setTimeout(() => setAuthNotice(null), 9000);
    return () => clearTimeout(t);
  }, [authNotice]);

  const goProfile = useCallback(() => {
    if (user?.registered) setRegStep(5);
    setView("profile");
  }, [user, setRegStep]);

  const NAV = useMemo(() => [
    { id: "novedades", icon: "📣", label: "Bienvenidos", image: "/botones/Noti.png"     },
    { id: "menu",      icon: "🍹", label: "Menú",        image: "/botones/Menu.png"     },
    { id: "pantalla",  icon: "📺", label: "Pantalla",    image: "/botones/Pantalla.png" },
    { id: "games",     icon: "🎮", label: "Juegos",      image: "/botones/juegos.png"   },
    { id: "escenario", icon: "🎤", label: "Escenario",   image: "/botones/Escenario.png" },
    ...(!isLoggedIn ? [{ id: "profile", icon: "👤", label: "Registro", image: "/botones/Perfil.png" }] : []),
  ], [isLoggedIn]);

  const renderContent = () => {
    switch (view) {
      case "menu":       return <CartaView />;
      case "novedades":  return <NovedadesView banners={banners} loading={bannersLoading} />;
      case "games":
        return <JuegosView user={user} activeGame={gameState?.active_game ?? null}
                 activeEscenario={gameState?.active_escenario ?? null}
                 isRestricted={isRestricted} onGoProfile={goProfile} sessionId={session?.id}
                 gameOpen={gameOpen} setGameOpen={setGameOpen}/>;
      case "escenario":
        return <EscenarioView user={user} activeEscenario={gameState?.active_escenario ?? null}
                 isRestricted={isRestricted} onGoProfile={goProfile} sessionId={session?.id} ytConfig={ytConfig}/>;
      case "pantalla":
        return <PantallaView user={user}
                 messages={messages.filter(m => m.user_id === user?.id)}
                 onSend={text => sendMsg(text, user)}
                 isRestricted={isRestricted} onGoProfile={goProfile} ytConfig={ytConfig}
                 onSendVideo={(video) => sendVideo({ ytId: video.ytId, title: video.title, artist: video.artist, user })}/>;
      case "profile":
        if (!user?.registered) {
          if (authMode === "forgot")
            return <ForgotPasswordView initialEmail={forgotEmail}
                     onBack={() => setAuthMode("login")}/>;
          return authMode === "login"
            ? <LoginView onLogin={login} onGoRegister={() => setAuthMode("register")}
                onGuestLogin={loginAsGuest}
                onGoForgot={(email) => { setForgotEmail(email || ""); setAuthMode("forgot"); }}/>
            : <ProfileView user={user} onSave={updateUser} onRegister={register}
                regStep={regStep} setRegStep={setRegStep}/>;
        }
        return <ProfileView user={user} onSave={updateUser} onRegister={register}
                 regStep={regStep} setRegStep={setRegStep}/>;
      default: return <CartaView />;
    }
  };

  if (stateLoading) return (
    <>
      <style>{globalCss}</style>
      <div className="app-root">
        <div className="phone-shell" style={{alignItems:"center",justifyContent:"center"}}>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:48,marginBottom:16,animation:"goldGlow 2s ease infinite"}}>🎵</div>
            <div style={{fontFamily:"Syne,sans-serif",fontWeight:900,fontSize:18,color:"#FFD700"}}>BizarrApp</div>
            <div style={{fontSize:12,color:"rgba(255,215,0,.35)",marginTop:8}}>Conectando...</div>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <style>{globalCss}</style>
      <div className="app-root">
        <div className="phone-shell">
          <header className="app-header">
            <div className="app-header-brand">
              <img src={LOGO_URL} alt="Bizarren" className="app-header-logo"
                onError={e => { e.target.style.display="none"; }}/>
              <span className="app-header-name">BizarrApp</span>
            </div>
            {/* Campana: a la izquierda del avatar cuando hay sesión, si no al borde */}
            <NotificationBell user={user} offset={isLoggedIn ? 60 : 16}/>
            {isLoggedIn && (
              <button onClick={goProfile} style={{
                background:  view==="profile" ? "rgba(255,215,0,.12)" : "transparent",
                border:      `1px solid ${view==="profile" ? "rgba(255,215,0,.3)" : "transparent"}`,
                borderRadius:"50%", padding:0, cursor:"pointer",
                width:38, height:38, display:"flex", alignItems:"center", justifyContent:"center",
                position:"absolute", right:16, top:"50%", transform:"translateY(-50%)",
                WebkitTapHighlightColor:"transparent",
              }}>
                <AvatarDisplay user={user} size={32} fontSize={14}/>
              </button>
            )}
          </header>
          {/* Va fuera de <main> para que no scrollee con el contenido, y en
              ámbar para que no se confunda con el aviso verde de "cuenta
              confirmada" que aparece justo abajo. Sin botón de cerrar. */}
          {isGuest && (
            <div style={{ display:"flex",alignItems:"center",gap:8,padding:"7px 14px",
              background:"rgba(245,158,11,.15)",borderBottom:"1px solid rgba(245,158,11,.35)",
              color:"#FCD34D",fontSize:11.5,fontWeight:700,flexShrink:0,letterSpacing:.2 }}>
              <span style={{ fontSize:13 }}>⚠</span>
              <span>Modo invitado — datos de prueba</span>
            </div>
          )}
          <main className="app-content">
            {authNotice && (
              <div style={{ display:"flex",gap:10,alignItems:"flex-start",padding:"12px 14px",
                marginBottom:14,background:"rgba(34,197,94,.1)",
                border:"1px solid rgba(34,197,94,.3)",borderRadius:12 }}>
                <span style={{ fontSize:20,flexShrink:0 }}>
                  {authNotice === "confirmed" ? "🎉" : "🔑"}
                </span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12.5,fontWeight:700,color:"#86EFAC",marginBottom:2 }}>
                    {authNotice === "confirmed" ? "¡Cuenta confirmada!" : "Contraseña actualizada"}
                  </div>
                  <div style={{ fontSize:11.5,color:"rgba(245,230,192,.55)",lineHeight:1.5 }}>
                    {authNotice === "confirmed"
                      ? `¡Bienvenido/a a BizarrApp${user?.name ? `, ${user.name}` : ""}! Ya podés jugar, votar y mandar mensajes a la pantalla.`
                      : "Listo, ya podés entrar con tu contraseña nueva."}
                  </div>
                </div>
                <button onClick={() => setAuthNotice(null)} aria-label="Cerrar aviso"
                  style={{ background:"none",border:"none",color:"rgba(245,230,192,.35)",
                    fontSize:16,cursor:"pointer",padding:0,lineHeight:1 }}>×</button>
              </div>
            )}
            {renderContent()}
          </main>
          <nav className="app-nav">
            {NAV.map(n => {
              const isActive = view === n.id;
              const gated    = isRestricted && RESTRICTED_VIEWS.includes(n.id);
              return (
                <button key={n.id}
                  className={`nav-btn${isActive ? " active" : ""}`}
                  aria-label={n.label}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => n.id==="profile" ? goProfile() : setView(n.id)}
                  style={{
                    position: "relative",
                    opacity: gated ? 0.45 : 1,
                  }}>
                  {n.image
                    ? <img className="nav-image" src={n.image} alt="" aria-hidden="true"/>
                    : <span className="nav-icon" aria-hidden="true">{n.icon}</span>}
                  {gated && (
                    <span aria-hidden="true" style={{
                      position:"absolute", top:1, right:5, fontSize:11,
                      pointerEvents:"none", filter:"drop-shadow(0 0 2px #000)",
                    }}>🔒</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
        <PushPermissionBanner user={user} />
        <DueloTeaserBanner
          activeEscenario={gameState?.active_escenario ?? null}
          currentView={view}
          onGoDuelo={() => { setGameOpen("duelo"); setView("games"); }}
          sessionId={session?.id}
        />
      </div>
    </>
  );
}
