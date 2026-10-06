import { useState, useCallback, useMemo, useEffect } from "react";

import globalCss                from "./constants/styles";
import { useAuth }              from "./hooks/useAuth";
import { useGameState }         from "./hooks/realtime/useGameState";
import { useBanners }           from "./hooks/realtime/useBanners";
import { usePresence }          from "./hooks/realtime/usePresence";
import { PushPermissionBanner } from "./components/PushPermissionBanner";
import { NotificationBell }     from "./components/NotificationBell";
import { DueloTeaserBanner }    from "./components/DueloTeaserBanner";
import ClientShell              from "./client/shell/ClientShell";
import { clientNavItems, CLIENT_LOGO_URL } from "./client/shell/clientShellData";

import { useYouTubePlaylistAdmin } from "./hooks/useYouTubePlaylists";
import MenuFrame     from "./views/Carta/MenuFrame";
import NovedadesView from "./views/Novedades/NovedadesView";
import JuegosView    from "./views/Juegos/JuegosView";
import EscenarioView from "./views/Escenario/EscenarioView";
import PantallaView  from "./views/Pantalla/PantallaView";
import { prefetchPantalla } from "./views/Pantalla/pantallaPrefetch";
import { escenarioAnunciado } from "./client/anuncios/anunciosCatalog";
import AnuncioDestacado from "./client/anuncios/AnuncioDestacado";
import ProfileView, { LoginView } from "./views/Perfil/ProfileView";
import ForgotPasswordView from "./views/Auth/ForgotPasswordView";

const VIEWS            = ["novedades", "menu", "pantalla", "games", "escenario", "profile"];

