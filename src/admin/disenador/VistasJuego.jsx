import { useState } from "react";
import { usePantallaVisibilidadAdmin } from "../../hooks/usePantallaQr";
import { QrLogoJuego } from "../juegos/AjustesDelJuego";
import PreviewTv from "./PreviewTv";
import { VISTAS, VISTAS_POR_JUEGO } from "./vistasJuegos";

/**
 * Diseño de UN juego en sus cuatro vistas (Convocatoria, Participante listo,
 * Performance, Celular): los controles de la vista a la izquierda y la vista
 * previa (TV o celular) a la derecha, entera en la ventana. Igual para todos
 * los juegos; cada uno aporta sus controles con `controles(vista, ctx)`.
 * `nav` son las solapas de juegos (SolapasJuegos): van en la misma fila que
 * las vistas.
 *
 * QR y logo (Convocatoria) viven acá: valen para todas las pantallas del
 * juego y FTL / PT además los pasan a la vista previa.
 *
 * `ctx = { qr, logo, guardado }` — `guardado()` se llama después de cada
 * guardado exitoso: sube `rev` y la vista previa relee la configuración ya.
 * `escenaExtra({ qr, logo })` agrega a la escena lo que la vista previa no lee
 * sola (FTL / PT).
 *
 * `editor(vista)`: si devuelve algo, esa vista se edita en el editor libre de
 * pantallas (src/lienzo) en lugar de controles + vista previa.
 */

const CSS = `
  .vj-barra{display:flex;align-items:center;gap:8px 10px;flex-wrap:wrap;margin-bottom:10px;}
  .vj-sep{width:1px;align-self:stretch;min-height:26px;background:rgba(240,232,255,.16);}
  .vj-vistas{display:flex;gap:5px;flex-wrap:wrap;}
  .vj-vista{padding:7px 12px;font:inherit;font-size:11.5px;font-weight:700;border-radius:999px;cursor:pointer;
    background:rgba(240,232,255,.04);color:rgba(240,232,255,.55);border:1px solid rgba(240,232,255,.12);}
  .vj-vista:hover{color:rgba(240,232,255,.9);}
  .vj-vista[aria-selected="true"]{cursor:default;color:var(--vj-col);border-color:var(--vj-col);
    background:color-mix(in srgb,var(--vj-col) 14%,transparent);}
  .vj-estados{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:6px;}
  .vj-estado{padding:4px 10px;font:inherit;font-size:10.5px;font-weight:700;border-radius:8px;cursor:pointer;
    background:rgba(240,232,255,.04);color:rgba(240,232,255,.5);border:1px solid rgba(240,232,255,.1);}
  .vj-estado[aria-pressed="true"]{cursor:default;color:#F0E8FF;border-color:var(--vj-col);
    background:color-mix(in srgb,var(--vj-col) 18%,transparent);}
  .vj-cuerpo{display:grid;grid-template-columns:minmax(300px,380px) minmax(0,1fr);gap:14px;align-items:start;}
  .vj-preview{position:sticky;top:0;min-width:0;}
  @media (max-width:1100px){
    .vj-cuerpo{grid-template-columns:1fr;}
    .vj-preview{position:static;order:-1;}
  }
`;

const nota = { fontSize: 10.5, color: "rgba(240,232,255,.45)", lineHeight: 1.5 };

function SinOpciones({ texto }) {
  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <div style={nota}>{texto}</div>
    </div>
  );
}

export default function VistasJuego({ juego, col, nav, controles, escenaExtra, editor }) {
  const qr   = usePantallaVisibilidadAdmin("qr");
  const logo = usePantallaVisibilidadAdmin("logo");
  const [vista, setVista] = useState("convocatoria");
  const [estados, setEstados] = useState({});   // vista → estado elegido
  const [rev, setRev] = useState(0);
  const guardado = () => setRev((r) => r + 1);

  const def = VISTAS_POR_JUEGO[juego];
  const vistaDef = def[vista] || {};
  const estado = estados[vista] || vistaDef.estados?.[0]?.id || null;
  const ctx = { qr, logo, guardado };

  // Escena de la vista previa. Un objeto nuevo por render está bien: PreviewTv
  // sólo la reenvía si cambió su contenido.
  // El celular no usa `escenaExtra`: lo dibuja la app del cliente.
  const extra = escenaExtra && vista !== "celular" ? escenaExtra({ qr, logo }) : null;
  const escena = escenaExtra && vista !== "celular" && !extra
    ? null
    : { juego, vista, estado, rev, ...extra };

  const propios = controles ? controles(vista, ctx) : null;
  const editorLibre = editor ? editor(vista) : null;
  const panelControles = (
    <>
      {vista === "convocatoria" && (
        <QrLogoJuego juego={juego} col={col} qr={qr} logo={logo} onGuardado={guardado}/>
      )}
      {propios}
      {!propios && vista !== "convocatoria" && (
        <SinOpciones texto={vista === "celular"
          ? "Este juego todavía no tiene opciones de diseño para el celular. La vista previa muestra cómo lo ve hoy el cliente."
          : vistaDef.sinPantalla
            ? "Esta pantalla todavía no existe en la TV. Cuando se cree, su diseño se arma acá."
            : "Esta pantalla todavía no tiene opciones de diseño propias. La vista previa muestra cómo se ve hoy en la TV."}/>
      )}
    </>
  );

  return (
    <div style={{ "--vj-col": col }}>
      <style>{CSS}</style>
      {/* Una sola fila: juegos ‖ vistas, para dejarle el alto a la vista previa. */}
      <div className="vj-barra">
        {nav}
        {nav && <div className="vj-sep" aria-hidden="true"/>}
        <div className="vj-vistas" role="tablist" aria-label="Vistas del juego">
          {VISTAS.map((v) => (
            <button key={v.id} type="button" role="tab" aria-selected={vista === v.id}
              className="vj-vista" onClick={() => setVista(v.id)}>
              {v.icon} {v.label}
            </button>
          ))}
        </div>
      </div>

      {editorLibre}
      {!editorLibre && <div className="vj-cuerpo">
        <div>{panelControles}</div>

        <div className="vj-preview">
          {vistaDef.estados && (
            <div className="vj-estados" role="group" aria-label="Estado de la pantalla">
              {vistaDef.estados.map((e) => (
                <button key={e.id} type="button" className="vj-estado" aria-pressed={estado === e.id}
                  onClick={() => setEstados((s) => ({ ...s, [vista]: e.id }))}>{e.label}</button>
              ))}
            </div>
          )}
          {/* key: cambiar entre TV y celular monta otro iframe, a su tamaño. */}
          <PreviewTv key={vista === "celular" ? "celular" : "tv"} escena={escena}
            dispositivo={vista === "celular" ? "celular" : "tv"}/>
          {/* Una sola línea: PreviewTv reserva ese alto debajo (RESERVA_ABAJO). */}
          <div title={vistaDef.texto} style={{ ...nota, marginTop: 6, textAlign: "center",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {vistaDef.texto} · Datos de ejemplo; se actualiza al guardar.
          </div>
        </div>
      </div>}
    </div>
  );
}
