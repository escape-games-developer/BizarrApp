import { useState } from "react";
import { MODOS_VOTACION, useVotacionEscenarioAdmin } from "../../hooks/useVotacionEscenario";
import { useGeneralConfigAdmin } from "../../hooks/useGeneralConfig";
import Toggle from "./Toggle";
import { SeccionConfig, AvisoGuardado } from "./SeccionConfig";

/**
 * Ajustes que son de UN juego y antes vivían en la pantalla de Ajustes. Cada
 * uno escribe la misma fila de `admin_ui_config` que escribía Ajustes, sólo
 * que la parte de este juego: los demás juegos no se tocan.
 *
 *   VotacionJuego → regla del juego: va en el panel del juego.
 *   QrLogoJuego, CelularJuego → diseño: van en Diseño de juegos.
 */

const nota = { fontSize: 10, color: "rgba(240,232,255,.4)", lineHeight: 1.5 };

/** Corre un guardado y deja el aviso. */
export function useGuardado(onGuardado) {
  const [guardando, setGuardando] = useState(null);
  const [aviso, setAviso] = useState(null);   // { ok, text }
  const correr = async (clave, fn, okText) => {
    if (guardando) return;
    setGuardando(clave); setAviso(null);
    try { await fn(); setAviso({ ok: true, text: okText }); onGuardado?.(); }
    catch (e) { setAviso({ ok: false, text: e?.message || String(e) }); }
    finally { setGuardando(null); }
  };
  return { guardando, aviso, correr };
}

export function ErrorCarga({ error, recargar }) {
  return (
    <div role="alert" style={{ fontSize: 11, color: "#FCA5A5", lineHeight: 1.5 }}>
      {error}{" "}
      {recargar && (
        <button type="button" className="btn btn-g" style={{ padding: "3px 9px", fontSize: 10, marginLeft: 6 }}
          onClick={recargar}>Reintentar</button>
      )}
    </div>
  );
}

/** 🗳️ Votación del público (FTL / PT): un modo o ninguno. Fila `votacion_escenario`. */
export function VotacionJuego({ juego, col }) {
  const { config, error, guardar, recargar } = useVotacionEscenarioAdmin();
  const { guardando, aviso, correr } = useGuardado();

  const elegir = (modo) => {
    if (config[juego] === modo) return;
    correr(modo, () => guardar({ ...config, [juego]: modo }),
      modo === "off" ? "Sin votación." : `${MODOS_VOTACION[modo].titulo} activado.`);
  };

  const opciones = [...Object.entries(MODOS_VOTACION),
    ["off", { titulo: "Sin votación", detalle: "El público no vota y la TV no muestra barómetro." }]];

  return (
    <SeccionConfig icon="🗳️" titulo="Votación del público" cuando="ronda">
      {error ? <ErrorCarga error={error} recargar={recargar}/> : !config ? (
        <div style={nota}>Cargando…</div>
      ) : (
        <div role="radiogroup" aria-label="Modo de votación" style={{ display: "grid", gap: 5 }}>
          {opciones.map(([id, m]) => {
            const activo = config[juego] === id;
            return (
              <button key={id} type="button" role="radio" aria-checked={activo} title={m.detalle}
                disabled={!!guardando && !activo} onClick={() => elegir(id)}
                style={{ display: "flex", alignItems: "center", gap: 8, textAlign: "left", padding: "7px 10px",
                  borderRadius: 9, font: "inherit", fontSize: 11, fontWeight: 700, lineHeight: 1.3,
                  background: activo ? `${col}24` : "rgba(240,232,255,.03)",
                  border: `1px solid ${activo ? col : "rgba(240,232,255,.1)"}`,
                  color: activo ? "#F0E8FF" : "rgba(240,232,255,.6)", cursor: activo ? "default" : "pointer" }}>
                <span style={{ width: 12, height: 12, borderRadius: "50%", flexShrink: 0,
                  border: `2px solid ${activo ? col : "rgba(240,232,255,.3)"}`,
                  background: activo ? col : "transparent", boxShadow: activo ? "inset 0 0 0 2px #0D0820" : "none" }}/>
                {guardando === id ? "Guardando…" : m.titulo}
              </button>
            );
          })}
          <div style={{ ...nota, marginTop: 3 }}>
            {config[juego] === "off" ? "El juego no tiene votación." : MODOS_VOTACION[config[juego]].detalle}
          </div>
        </div>
      )}
      <AvisoGuardado aviso={aviso}/>
    </SeccionConfig>
  );
}

