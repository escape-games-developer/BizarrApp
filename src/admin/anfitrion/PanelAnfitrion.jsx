import { useState } from "react";
import BotonInstalar from "./BotonInstalar";

/**
 * Panel del Anfitrión: el control remoto de los juegos desde la tablet.
 *
 * Sin sidebar ni editores: arriba qué está al aire, abajo una pestaña grande
 * por juego y, debajo, el panel del juego en modo simple (`renderJuego`): los
 * mismos paneles del Admin, con su lógica, pero sin biblioteca editable ni
 * reglas, y con Finalizar confirmado.
 *
 * `juegos`: las secciones de SECS que puede usar (un anfitrión real, sólo las
 * que le habilitaron). `juegoAlAire`: id del juego (o de su placa) en pantalla.
 */
export default function PanelAnfitrion({ juegos, juegoAlAire, alAire, conectados, renderJuego, selectorVista, onSalir }) {
  const [elegido, setElegido] = useState(() => (juegos.some((j) => j.id === juegoAlAire) ? juegoAlAire : juegos[0]?.id ?? null));
  const actual = juegos.find((j) => j.id === elegido) || juegos[0] || null;
  // Juegos y Escenario, cada uno en su fila; el orden es el de `juegos`.
  const grupos = [...juegos.reduce((m, j) => m.set(j.grupo, [...(m.get(j.grupo) || []), j]), new Map())];

  return (
    <div className="anf">
      <style>{CSS}</style>
      <header className="anf-top">
        <div className="anf-marca">BizarrApp <span>· Anfitrión</span></div>
        <div className={`anf-aire${alAire ? " on" : ""}`}>
          <span className="anf-punto"/>
          {alAire ? `AL AIRE: ${alAire}` : "NADA AL AIRE"}
        </div>
        <div className="anf-pastilla">👥 {conectados}</div>
        <BotonInstalar/>
        {selectorVista}
        <button type="button" className="anf-salir" onClick={onSalir}>Salir</button>
      </header>

      {!juegos.length ? (
        <div className="anf-vacio">
          Todavía no tenés juegos habilitados. Pedile a un administrador que te los asigne en Usuarios del sistema.
        </div>
      ) : (<>
        {/* Una fila de pestañas: ocupa lo de un botón y, si no entran, se desliza. */}
        <nav className="anf-tabs" role="tablist">
          {grupos.map(([grupo, lista], gi) => (
            <div key={grupo} className="anf-grupo">
              {gi > 0 && <span className="anf-sep" aria-hidden="true"/>}
              <span className="anf-grupo-t">{grupo}</span>
              {lista.map((j) => (
                <button key={j.id} type="button" role="tab" aria-selected={j.id === actual?.id}
                  className={`anf-tab${j.id === actual?.id ? " sel" : ""}`} title={j.label}
                  style={{ "--sg": j.grad, "--gw": j.glow }} onClick={() => setElegido(j.id)}>
                  <span className="anf-tab-i">{j.icon}</span>
                  <span className="anf-tab-l">{CORTO[j.id] || j.label}</span>
                  {j.id === juegoAlAire && <span className="anf-tab-aire" title="Al aire"/>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <main className="anf-body" key={actual?.id}>
          {actual && renderJuego(actual)}
        </main>
      </>)}
    </div>
  );
}

// Nombres cortos para las pestañas (el completo queda en el `title`).
const CORTO = { rey: "Rey del Orto", suma: "Sumate", palabra: "Palabra", trivia: "Desafío",
  duelo: "Duelo", ftl: "Follow the Leader", pt: "Personal Trainer" };

// Encima del CSS del Admin (que define .card, .btn, los *-split…): todo más
// grande y táctil. Botones de 64 px o más, letra legible a un brazo de distancia.
const CSS = `
  .anf{height:100vh;display:flex;flex-direction:column;background:#08040F;color:#F0E8FF;
    font-family:'DM Sans',sans-serif;overflow:hidden;}
  .anf-top{display:flex;align-items:center;gap:10px;padding:10px 16px;flex-shrink:0;flex-wrap:wrap;
    background:rgba(8,4,15,.96);border-bottom:1px solid rgba(155,47,255,.2);}
  .anf-marca{font-weight:800;font-size:18px;color:#FFD600;margin-right:auto;}
  .anf-marca span{color:rgba(240,232,255,.45);font-weight:600;font-size:15px;}
  .anf-aire{display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;font-size:13px;font-weight:800;
    letter-spacing:.4px;color:rgba(240,232,255,.5);background:rgba(240,232,255,.05);border:1px solid rgba(240,232,255,.12);}
  .anf-aire.on{color:#FF2D78;background:rgba(255,45,120,.1);border-color:rgba(255,45,120,.45);}
  .anf-punto{width:9px;height:9px;border-radius:50%;background:currentColor;}
  .anf-aire.on .anf-punto{animation:pulse 1.2s infinite;}
  .anf-pastilla{padding:8px 14px;border-radius:999px;font-size:14px;font-weight:800;color:#FFD600;
    background:rgba(255,214,0,.1);border:1px solid rgba(255,214,0,.4);}
  .anf-salir{min-height:40px;padding:0 16px;border-radius:12px;border:1px solid rgba(240,232,255,.15);cursor:pointer;
    background:rgba(240,232,255,.05);color:rgba(240,232,255,.7);font:700 13px 'DM Sans',sans-serif;}
  .anf-vacio{margin:40px auto;max-width:420px;text-align:center;font-size:16px;line-height:1.5;color:rgba(240,232,255,.5);}

  .anf-tabs{display:flex;align-items:center;gap:6px;padding:8px 16px;flex-shrink:0;overflow-x:auto;
    scrollbar-width:none;border-bottom:1px solid rgba(240,232,255,.07);}
  .anf-tabs::-webkit-scrollbar{display:none;}
  .anf-grupo{display:flex;align-items:center;gap:6px;flex-shrink:0;}
  .anf-sep{width:1px;height:28px;margin:0 6px;background:rgba(240,232,255,.12);}
  .anf-grupo-t{font-size:10px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;
    color:rgba(240,232,255,.35);margin-right:2px;}
  .anf-tab{position:relative;display:flex;align-items:center;gap:7px;height:46px;padding:0 14px;flex-shrink:0;
    border-radius:12px;cursor:pointer;color:rgba(240,232,255,.65);font-family:'DM Sans',sans-serif;white-space:nowrap;
    background:rgba(240,232,255,.04);border:1.5px solid rgba(240,232,255,.1);transition:border-color .15s,color .15s;}
  .anf-tab:active{transform:scale(.97);}
  .anf-tab.sel{color:#F0E8FF;border-color:transparent;
    background:linear-gradient(#1A0D2E,#1A0D2E) padding-box,var(--sg) border-box;box-shadow:0 2px 14px var(--gw);}
  .anf-tab-i{font-size:20px;line-height:1;}
  .anf-tab-l{font-size:14px;font-weight:800;}
  .anf-tab-aire{position:absolute;top:5px;right:5px;width:9px;height:9px;border-radius:50%;
    background:#FF2D78;box-shadow:0 0 8px #FF2D78;animation:pulse 1.2s infinite;}

  .anf-body{flex:1;overflow-y:auto;padding:4px 16px 24px;}
  .anf .card{padding:16px 18px;border-radius:18px;margin-bottom:14px;}
  .anf .ctitle{font-size:12px;letter-spacing:1.4px;color:rgba(240,232,255,.45);margin-bottom:12px;}
  /* !important: varios botones (Escenario, Duelo) traen tamaño en línea. */
  .anf .btn{min-height:52px;font-size:15px !important;border-radius:14px;}
  /* Barra de acciones de Escenario y Duelo: primera tarjeta de la columna derecha. */
  .anf .pal-split > div:last-child > .card:first-child .btn{min-height:68px;font-size:17px !important;font-weight:800;}
  /* Deshabilitado = gris: un degradado al 35 % se sigue leyendo como «tocable». */
  .anf .btn:disabled{opacity:.3;filter:grayscale(1);box-shadow:none;}
  /* Mover / quitar preguntas de la ronda: íconos chicos, agrandados para el dedo. */
  .anf .dd-split > div:first-child button:not(.btn){font-size:20px !important;padding:6px 10px !important;}
  .anf .rey-actions,.anf .sum-actions,.anf .pal-actions,.anf .dd-actions{gap:10px;}
  /* Bajos y con letra grande: se leen igual y dejan lugar al estado del juego. */
  .anf .rey-actions .btn,.anf .sum-actions .btn,.anf .pal-actions .btn,.anf .dd-actions .btn{
    min-height:54px;font-size:19px !important;font-weight:800;padding:6px 8px;line-height:1.15;}
  /* Rey del Orto: el estado (premio → sorteo → ganador) siempre del mismo alto. */
  .anf .rey-estado{position:relative;min-height:300px;display:flex;flex-direction:column;justify-content:center;}
  .anf .rey-estado > .ctitle{position:absolute;top:16px;left:18px;}
  .anf .inp{font-size:16px;padding:12px 14px;}
  .anf .rey-split,.anf .sum-split,.anf .pal-split,.anf .dd-split{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;}
  .anf .rey-list,.anf .pal-list,.anf .dd-lib-list,.anf .sum-list{max-height:none;}
  .anf .rey-row,.anf .pal-row{min-height:60px;padding:10px 14px;border-radius:14px;margin-bottom:8px;}
  .anf .rey-row-t{font-size:17px;}
  .anf .rey-row-d{font-size:12.5px;}
  .anf .pal-row-w{font-size:20px;}
  .anf .pal-row-n{font-size:12px;}
  .anf .sum-list{grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:10px;}
  .anf .sum-obj{height:68px;border-radius:14px;}
  .anf .sum-obj-n{font-size:24px;}
  .anf .sum-auto{height:60px;font-size:16px;border-radius:14px;}
  .anf .dd-lib-row{min-height:60px;padding:10px 12px;border-radius:14px;margin-bottom:8px;}
  .anf .dd-lib-radio{width:36px;height:36px;font-size:22px;line-height:36px;}
  .anf .dd-lib-q{font-size:15px;}
  /* Escenario: postulantes (Duelo) e inscriptos (FTL / PT). */
  .anf .qrow{min-height:60px;padding:8px 10px;}
  .anf .qrow .btn{min-height:46px;min-width:52px;font-size:14px !important;padding:8px 14px !important;}
  .anf .qname{font-size:15px;}
  /* Vertical (o angosta): una sola columna. Se deshacen las dos columnas del
     panel (display:contents) para reordenar las tarjetas: primero la barra de
     acciones (y su error), después el estado del juego, al final la biblioteca. */
  @media (orientation:portrait),(max-width:760px){
    .anf .rey-split,.anf .sum-split,.anf .pal-split,.anf .dd-split{grid-template-columns:1fr;gap:0;}
    .anf .rey-split > div,.anf .sum-split > div,.anf .pal-split > div,.anf .dd-split > div{display:contents;}
    .anf .rey-split > div:last-child > .card:first-child,.anf .sum-split > div:last-child > .card:first-child,
    .anf .pal-split > div:last-child > .card:first-child,.anf .dd-split > div:last-child > .card:first-child{order:-2;}
    .anf .card-error{order:-1;}
  }
  /* Angosto: sin los títulos de grupo; el separador alcanza. */
  @media (max-width:760px){ .anf-grupo-t{display:none;} }
`;