export default function BizarrApp() {
  const { user, regStep, setRegStep, register, login, loginAsGuest,
          updateUser, logout, resendConfirmation, changePassword,
          isLoggedIn, isGuest } = useAuth();

  const [view,     setView]     = useState(() => {
    const params    = new URLSearchParams(window.location.search);
    // `view` es el parámetro público (lo usan el push, el QR y la vuelta del
    // mail de confirmación); `designerView` queda para el modo diseñador.
    const requested = params.get("view") || params.get("designerView");
    return VIEWS.includes(requested) ? requested : "novedades";
  });

  // MENÚ se monta recién la primera vez que el usuario entra (no precargamos
  // el WordPress) y después queda montado, oculto, el resto de la sesión: así
  // hay un solo iframe y volver al menú no lo descarga de nuevo.
  const [menuMontado, setMenuMontado] = useState(view === "menu");
  if (view === "menu" && !menuMontado) setMenuMontado(true);

  // PANTALLA (DJ Democracy) igual: se monta la primera vez y queda montada,
  // oculta, el resto de la sesión. Volver es instantáneo y no rehace las
  // consultas ni las suscripciones Realtime de la votación en cada entrada.
  const [pantallaMontada, setPantallaMontada] = useState(view === "pantalla");
  if (view === "pantalla" && !pantallaMontada) setPantallaMontada(true);

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
  usePresence(session?.id, user, isGuest);

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

  // Precarga de Pantalla en segundo plano, cuando la app ya dibujó y el
  // navegador está libre: la primera visita arranca con datos, sin esperar.
  // Sólo lecturas (ver pantallaPrefetch.js).
  useEffect(() => {
    if (stateLoading || pantallaMontada) return;
    const idle = window.requestIdleCallback ?? ((cb) => setTimeout(cb, 1200));
    const cancel = window.cancelIdleCallback ?? clearTimeout;
    const id = idle(() => prefetchPantalla(), { timeout: 3000 });
    return () => cancel(id);
  }, [stateLoading, pantallaMontada]);

  // Tocar una notificación del navegador con la app ya abierta: el service
  // worker enfoca esta pestaña y manda el destino (mismo deep-link `?view=`,
  // `&game=duelo`) en vez de abrir otra. Ver public/sw.js.
  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw) return undefined;
    const onMessage = (event) => {
      if (event.data?.type !== "bizarren-navigate" || typeof event.data.url !== "string") return;
      const params = new URL(event.data.url, window.location.origin).searchParams;
      const destino = params.get("view");
      if (!VIEWS.includes(destino)) return;
      setGameOpen(destino === "games" && params.get("game") === "duelo" ? "duelo" : null);
      setView(destino);
    };
    sw.addEventListener("message", onMessage);
    return () => sw.removeEventListener("message", onMessage);
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

  // Lo que dibuja la navegación del shell: el candado depende del gate de geo.
  const navItems = useMemo(() => clientNavItems({ isLoggedIn, isRestricted }), [isLoggedIn, isRestricted]);
  const navigate = (id) => id==="profile" ? goProfile() : setView(id);
  // Intención (puntero encima o dedo apoyado): adelanta la precarga del destino.
  const navIntent = (id) => { if (id === "pantalla" && !pantallaMontada) prefetchPantalla(); };

  // Perfil recibe las acciones de esta instancia de useAuth(): no monta otra
  // (cada instancia corre su propio restoreSession y su listener de Auth).
  const profileProps = {
    user, onSave: updateUser, onRegister: register, regStep, setRegStep,
    onLogout: logout, onResendConfirmation: resendConfirmation,
    onChangePassword: changePassword, isGuest,
  };

  const renderContent = () => {
    switch (view) {
      case "menu":       return null; // MenuFrame vive fuera del switch, ver abajo
      case "novedades":  return <NovedadesView banners={banners} loading={bannersLoading} />;
      case "games":
        return <JuegosView user={user} activeGame={gameState?.active_game ?? null}
                 activeEscenario={gameState?.active_escenario ?? null}
                 isRestricted={isRestricted} onGoProfile={goProfile} sessionId={session?.id}
                 gameState={gameState} gameOpen={gameOpen} setGameOpen={setGameOpen}/>;
      case "escenario":
        return <EscenarioView user={user} activeEscenario={gameState?.active_escenario ?? null}
                 isRestricted={isRestricted} onGoProfile={goProfile} sessionId={session?.id}
                 ytConfig={ytConfig} gameState={gameState}/>;
      case "pantalla":   return null; // PantallaView vive fuera del switch, ver abajo
      case "profile":
        if (!user?.registered) {
          if (authMode === "forgot")
            return <ForgotPasswordView initialEmail={forgotEmail}
                     onBack={() => setAuthMode("login")}/>;
          return authMode === "login"
            ? <LoginView onLogin={login} onGoRegister={() => setAuthMode("register")}
                onGuestLogin={loginAsGuest}
                onGoForgot={(email) => { setForgotEmail(email || ""); setAuthMode("forgot"); }}/>
            : <ProfileView {...profileProps}/>;
        }
        return <ProfileView {...profileProps}/>;
      default: return null; // `view` siempre sale de VIEWS / clientNavItems
    }
  };

  if (stateLoading) return (
    <>
      <style>{globalCss}</style>
      <div className="app-root">
        <div className="phone-shell" style={{alignItems:"center",justifyContent:"center"}}>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:48,marginBottom:16,animation:"goldGlow 2s ease infinite"}}>🎵</div>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:18,color:"#FFD700"}}>BizarrApp</div>
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
        <ClientShell logoSrc={CLIENT_LOGO_URL}notificationSlot={<NotificationBell user={user}/>}
          navItems={navItems} activeNavId={view} onNavigate={navigate} onNavIntent={navIntent}>
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
            {/* Tipografía de Pantalla en todas las secciones menos Juegos (ver .tipo-pantalla en styles.js). */}
            <div className={view === "games" ? undefined : "tipo-pantalla"} style={{ display: "contents" }}>
              {/* Experiencia de Escenario anunciada, todavía sin convocatoria. */}
              {view === "escenario" && <AnuncioDestacado placa={escenarioAnunciado(gameState)}/>}
              {renderContent()}
            </div>
            {/* display:contents no agrega caja: la vista ocupa .app-content igual que antes. */}
            {pantallaMontada && (
              <div style={{ display: view === "pantalla" ? "contents" : "none" }}>
                {/* key por usuario: al cambiar de sesión se monta de cero, sin
                    votos, poderes ni rol de la sesión anterior. */}
                <PantallaView key={user?.id ?? "sin-sesion"} user={user}
                  isRestricted={isRestricted} isGuest={isGuest} onGoProfile={goProfile}/>
              </div>
            )}
            {menuMontado && <MenuFrame visible={view === "menu"}/>}
        </ClientShell>
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