/**
 * 🔳 QR y logo de BizarrApp en las pantallas del juego (placa de anuncio,
 * convocatoria y juego). Recibe los hooks `usePantallaVisibilidadAdmin` de
 * afuera: quien lo usa también los necesita para la vista previa.
 */
export function QrLogoJuego({ juego, col, qr, logo, onGuardado }) {
  const { guardando, aviso, correr } = useGuardado(onGuardado);

  const error = qr.error || logo.error;
  const filas = [
    { tipo: "qr",   h: qr,   titulo: "QR",               detalle: "Abajo a la izquierda. Lleva al celular directo al juego." },
    { tipo: "logo", h: logo, titulo: "Logo de BizarrApp", detalle: "Arriba a la izquierda." },
  ];

  return (
    <SeccionConfig icon="🔳" titulo="QR y logo" cuando="tv">
      {error ? <ErrorCarga error={error} recargar={() => { qr.recargar(); logo.recargar(); }}/>
        : (!qr.config || !logo.config) ? <div style={nota}>Cargando…</div> : (
          <div style={{ display: "grid", gap: 10 }}>
            {filas.map(({ tipo, h, titulo, detalle }) => {
              const on = !!h.config[juego];
              return (
                <div key={tipo} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700 }}>{titulo}</div>
                    <div style={nota}>{detalle}</div>
                  </div>
                  <Toggle on={on} color={col} etiqueta={titulo} disabled={!!guardando}
                    label={guardando === tipo ? "Guardando…" : on ? "Visible" : "Oculto"}
                    onToggle={() => correr(tipo, () => h.guardar({ ...h.config, [juego]: !on }),
                      `${titulo} ${on ? "oculto" : "visible"}.`)}/>
                </div>
              );
            })}
            <div style={nota}>Vale para la placa de anuncio, la convocatoria y el juego en pantalla.</div>
          </div>
        )}
      <AvisoGuardado aviso={aviso}/>
    </SeccionConfig>
  );
}

/**
 * 📱 Opciones de la pantalla del celular que son de este juego. Fila
 * `general` (la misma de Ajustes → General): sólo cambia las claves pedidas.
 *
 * `opciones = [{ id, titulo, activo, inactivo }]`, con `id` clave de `general`.
 */
export function CelularJuego({ opciones, col, onGuardado }) {
  const { config, error, guardar, recargar } = useGeneralConfigAdmin();
  const { guardando, aviso, correr } = useGuardado(onGuardado);

  return (
    <SeccionConfig icon="📱" titulo="Celular del cliente" cuando="app">
      {error ? <ErrorCarga error={error} recargar={recargar}/> : !config ? (
        <div style={nota}>Cargando…</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {opciones.map((o) => {
            const on = !!config[o.id];
            return (
              <div key={o.id} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700 }}>{o.titulo}</div>
                  <div style={nota}>{on ? o.activo : o.inactivo}</div>
                </div>
                <Toggle on={on} color={col} etiqueta={o.titulo} disabled={!!guardando}
                  label={guardando === o.id ? "Guardando…" : on ? "Activo" : "Inactivo"}
                  onToggle={() => correr(o.id, () => guardar({ ...config, [o.id]: !on }),
                    `${o.titulo}: ${on ? "desactivado" : "activado"}.`)}/>
              </div>
            );
          })}
        </div>
      )}
      <AvisoGuardado aviso={aviso}/>
    </SeccionConfig>
  );
}
