import { useState } from "react";
import { EFECTOS_MENSAJE, usePantallaVisibilidadAdmin } from "../../hooks/usePantallaQr";
import { ErrorCarga, useGuardado } from "../juegos/AjustesDelJuego";
import { SeccionConfig, AvisoGuardado } from "../juegos/SeccionConfig";
import Toggle from "../juegos/Toggle";
import PreviewTv from "./PreviewTv";
import SolapasJuegos from "./SolapasJuegos";

/**
 * Diseñador → Placas: las placas que se mandan desde Admin → Lanzar (Break,
 * Cierre, Mensaje, Promo), cada una en Pantalla gigante y Celular, con su vista
 * previa. Misma estructura que el Diseñador de Juegos (VistasJuego).
 *
 * Lo editable:
 *  - QR y logo de BizarrApp de cada placa → filas `pantalla_qr` / `pantalla_logo`
 *    (las mismas de los juegos, claves break/cierre/mensaje/promo).
 *  - Efecto del texto del Mensaje y de la Promo → fila `pantalla_mensaje`
 *    (`efecto` / `efecto_promo`). Vale para la TV y para el banner del celular
 *    (viaja con cada mensaje que se manda).
 */

const PLACAS = [
  { id: "break",   icon: "⏸️", label: "Break",   col: "#FF9500" },
  { id: "cierre",  icon: "🌙", label: "Cierre",  col: "#9B2FFF" },
  { id: "mensaje", icon: "📣", label: "Mensaje", col: "#FFD600" },
  { id: "promo",   icon: "🍺", label: "Promo",   col: "#00E5FF" },
];

const VISTAS = [
  { id: "pantalla", icon: "📺", label: "Pantalla gigante" },
  { id: "celular",  icon: "📱", label: "Celular" },
];

const TEXTO_VISTA = {
  pantalla: {
    break:   "La placa de Break en la TV, desde que la mandás en Lanzar.",
    cierre:  "La placa de cierre de la noche en la TV.",
    mensaje: "El mensaje que escribís en Lanzar, a pantalla completa.",
    promo:   "La promo que escribís en Lanzar, a pantalla completa.",
  },
  celular: {
    break:   "Hoy el celular no muestra el Break: la app sigue igual.",
    cierre:  "Hoy el celular no muestra el cierre: la app sigue igual.",
    mensaje: "El banner que ve el cliente arriba de la app al mandar el mensaje a Celulares.",
    promo:   "El banner que ve el cliente arriba de la app al mandar la promo a Celulares.",
  },
};

const CSS = `
  .dp-barra{display:flex;align-items:center;gap:8px 10px;flex-wrap:wrap;margin-bottom:10px;}
  .dp-sep{width:1px;align-self:stretch;min-height:26px;background:rgba(240,232,255,.16);}
  .dp-vistas{display:flex;gap:5px;flex-wrap:wrap;}
  .dp-vista{padding:7px 12px;font:inherit;font-size:11.5px;font-weight:700;border-radius:999px;cursor:pointer;
    background:rgba(240,232,255,.04);color:rgba(240,232,255,.55);border:1px solid rgba(240,232,255,.12);}
  .dp-vista:hover{color:rgba(240,232,255,.9);}
  .dp-vista[aria-selected="true"]{cursor:default;color:var(--dp-col);border-color:var(--dp-col);
    background:color-mix(in srgb,var(--dp-col) 14%,transparent);}
  .dp-cuerpo{display:grid;grid-template-columns:minmax(300px,380px) minmax(0,1fr);gap:14px;align-items:start;}
  .dp-preview{position:sticky;top:0;min-width:0;}
  @media (max-width:1100px){
    .dp-cuerpo{grid-template-columns:1fr;}
    .dp-preview{position:static;order:-1;}
  }
`;

const nota = { fontSize: 10.5, color: "rgba(240,232,255,.45)", lineHeight: 1.5 };

/** 🔳 QR y logo de BizarrApp de UNA placa. */
function QrLogoPlaca({ placa, col, qr, logo, onGuardado }) {
  const { guardando, aviso, correr } = useGuardado(onGuardado);
  const error = qr.error || logo.error;
  const filas = [
    { tipo: "qr",   h: qr,   titulo: "QR de BizarrApp",   detalle: "Abajo a la izquierda. Lleva al celular a la app." },
    { tipo: "logo", h: logo, titulo: "Logo de BizarrApp", detalle: "Arriba a la izquierda, con balanceo." },
  ];
  return (
    <SeccionConfig icon="🔳" titulo="QR y logo" cuando="tv">
      {error ? <ErrorCarga error={error} recargar={() => { qr.recargar(); logo.recargar(); }}/>
        : (!qr.config || !logo.config) ? <div style={nota}>Cargando…</div> : (
          <div style={{ display: "grid", gap: 10 }}>
            {filas.map(({ tipo, h, titulo, detalle }) => {
              const on = !!h.config[placa];
              return (
                <div key={tipo} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700 }}>{titulo}</div>
                    <div style={nota}>{detalle}</div>
                  </div>
                  <Toggle on={on} color={col} etiqueta={titulo} disabled={!!guardando}
                    label={guardando === tipo ? "Guardando…" : on ? "Visible" : "Oculto"}
                    onToggle={() => correr(tipo, () => h.guardar({ ...h.config, [placa]: !on }),
                      `${titulo} ${on ? "oculto" : "visible"}.`)}/>
                </div>
              );
            })}
          </div>
        )}
      <AvisoGuardado aviso={aviso}/>
    </SeccionConfig>
  );
}

