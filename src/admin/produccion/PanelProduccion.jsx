import { useEffect, useState } from "react";
import BotonInstalar from "../anfitrion/BotonInstalar";
import { juegoEnPantalla } from "../anfitrion/MonitorJuego";

/**
 * Panel de Producción para tablet: el control remoto del show.
 *
 * Es el par del Panel del Anfitrión: el Anfitrión MIRA lo que está al aire
 * para guiar al público; Producción lo OPERA. Sin sidebar ni editores: arriba
 * qué está al aire, a la izquierda un riel con las secciones del show y, al
 * centro, el panel de cada una en modo táctil (`simple`): los mismos paneles
 * del Admin, con su lógica, pero sin bibliotecas editables ni reglas, y con
 * Finalizar confirmado.
 *
 * Lo que arma la estructura (bibliotecas, diseñadores, ajustes) queda en el
 * panel completo, que se abre con «Panel completo».
 *
 * `secciones`: las secciones que puede operar, ya filtradas por permisos.
 * `renderSeccion(id, irA)`: dibuja el panel de una sección.
 */

// Grupos del riel, en el orden del show. Los ids son los de SECS.
export const GRUPOS_PRODUCCION = [
  { grupo: "Show",      items: [{ id: "launch",       icon: "🚀", label: "Lanzar" }] },
  { grupo: "Juegos",    items: [
    { id: "rey",     icon: "🎰", label: "Rey del Orto" },
    { id: "suma",    icon: "🔢", label: "Sumate" },
    { id: "palabra", icon: "🔤", label: "Palabra" },
    { id: "trivia",  icon: "🧠", label: "Desafío" },
  ] },
  { grupo: "Escenario", items: [
    { id: "duelo", icon: "⚔️", label: "Duelo" },
    { id: "ftl",   icon: "💃", label: "Follow" },
    { id: "pt",    icon: "🏋️", label: "Trainer" },
  ] },
  // Mensajes y Videos no van: el cliente ya no los manda (DJ Democracy
  // reemplazó los pedidos de video) y el panel completo tampoco los muestra.
  { grupo: "Pantalla",  items: [
    { id: "pantallaLive", icon: "🎧", label: "DJ en vivo" },
  ] },
];

const CLAVE_TAB = "bizarr_produccion_tab";

