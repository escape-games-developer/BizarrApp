import { useEffect, useState } from "react";
import BotonInstalar from "./BotonInstalar";
import MonitorJuego, { juegoEnPantalla, CSS_MONITOR } from "./MonitorJuego";

/**
 * Panel del Anfitrión: lo que necesita ver para guiar al público, en la tablet.
 *
 * Es una VISTA: no elige, no anuncia, no lanza ni cierra nada. Eso lo hace
 * Producción desde su panel, y quien arma la estructura de cada juego
 * (premios, palabras, preguntas, videos) también. Acá se sigue sola lo que
 * está en pantalla —sin pestañas— y cada juego muestra sus etapas: anuncio,
 * lo que se juega, el proceso y el resultado. Al salir del aire, el juego
 * queda como «finalizado» hasta que Producción ponga el siguiente.
 *
 * `juegos`: ids de los juegos que puede ver (un anfitrión real, sólo los que
 * le habilitaron en Usuarios del sistema).
 */
export default function PanelAnfitrion({ juegos, gameState, sessionId, alAire, conectados, selectorVista, onSalir }) {
  const enPantalla = juegoEnPantalla(gameState);
  const visible = enPantalla && juegos.includes(enPantalla) ? enPantalla : null;
  const [ultimo, setUltimo] = useState(visible);
  useEffect(() => { if (visible) setUltimo(visible); }, [visible]);
  // Con otra cosa al aire (Duelo, una placa…) no se sigue mostrando el juego anterior.
  const id = visible || (!alAire ? ultimo : null);

  return (
    <div className="anf">
      <style>{CSS + CSS_MONITOR}</style>
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

      <main className="anf-body">
        {!juegos.length ? (
          <div className="anf-vacio">
            Todavía no tenés juegos habilitados. Pedile a un administrador que te los asigne en Usuarios del sistema.
          </div>
        ) : id ? (
          <div className="mon">
            <MonitorJuego key={id} id={id} alAire={id === visible} gameState={gameState} sessionId={sessionId}/>
          </div>
        ) : (
          <div className="mon-espera">
            <div>🎤</div>
            <b>{alAire ? `En pantalla: ${alAire}` : "Esperando el próximo juego"}</b>
            <span>Cuando Producción anuncie un juego, acá vas a ver cada etapa para guiar al público.</span>
          </div>
        )}
      </main>
    </div>
  );
}

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
  .anf-body{flex:1;overflow-y:auto;padding:4px 16px 24px;}
`;
