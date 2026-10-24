import { useEffect, useState } from "react";
import FtlStandbyVista from "../tv/FtlStandbyVista";
import FtlOverlay from "../tv/FtlOverlay";
import DueloBigscreen from "../bigscreen/DueloBigscreen";
import { BIGSCREEN_CSS, PlacaScreen, RaffleScreen, TriviaScreen, SumaScreen, PalabraScreen } from "../bigscreen/BizarrApp PantallaGigante Festival";
import { demoDuelo, demoSumaRound, demoPalabraRound, demoRey, demoTrivia } from "../bigscreen/demosDiseno";
import { QrDeJuego } from "../components/QrDeJuego";
import { refrescarPantallaVisibilidad } from "../hooks/usePantallaQr";
import { refrescarDueloPantalla } from "../hooks/useDueloPantalla";
import { refrescarLienzo } from "../lienzo/useLienzo";
import { ESCENARIO_JUEGOS } from "../constants/escenarioJuegos";
import { useGeneralConfig } from "../hooks/useGeneralConfig";
import globalCss from "../constants/styles";
import ClientShell from "../client/shell/ClientShell";
import { clientNavItems, CLIENT_LOGO_URL, NAV_ID_BY_DESIGN_SECTION } from "../client/shell/clientShellData";
import JuegosView from "../views/Juegos/JuegosView";
import EscenarioView from "../views/Escenario/EscenarioView";
import { celularDe, USUARIO_DEMO } from "./celularDemo";
import MensajeCliente from "../client/anuncios/MensajeCliente";
import { isTvPreviewMessage, tvPreviewMessage } from "./tvPreviewContract";

/**
 * /designer-preview/tv — las pantallas de un juego con datos de ejemplo,
 * dentro de los iframes del Diseñador: la TV (MISMOS componentes y capas que
 * /tv) y, en la vista 📱 Celular, la app del cliente. Lo que se ve acá es lo
 * que sale en pantalla. Qué dibujar llega por mensaje (ver
 * tvPreviewContract.js); la configuración de cada pantalla la leen sus propios
 * hooks, como en la TV, y se relee al instante con cada `rev`.
 */

const PARTICIPANTE = { name: "Valentina", avatar_emoji: "💃" };
const PCT_DEMO = 64;
const WEBAPP = window.location.origin;