/** ✨ Efecto del texto del Mensaje o de la Promo (TV y celular). */
function EfectoTexto({ clave, col, msj, onGuardado }) {
  const { guardando, aviso, correr } = useGuardado(onGuardado);
  return (
    <SeccionConfig icon="✨" titulo="Efecto del texto" cuando="tv">
      {msj.error ? <ErrorCarga error={msj.error} recargar={msj.recargar}/> : !msj.config ? (
        <div style={nota}>Cargando…</div>
      ) : (
        <div role="radiogroup" aria-label="Efecto del texto" style={{ display: "grid", gap: 5 }}>
          {EFECTOS_MENSAJE.map((e) => {
            const activo = msj.config[clave] === e.id;
            return (
              <button key={e.id} type="button" role="radio" aria-checked={activo}
                disabled={!!guardando && !activo}
                onClick={() => !activo && correr(e.id, () => msj.guardar({ ...msj.config, [clave]: e.id }), `Efecto: ${e.label}.`)}
                style={{ display: "flex", alignItems: "center", gap: 8, textAlign: "left", padding: "7px 10px",
                  borderRadius: 9, font: "inherit", fontSize: 11, fontWeight: 700,
                  background: activo ? `${col}24` : "rgba(240,232,255,.03)",
                  border: `1px solid ${activo ? col : "rgba(240,232,255,.1)"}`,
                  color: activo ? "#F0E8FF" : "rgba(240,232,255,.6)", cursor: activo ? "default" : "pointer" }}>
                <span style={{ width: 12, height: 12, borderRadius: "50%", flexShrink: 0,
                  border: `2px solid ${activo ? col : "rgba(240,232,255,.3)"}`,
                  background: activo ? col : "transparent", boxShadow: activo ? "inset 0 0 0 2px #0D0820" : "none" }}/>
                {guardando === e.id ? "Guardando…" : e.label}
              </button>
            );
          })}
          <div style={{ ...nota, marginTop: 3 }}>
            Vale para la TV y para el banner del celular de los próximos envíos.
          </div>
        </div>
      )}
      <AvisoGuardado aviso={aviso}/>
    </SeccionConfig>
  );
}

function VistasPlaca({ placa, col, nav }) {
  const qr   = usePantallaVisibilidadAdmin("qr");
  const logo = usePantallaVisibilidadAdmin("logo");
  const msj  = usePantallaVisibilidadAdmin("mensaje");
  const [vista, setVista] = useState("pantalla");
  const [rev, setRev] = useState(0);
  const guardado = () => setRev((r) => r + 1);

  const celular = vista === "celular";
  const claveEfecto = placa === "promo" ? "efecto_promo" : "efecto";
  const escena = { placa, vista, rev, efecto: msj.config?.[claveEfecto] || "fijo" };
  const conTexto = placa === "mensaje" || placa === "promo";

  return (
    <div style={{ "--dp-col": col }}>
      <style>{CSS}</style>
      <div className="dp-barra">
        {nav}
        <div className="dp-sep" aria-hidden="true"/>
        <div className="dp-vistas" role="tablist" aria-label="Vistas de la placa">
          {VISTAS.map((v) => (
            <button key={v.id} type="button" role="tab" aria-selected={vista === v.id}
              className="dp-vista" onClick={() => setVista(v.id)}>
              {v.icon} {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="dp-cuerpo">
        <div>
          {!celular && <QrLogoPlaca placa={placa} col={col} qr={qr} logo={logo} onGuardado={guardado}/>}
          {conTexto && <EfectoTexto clave={claveEfecto} col={col} msj={msj} onGuardado={guardado}/>}
          {celular && !conTexto && (
            <div className="card" style={{ marginBottom: 10 }}>
              <div style={nota}>Esta placa todavía no tiene pantalla en el celular. Cuando se cree, su diseño se arma acá.</div>
            </div>
          )}
          {celular && placa === "promo" && (
            <div className="card" style={{ marginBottom: 10 }}>
              <div style={nota}>La promo llega como banner arriba de cualquier sección, con su emoji y su efecto. El cliente la puede cerrar.</div>
            </div>
          )}
          {conTexto && (
            <div style={{ ...nota, padding: "0 4px" }}>
              El texto se escribe al mandarla, en Lanzar. La vista previa usa un texto de ejemplo.
            </div>
          )}
        </div>

        <div className="dp-preview">
          <PreviewTv key={celular ? "celular" : "tv"} escena={escena} dispositivo={celular ? "celular" : "tv"}/>
          <div title={TEXTO_VISTA[vista][placa]} style={{ ...nota, marginTop: 6, textAlign: "center",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {TEXTO_VISTA[vista][placa]} · Se actualiza al guardar.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DisenadorPlacas() {
  return (
    <SolapasJuegos juegos={PLACAS} seccion="placas">
      {(id, nav) => <VistasPlaca placa={id} col={PLACAS.find((p) => p.id === id).col} nav={nav}/>}
    </SolapasJuegos>
  );
}