export default function PanelProduccion({
  secciones, renderSeccion, gameState, alAire, conectados,
  selectorVista, onPanelCompleto, onSalir,
}) {
  const grupos = GRUPOS_PRODUCCION
    .map((g) => ({ ...g, items: g.items.filter((it) => secciones.includes(it.id)) }))
    .filter((g) => g.items.length);
  const ids = grupos.flatMap((g) => g.items.map((it) => it.id));

  const [tab, setTab] = useState(() => {
    try { const t = localStorage.getItem(CLAVE_TAB); if (t) return t; } catch { /* sin storage */ }
    return "launch";
  });
  const actual = ids.includes(tab) ? tab : ids[0] ?? null;
  useEffect(() => {
    try { if (actual) localStorage.setItem(CLAVE_TAB, actual); } catch { /* sin storage */ }
  }, [actual]);

  // Lanzar navega a los módulos con goTo(id): acá cambia de pestaña.
  const irA = (id) => { if (ids.includes(id)) setTab(id); };
  const enPantalla = juegoEnPantalla(gameState);
  const item = grupos.flatMap((g) => g.items).find((it) => it.id === actual);

  return (
    <div className="prod">
      <style>{CSS}</style>
      <header className="prod-top">
        <div className="prod-marca">BizarrApp <span>· Producción</span></div>
        <div className={`prod-aire${alAire ? " on" : ""}`}>
          <span className="prod-punto"/>
          {alAire ? `AL AIRE: ${alAire}` : "NADA AL AIRE"}
        </div>
        {enPantalla && enPantalla !== actual && ids.includes(enPantalla) && (
          <button type="button" className="prod-ir" onClick={() => setTab(enPantalla)}>
            Ir al juego al aire →
          </button>
        )}
        <div className="prod-pastilla">👥 {conectados}</div>
        <BotonInstalar/>
        {selectorVista}
        <button type="button" className="prod-sec" onClick={onPanelCompleto} title="Bibliotecas, diseñadores y ajustes">
          🖥️ Panel completo
        </button>
        <button type="button" className="prod-sec" onClick={onSalir}>Salir</button>
      </header>

      {!ids.length ? (
        <div className="prod-vacio">
          Todavía no tenés secciones habilitadas. Pedile a un administrador que te las asigne en Usuarios del sistema.
        </div>
      ) : (
        <div className="prod-cuerpo">
          <nav className="prod-riel" role="tablist" aria-label="Secciones del show">
            {grupos.map((g) => (
              <div key={g.grupo} className="prod-grupo">
                <span className="prod-grupo-t">{g.grupo}</span>
                {g.items.map((it) => (
                  <button key={it.id} type="button" role="tab" aria-selected={it.id === actual}
                    className={`prod-tab${it.id === actual ? " sel" : ""}`} onClick={() => setTab(it.id)}>
                    <span className="prod-tab-i">{it.icon}</span>
                    <span className="prod-tab-l">{it.label}</span>
                    {it.id === enPantalla && <span className="prod-tab-aire" title="Al aire"/>}
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <main className="prod-body" key={actual}>
            {item && <h1 className="prod-h">{item.icon} {item.label}</h1>}
            {actual && renderSeccion(actual, irA)}
          </main>
        </div>
      )}
    </div>
  );
}

// Encima del CSS del Admin (que define .card, .btn, los *-split…): todo más
// grande y táctil. Botones de 52 px o más, letra legible a un brazo de distancia.
const CSS = `
  .prod{height:100vh;display:flex;flex-direction:column;background:#08040F;color:#F0E8FF;
    font-family:'DM Sans',sans-serif;overflow:hidden;}
  .prod-top{display:flex;align-items:center;gap:10px;padding:10px 16px;flex-shrink:0;flex-wrap:wrap;
    background:rgba(8,4,15,.96);border-bottom:1px solid rgba(155,47,255,.2);}
  .prod-marca{font-weight:800;font-size:18px;color:#00E5FF;margin-right:auto;}
  .prod-marca span{color:rgba(240,232,255,.45);font-weight:600;font-size:15px;}
  .prod-aire{display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;font-size:13px;font-weight:800;
    letter-spacing:.4px;color:rgba(240,232,255,.5);background:rgba(240,232,255,.05);border:1px solid rgba(240,232,255,.12);}
  .prod-aire.on{color:#FF2D78;background:rgba(255,45,120,.1);border-color:rgba(255,45,120,.45);}
  .prod-punto{width:9px;height:9px;border-radius:50%;background:currentColor;}
  .prod-aire.on .prod-punto{animation:pulse 1.2s infinite;}
  .prod-ir{min-height:38px;padding:0 14px;border-radius:999px;cursor:pointer;font:800 13px 'DM Sans',sans-serif;
    color:#FF2D78;background:transparent;border:1.5px dashed rgba(255,45,120,.55);}
  .prod-pastilla{padding:8px 14px;border-radius:999px;font-size:14px;font-weight:800;color:#FFD600;
    background:rgba(255,214,0,.1);border:1px solid rgba(255,214,0,.4);}
  .prod-sec{min-height:40px;padding:0 14px;border-radius:12px;border:1px solid rgba(240,232,255,.15);cursor:pointer;
    background:rgba(240,232,255,.05);color:rgba(240,232,255,.75);font:700 13px 'DM Sans',sans-serif;}
  .prod-vacio{margin:40px auto;max-width:420px;text-align:center;font-size:16px;line-height:1.5;color:rgba(240,232,255,.5);}

  .prod-cuerpo{flex:1;display:flex;min-height:0;}
  .prod-riel{width:112px;flex-shrink:0;overflow-y:auto;padding:10px 8px 20px;scrollbar-width:none;
    border-right:1px solid rgba(240,232,255,.07);background:rgba(26,13,46,.35);}
  .prod-riel::-webkit-scrollbar{display:none;}
  .prod-grupo{display:flex;flex-direction:column;gap:6px;margin-bottom:14px;}
  .prod-grupo-t{font-size:10px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;
    color:rgba(240,232,255,.35);padding:0 4px;}
  .prod-tab{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;
    min-height:72px;padding:8px 4px;border-radius:14px;cursor:pointer;color:rgba(240,232,255,.6);
    font-family:'DM Sans',sans-serif;background:rgba(240,232,255,.03);border:1.5px solid rgba(240,232,255,.08);
    transition:border-color .15s,color .15s,background .15s;}
  .prod-tab:active{transform:scale(.97);}
  .prod-tab.sel{color:#F0E8FF;background:rgba(0,229,255,.1);border-color:rgba(0,229,255,.6);
    box-shadow:0 2px 14px rgba(0,229,255,.18);}
  .prod-tab-i{font-size:26px;line-height:1;}
  .prod-tab-l{font-size:12.5px;font-weight:800;text-align:center;line-height:1.15;}
  .prod-tab-aire{position:absolute;top:7px;left:7px;width:10px;height:10px;border-radius:50%;
    background:#FF2D78;box-shadow:0 0 8px #FF2D78;animation:pulse 1.2s infinite;}

  .prod-body{flex:1;min-width:0;overflow-y:auto;padding:12px 16px 28px;}
  .prod-h{margin:2px 0 12px;font-size:20px;font-weight:800;color:#F0E8FF;}
  .prod .card{padding:16px 18px;border-radius:18px;margin-bottom:14px;}
  .prod .ctitle{font-size:12px;letter-spacing:1.4px;color:rgba(240,232,255,.45);margin-bottom:12px;}
  /* !important: varios botones (Escenario, Duelo) traen tamaño en línea. */
  .prod .btn{min-height:52px;font-size:15px !important;border-radius:14px;}
  .prod .esc-actions{grid-template-columns:repeat(3,minmax(0,1fr)) !important;gap:10px !important;}
  .prod .esc-actions.esc-4{grid-template-columns:repeat(4,minmax(0,1fr)) !important;}
  .prod .esc-actions .btn{grid-column:auto !important;min-height:54px;font-size:18px !important;font-weight:800;
    padding:6px 8px !important;line-height:1.15 !important;}
  /* Deshabilitado = gris: un degradado al 35 % se sigue leyendo como «tocable». */
  .prod .btn:disabled{opacity:.3;filter:grayscale(1);box-shadow:none;}
  .prod .dd-split > div:first-child button:not(.btn){font-size:20px !important;padding:6px 10px !important;}
  .prod .rey-actions,.prod .sum-actions,.prod .pal-actions,.prod .dd-actions{gap:10px;}
  .prod .rey-actions .btn,.prod .sum-actions .btn,.prod .pal-actions .btn,.prod .dd-actions .btn{
    min-height:54px;font-size:18px !important;font-weight:800;padding:6px 8px;line-height:1.15;}
  .prod .rey-estado{position:relative;min-height:280px;display:flex;flex-direction:column;justify-content:center;}
  .prod .rey-estado > .ctitle{position:absolute;top:16px;left:18px;}
  .prod .inp{font-size:16px;padding:12px 14px;}
  .prod .rey-split,.prod .sum-split,.prod .pal-split,.prod .dd-split{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;}
  .prod .rey-list,.prod .pal-list,.prod .dd-lib-list,.prod .sum-list{max-height:none;}
  .prod .rey-row,.prod .pal-row{min-height:60px;padding:10px 14px;border-radius:14px;margin-bottom:8px;}
  .prod .rey-row-t{font-size:17px;}
  .prod .rey-row-d{font-size:12.5px;}
  .prod .pal-row-w{font-size:20px;}
  .prod .pal-row-n{font-size:12px;}
  .prod .sum-list{grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:10px;}
  .prod .sum-obj{height:68px;border-radius:14px;}
  .prod .sum-obj-n{font-size:24px;}
  .prod .sum-auto{height:60px;font-size:16px;border-radius:14px;}
  .prod .dd-lib-row{min-height:60px;padding:10px 12px;border-radius:14px;margin-bottom:8px;}
  .prod .dd-lib-radio{width:36px;height:36px;font-size:22px;line-height:36px;}
  .prod .dd-lib-q{font-size:15px;}
  .prod .qrow{min-height:60px;padding:8px 10px;}
  .prod .qrow .btn{min-height:46px;min-width:52px;font-size:14px !important;padding:8px 14px !important;}
  .prod .qname{font-size:15px;}
  .prod .duelo-post{min-height:64px;padding:10px;gap:10px;border-radius:14px;}
  .prod .duelo-post .btn{min-height:44px;min-width:44px;font-size:14px !important;}
  .prod .duelo-col-t{font-size:14px;padding:10px 12px;}
  /* Vertical (o angosta): riel arriba, horizontal, y una sola columna.
     Se deshacen las dos columnas del panel (display:contents) para reordenar
     las tarjetas: primero la barra de acciones, después el estado del juego,
     al final la biblioteca. */
  @media (orientation:portrait),(max-width:860px){
    .prod-cuerpo{flex-direction:column;}
    .prod-riel{width:auto;display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;padding:8px 12px;
      border-right:none;border-bottom:1px solid rgba(240,232,255,.07);}
    .prod-grupo{flex-direction:row;align-items:center;margin:0;flex-shrink:0;}
    .prod-grupo + .prod-grupo{padding-left:8px;border-left:1px solid rgba(240,232,255,.12);}
    .prod-grupo-t{display:none;}
    .prod-tab{min-height:58px;min-width:78px;}
    .prod-tab-i{font-size:22px;}
    .prod .rey-split,.prod .sum-split,.prod .pal-split,.prod .dd-split{grid-template-columns:1fr;gap:0;}
    .prod .rey-split > div,.prod .sum-split > div,.prod .pal-split > div,.prod .dd-split > div{display:contents;}
    .prod .rey-split > div:last-child > .card:first-child,.prod .sum-split > div:last-child > .card:first-child,
    .prod .pal-split > div:last-child > .card:first-child,.prod .dd-split > div:last-child > .card:first-child{order:-2;}
    .prod .card-error{order:-1;}
  }
`;
