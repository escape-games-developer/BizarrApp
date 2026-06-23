import { useState, useCallback, useMemo } from "react";

import globalCss                from "./constants/styles";
import { useAuth }              from "./hooks/useAuth";
import { useGameState }         from "./hooks/realtime/useGameState";
import { useMessages }          from "./hooks/realtime/useMessages";
import { useVideoRequests }     from "./hooks/realtime/useVideoRequests";
import { usePresence }          from "./hooks/realtime/usePresence";
import { AvatarDisplay }        from "./components/AvatarDisplay";

import { useYouTubePlaylistAdmin } from "./hooks/useYouTubePlaylists";
import CartaView     from "./views/Carta/CartaView";
import NovedadesView from "./views/Novedades/NovedadesView";
import JuegosView    from "./views/Juegos/JuegosView";
import EscenarioView from "./views/Escenario/EscenarioView";
import PantallaView  from "./views/Pantalla/PantallaView";
import ProfileView, { LoginView } from "./views/Perfil/ProfileView";

const LOGO_URL         = "/logo.png";
const RESTRICTED_VIEWS = ["games", "escenario", "pantalla"];

export default function BizarrApp() {
  const { user, regStep, setRegStep, register, login, updateUser, isLoggedIn } = useAuth();

  const [view,     setView]     = useState("novedades");
  // Configuración de playlists de YouTube (persiste en localStorage)
  const { config: ytConfig } = useYouTubePlaylistAdmin();
  const [authMode, setAuthMode] = useState("login");

  // Estado global del juego — sincronizado via Supabase Realtime
  const { session, gameState, loading: stateLoading } = useGameState();

  // Presencia: check-in del usuario en la sesión activa
  usePresence(session?.id, user);

  // Mensajes del usuario
  const { messages, send: sendMsg } = useMessages(session?.id, "user");
  const { send: sendVideo } = useVideoRequests(session?.id);

  const isRestricted = !user?.geoOk;

  const goProfile = useCallback(() => {
    if (user?.registered) setRegStep(5);
    setView("profile");
  }, [user, setRegStep]);

  const NAV = useMemo(() => [
    { id: "novedades", icon: "📣", label: "Bienvenidos", img: "/botones/boton_noti.png"      },
    { id: "menu",      icon: "🍹", label: "Menú",        img: "/botones/boton_menu.png"      },
    { id: "pantalla",  icon: "📺", label: "Pantalla",    img: "/botones/boton_pantalla.png"  },
    { id: "games",     icon: "🎮", label: "Juegos",      img: "/botones/boton_juegos.png"    },
    { id: "escenario", icon: "🎤", label: "Escenario",   img: "/botones/boton_escenario.png" },
    ...(!isLoggedIn ? [{ id: "profile", icon: "👤", label: "Registro", img: "/botones/botones_perfil.png" }] : []),
  ], [isLoggedIn]);

  const renderContent = () => {
    switch (view) {
      case "menu":       return <CartaView />;
      case "novedades":  return <NovedadesView banners={[]} />;
      case "games":
        return <JuegosView user={user} activeGame={gameState?.active_game ?? null}
                 isRestricted={isRestricted} onGoProfile={goProfile} sessionId={session?.id}/>;
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
        if (!user?.registered)
          return authMode === "login"
            ? <LoginView onLogin={login} onGoRegister={() => setAuthMode("register")}/>
            : <ProfileView user={user} onSave={updateUser} onRegister={register}
                regStep={regStep} setRegStep={setRegStep}/>;
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
            <img src={LOGO_URL} alt="Bizarren" className="app-header-logo"
              onError={e => { e.target.style.display="none"; }}/>
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
          <main className="app-content">{renderContent()}</main>
          <nav className="app-nav">
            {NAV.map(n => {
              const isActive = view === n.id;
              const gated    = isRestricted && RESTRICTED_VIEWS.includes(n.id);
              return (
                <button key={n.id}
                  className="nav-btn"
                  aria-label={n.label}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => n.id==="profile" ? goProfile() : setView(n.id)}
                  style={{
                    position:  "relative",
                    opacity:   gated ? 0.4 : (isActive ? 1 : 0.55),
                    transform: isActive ? "scale(1.1)" : "scale(1)",
                    transition:"all 200ms ease",
                  }}>
                  <img src={n.img} alt={n.label}
                    style={{ width:"100%", height:"100%", objectFit:"contain", pointerEvents:"none" }}/>
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
      </div>
    </>
  );
}