// `active_game` de cada juego de la sección Juegos y su placa de anuncio.
const JUEGOS = {
  rey:     { activo: "rey del orto", placa: "game_rey" },
  trivia:  { activo: "trivia",       placa: "game_trivia" },
  suma:    { activo: "suma",         placa: "game_suma" },
  palabra: { activo: "palabra",      placa: "game_palabra" },
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=Space+Grotesk:wght@400;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  html,body,#root{width:100%;height:100%}
  body{background:#08040F;color:#F0E8FF;font-family:'Space Grotesk',sans-serif;overflow:hidden}
`;

/** Capa opaca de juego / placa, igual que en /tv. */
function Capa({ children }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "#08040F", overflow: "hidden" }}>
      <style>{BIGSCREEN_CSS}</style>
      {children}
    </div>
  );
}

/** Lo que haría el video del desafío durante la performance de FTL / PT. */
function VideoDeMuestra({ juego }) {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
      background: "radial-gradient(circle at 60% 45%, #2A2238 0%, #0B0910 75%)" }}>
      <div style={{ textAlign: "center", color: "rgba(240,232,255,.28)", fontFamily: "Syne, sans-serif" }}>
        <div style={{ fontSize: "9vh" }}>▶</div>
        <div style={{ fontSize: "3vh", fontWeight: 800, letterSpacing: ".2em" }}>VIDEO DEL DESAFÍO · {juego.label.toUpperCase()}</div>
      </div>
    </div>
  );
}

/** Una vista que el juego todavía no tiene en la TV. */
function SinPantalla({ texto }) {
  return (
    <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: "8vh 10vw",
      background: "repeating-linear-gradient(45deg,#0B0812 0 24px,#0E0A17 24px 48px)" }}>
      <div style={{ textAlign: "center", color: "rgba(240,232,255,.5)", fontFamily: "'Space Grotesk',sans-serif" }}>
        <div style={{ fontSize: "7vh", marginBottom: "2vh" }}>🚧</div>
        <div style={{ fontSize: "3.4vh", fontWeight: 700, lineHeight: 1.4 }}>{texto}</div>
      </div>
    </div>
  );
}

function Escenario({ escena }) {
  const juego = ESCENARIO_JUEGOS[escena.juego];
  if (escena.vista === "performance") return (
    <>
      <VideoDeMuestra juego={juego}/>
      <FtlOverlay participante={PARTICIPANTE} pct={PCT_DEMO} decae={false} barometro={escena.listo?.barometro}/>
    </>
  );
  return (
    <FtlStandbyVista juego={juego} webappUrl={WEBAPP}
      participante={escena.vista === "listo" ? PARTICIPANTE : null}
      listo={escena.listo} mostrarQr={escena.qr} mostrarLogo={escena.logo}/>
  );
}

function Duelo({ escena }) {
  if (escena.vista === "listo") return (
    <SinPantalla texto="El Duelo todavía no tiene pantalla de participantes listos: la TV pasa de la convocatoria directo a la votación."/>
  );
  const estado = escena.vista === "convocatoria" ? "convocatoria" : (escena.estado || "votacion");
  return (
    <Capa>
      <DueloBigscreen gameState={{ active_escenario: "duelo" }} sessionId={null} webappUrl={WEBAPP}
        demo={demoDuelo(estado)}
        placa={<PlacaScreen logo="/logo.png" gameState={{ active_placa: "duelo", placa_custom: null }}/>}/>
    </Capa>
  );
}

function Juego({ escena }) {
  const { activo, placa } = JUEGOS[escena.juego];
  if (escena.vista === "convocatoria") return (
    <Capa><PlacaScreen logo="/logo.png" gameState={{ active_placa: placa }}/></Capa>
  );

  // «Participante listo» = el juego ya está en pantalla, antes de arrancar.
  const listo = escena.vista === "listo";
  let pantalla = null;
  if (escena.juego === "rey") {
    pantalla = <RaffleScreen gameState={demoRey(listo ? "reposo" : (escena.estado || "sorteo"))}/>;
  } else if (escena.juego === "trivia") {
    const t = demoTrivia(listo ? "preparando" : (escena.estado || "pregunta"));
    pantalla = <TriviaScreen gameState={t.gameState} sessionId={null} demo={t.demo}/>;
  } else if (escena.juego === "suma") {
    pantalla = <SumaScreen sessionId={null} demoRound={listo ? null : demoSumaRound(escena.estado || "en-juego")}/>;
  } else if (escena.juego === "palabra") {
    pantalla = <PalabraScreen sessionId={null} demoRound={listo ? null : demoPalabraRound(escena.estado || "en-juego")}/>;
  }
  return (
    <Capa>
      {pantalla}
      <QrDeJuego activeGame={activo} webappUrl={WEBAPP}/>
    </Capa>
  );
}

/**
 * 📱 El celular: la app del cliente real (ClientShell + JuegosView /
 * EscenarioView) con los datos de muestra de celularDemo.js. Los ajustes
 * generales (vestuario, estilo de cards, títulos) son los guardados.
 */
function Celular({ escena }) {
  const { config: general } = useGeneralConfig(escena.rev ?? 0);
  const cel = celularDe(escena.juego, escena.estado);
  if (!cel) return null;
  const { seccion, props } = cel;
  const comunes = { user: USUARIO_DEMO, isRestricted: false, onGoProfile: noop, sessionId: null };
  return (
    <>
      <style>{globalCss}</style>
      <div className={general.titulos ? "app-root" : "app-root sin-titulos"}>
        <ClientShell logoSrc={CLIENT_LOGO_URL} notificationSlot={null}
          navItems={clientNavItems({ isLoggedIn: true, isRestricted: false })}
          activeNavId={NAV_ID_BY_DESIGN_SECTION[seccion]} onNavigate={noop}>
          {seccion === "juegos"
            ? <JuegosView {...comunes} {...props} mostrarCatalogo={general.catalogoJuegos}/>
            : <EscenarioView {...comunes} {...props} mostrarCatalogo={general.catalogoJuegos}
                vestuario={{ ftl: general.vestuarioFtl, pt: general.vestuarioPt }} estiloCards={general.estiloCards}/>}
        </ClientShell>
      </div>
    </>
  );
}

const noop = () => {};

// Placas de Lanzar (Diseñador → Placas): `active_placa` y el texto de ejemplo.
const PLACAS = {
  break:   { activa: "break" },
  cierre:  { activa: "cierre" },
  mensaje: { activa: "mensaje_app", custom: { title: "¡En minutos empezamos a jugar!" } },
  promo:   { activa: "promo", custom: { emoji: "🍺", title: "2×1 en cervezas artesanales" } },
};

/**
 * Una placa de Lanzar: en la TV, el mismo PlacaScreen de /tv (QR, logo y
 * efecto los lee de la config pública); en el celular, el banner que ve el
 * cliente (Mensaje / Promo) arriba de la app.
 */
function Placa({ escena }) {
  const p = PLACAS[escena.placa];
  if (!p) return null;
  if (escena.vista !== "celular") return (
    <Capa><PlacaScreen logo="/logo.png" gameState={{ active_placa: p.activa, placa_custom: p.custom ?? null }}/></Capa>
  );
  const promo = escena.placa === "promo";
  const mensaje = p.custom && {
    id: `preview-${escena.placa}-${escena.efecto}`, tipo: promo ? "promo" : "mensaje",
    texto: p.custom.title, subtitulo: p.custom.subtitle,
    emoji: promo ? p.custom.emoji : null, efecto: escena.efecto,
  };
  return (
    <>
      <style>{globalCss}</style>
      <div className="app-root">
        <ClientShell logoSrc={CLIENT_LOGO_URL} notificationSlot={null}
          navItems={clientNavItems({ isLoggedIn: true, isRestricted: false })}
          activeNavId={NAV_ID_BY_DESIGN_SECTION.novedades} onNavigate={noop}>
          {mensaje ? <MensajeCliente key={mensaje.id} mensaje={mensaje}/> : (
            <div style={{ padding: "40px 16px", textAlign: "center", color: "rgba(245,230,192,.5)", fontSize: 13, lineHeight: 1.5 }}>
              Esta placa no se muestra en el celular.
            </div>
          )}
        </ClientShell>
      </div>
    </>
  );
}

export default function TvPreviewRoute() {
  const [escena, setEscena] = useState(null);

  useEffect(() => {
    const parent = window.parent;
    const alRecibir = (e) => {
      if (!isTvPreviewMessage(e, parent)) return;
      if (e.data.kind === "render" && e.data.escena) setEscena(e.data.escena);
    };
    window.addEventListener("message", alRecibir);
    if (parent !== window) parent.postMessage(tvPreviewMessage("ready", {}), window.location.origin);
    return () => window.removeEventListener("message", alRecibir);
  }, []);

  // Cada guardado del Admin sube `rev`: se relee la config sin esperar los 3 s.
  const rev = escena?.rev;
  useEffect(() => {
    if (rev == null) return;
    refrescarPantallaVisibilidad("qr");
    refrescarPantallaVisibilidad("logo");
    refrescarPantallaVisibilidad("mensaje");
    refrescarDueloPantalla();
    refrescarLienzo("palabra");
  }, [rev]);

  if (escena?.placa) {
    if (escena.vista === "celular") return <Placa escena={escena}/>;
  } else if (escena?.vista === "celular") return <Celular escena={escena}/>;

  let contenido = null;
  if (escena?.placa) contenido = <Placa escena={escena}/>;
  else if (escena?.juego === "ftl" || escena?.juego === "pt") contenido = <Escenario escena={escena}/>;
  else if (escena?.juego === "duelo") contenido = <Duelo escena={escena}/>;
  else if (escena && JUEGOS[escena.juego]) contenido = <Juego escena={escena}/>;

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden", background: "#08040F" }}>
      <style>{CSS}</style>
      {contenido}
    </div>
  );
}
