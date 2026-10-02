import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SIDEBAR_MENU, aplicarConfiguracion, describirEntrada, entradaDisponible,
} from "../sidebarMenu";
import { useArrastreLista } from "./useArrastreLista";

/**
 * Ajustes → Vista del panel de opciones.
 *
 * Edita un BORRADOR del orden y la visibilidad de las entradas de primer nivel
 * del sidebar (un flyout se mueve y se oculta entero). El orden se cambia
 * arrastrando desde el handle de 6 puntos de cada fila (o con teclado sobre el
 * handle); la visibilidad, con el ojo. Nada se escribe hasta «Guardar», que
 * manda la lista completa de una vez. Si falla, el borrador queda intacto para
 * reintentar.
 *
 * Tres motivos distintos para no ver una opción, y esta pantalla sólo maneja
 * el primero:
 *   - oculta por configuración  → el ojo de cada fila;
 *   - no disponible por rol o módulo congelado → la decide `visibleSecs`, acá
 *     sólo se avisa;
 *   - obligatoria (Ajustes) → siempre visible, ojo bloqueado.
 */

const aBorrador = (filas) => filas.map(({ entrada, visible }) => ({ id: entrada.id, visible }));
const mismaLista = (a, b) =>
  a.length === b.length && a.every((x, i) => x.id === b[i].id && x.visible === b[i].visible);

function formatearFecha(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return null; }
}

const AYUDA_HANDLE_ID = "vista-panel-ayuda-handle";

/** Handle de 6 puntos (2 × 3). */
function SeisPuntos() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" aria-hidden="true" focusable="false">
      {[3, 8, 13].flatMap((cy) => [2, 8].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.6" fill="currentColor"/>))}
    </svg>
  );
}

// Íconos vectoriales con la misma convención que el resto del Admin (SVG en
// línea, geometría Lucide 24×24, trazo `currentColor`): el proyecto no usa una
// librería de íconos.
const svgIcono = {
  width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: "false",
};
function IconoOjo() {
  return (
    <svg {...svgIcono} data-icono="ojo">
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}
function IconoOjoTachado() {
  return (
    <svg {...svgIcono} data-icono="ojo-tachado">
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/>
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/>
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/>
      <path d="m2 2 20 20"/>
    </svg>
  );
}

/** Botón de visibilidad: ojo blanco = visible, ojo tachado gris = oculto. */
const estiloOjo = (visible, bloqueado, editable) => ({
  width: 32, height: 32, flexShrink: 0, padding: 0, borderRadius: 8, border: "none",
  display: "flex", alignItems: "center", justifyContent: "center",
  background: "transparent",
  color: visible ? "#F0E8FF" : "rgba(240,232,255,.32)",
  opacity: !editable && !bloqueado ? .4 : 1,
  cursor: bloqueado || !editable ? "not-allowed" : "pointer",
  transition: "color .12s, background .12s",
});

const estiloHandle = (editable, activo) => ({
  width: 26, height: 32, flexShrink: 0, padding: 0, borderRadius: 7,
  display: "flex", alignItems: "center", justifyContent: "center",
  border: `1px solid ${activo ? "rgba(0,229,255,.6)" : "transparent"}`,
  background: activo ? "rgba(0,229,255,.12)" : "transparent",
  color: activo ? "#00E5FF" : "rgba(240,232,255,.45)",
  cursor: editable ? (activo ? "grabbing" : "grab") : "not-allowed",
  opacity: editable ? 1 : .3,
  touchAction: "none",          // en touch, arrastrar no scrollea la página
  userSelect: "none",
});

function Etiqueta({ children, color = "rgba(240,232,255,.5)" }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, letterSpacing: .6, textTransform: "uppercase",
      padding: "2px 6px", borderRadius: 6, border: `1px solid ${color}55`, color, whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

export default function VistaPanelOpciones({ config, secs, visibleSecs, puedeEditar }) {
  const secsPorId = useMemo(() => new Map(secs.map((s) => [s.id, s])), [secs]);
  const entradaPorId = useMemo(() => new Map(SIDEBAR_MENU.map((e) => [e.id, e])), []);

  // Configuración guardada (o base, si no hay nada guardado), ya combinada con
  // las opciones nuevas del menú. Es contra lo que se compara el borrador.
  const filasGuardadas = useMemo(() => aplicarConfiguracion(SIDEBAR_MENU, config.items), [config.items]);
  const guardado = useMemo(() => aBorrador(filasGuardadas), [filasGuardadas]);
  const nuevas = useMemo(() => new Set(filasGuardadas.filter((f) => f.nueva).map((f) => f.entrada.id)), [filasGuardadas]);

  const [borrador, setBorrador] = useState(guardado);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null);   // { tipo:"ok"|"error", texto }

  const sucio = !mismaLista(borrador, guardado);

  // Si lo guardado cambia (carga inicial, guardado, recarga) y no hay cambios
  // en curso, el borrador lo sigue. Con cambios en curso, no se pisan.
  // «Sin cambios» se mide contra la versión ANTERIOR: comparado con la nueva,
  // el borrador siempre parecería sucio (p. ej. al abrir la vista antes de que
  // termine la carga) y se quedaría con el orden base.
  const guardadoPrevioRef = useRef(guardado);
  useEffect(() => {
    const previo = guardadoPrevioRef.current;
    guardadoPrevioRef.current = guardado;
    setBorrador((b) => (mismaLista(b, previo) ? guardado : b));
  }, [guardado]);

  const guardadoPorId = useMemo(() => {
    const m = new Map(); guardado.forEach((g, i) => m.set(g.id, { ...g, pos: i })); return m;
  }, [guardado]);

  const editable = puedeEditar && !config.loading && !guardando;

  // Saca la fila de `desde` y la inserta en `hasta` (índices del borrador).
  const moverA = useCallback((desde, hasta) => {
    setAviso(null);
    setBorrador((b) => {
      if (desde === hasta || desde < 0 || hasta < 0 || desde >= b.length || hasta >= b.length) return b;
      const n = [...b];
      const [fila] = n.splice(desde, 1);
      n.splice(hasta, 0, fila);
      return n;
    });
  }, []);

  const nombreDe = useCallback(
    (id) => describirEntrada(entradaPorId.get(id), secsPorId).label,
    [entradaPorId, secsPorId],
  );
  const ids = useMemo(() => borrador.map((b) => b.id), [borrador]);
  const arrastre = useArrastreLista({ ids, onMover: moverA, habilitado: editable, nombre: nombreDe });
  const alternar = (id) => {
    setAviso(null);
    setBorrador((b) => b.map((x) => (x.id === id && !entradaPorId.get(id)?.obligatorio ? { ...x, visible: !x.visible } : x)));
  };
  const descartar = () => { setAviso(null); setBorrador(guardado); };

  const guardar = async () => {
    setGuardando(true);
    setAviso(null);
    try {
      await config.guardar(borrador);
      setAviso({ tipo: "ok", texto: "Configuración guardada. El menú del panel ya se actualizó." });
    } catch (e) {
      setAviso({ tipo: "error", texto: `${e.message} Tus cambios siguen acá: podés reintentar.` });
    } finally {
      setGuardando(false);
    }
  };

  const fecha = formatearFecha(config.updatedAt);
  const visibles = borrador.filter((b) => b.visible).length;

  return (
    <div>
      {/* Estado: guardado vs borrador */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12, fontSize: 11.5 }}>
        {config.loading ? (
          <span style={{ color: "rgba(240,232,255,.5)" }}>Cargando configuración…</span>
        ) : config.items ? (
          <span style={{ color: "rgba(240,232,255,.55)" }}>
            Configuración guardada{fecha ? ` · última actualización ${fecha}` : ""}
          </span>
        ) : (
          <span style={{ color: "rgba(240,232,255,.55)" }}>Sin configuración guardada: se usa el orden base del panel.</span>
        )}
        <span style={{ color: "rgba(240,232,255,.35)" }}>· {visibles} de {borrador.length} visibles</span>
        {sucio && <span className="chip chip-wait" role="status">● Cambios sin guardar</span>}
      </div>

      {config.error && (
        <div role="alert" style={{ marginBottom: 12, padding: "9px 12px", borderRadius: 10, fontSize: 11.5,
          background: "rgba(255,45,120,.08)", border: "1px solid rgba(255,45,120,.3)", color: "#FCA5A5",
          display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ flex: 1 }}>{config.error}</span>
          <button type="button" className="btn btn-g" style={{ padding: "5px 10px", fontSize: 10 }} onClick={config.refresh}>
            Reintentar
          </button>
        </div>
      )}
      {!puedeEditar && (
        <div style={{ marginBottom: 12, fontSize: 11.5, color: "rgba(240,232,255,.5)" }}>
          Sólo un administrador puede cambiar el menú del panel. Estás viendo la configuración actual.
        </div>
      )}

      <p id={AYUDA_HANDLE_ID} style={{ fontSize: 11, color: "rgba(240,232,255,.4)", margin: "0 0 8px" }}>
        Arrastrá desde ⠿ para cambiar el orden. Con teclado: Espacio sobre ⠿, flechas para mover y Espacio para soltar.
      </p>
      <div aria-live="polite" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
        {arrastre.anuncio}
      </div>

      <ol ref={arrastre.listaRef} aria-label="Opciones del panel"
        style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4, position: "relative" }}>
        {arrastre.destino && (
          <div aria-hidden="true" data-destino style={{
            position: "absolute", left: 0, right: 0, top: arrastre.destino.top, height: arrastre.destino.height,
            borderRadius: 10, border: "1.5px dashed rgba(0,229,255,.55)", background: "rgba(0,229,255,.05)",
            pointerEvents: "none", transition: "top .18s ease",
          }}/>
        )}
        {borrador.map((b, i) => {
          const e = entradaPorId.get(b.id);
          const { icon, label } = describirEntrada(e, secsPorId);
          const g = guardadoPorId.get(b.id);
          const cambiada = !g || g.pos !== i || g.visible !== b.visible;
          const disponible = entradaDisponible(e, visibleSecs);
          const agarrada = arrastre.arrastrando === b.id || arrastre.agarradoTeclado === b.id;
          return (
            <li key={b.id} ref={arrastre.refFila(b.id)} data-opcion={b.id} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "6px 10px 6px 4px", borderRadius: 10,
              background: agarrada ? "#1E1233" : cambiada ? "rgba(255,214,0,.05)" : "rgba(240,232,255,.03)",
              border: `1px solid ${agarrada ? "rgba(0,229,255,.5)" : cambiada ? "rgba(255,214,0,.25)" : "rgba(240,232,255,.07)"}`,
              boxShadow: agarrada ? "0 10px 28px rgba(0,0,0,.55)" : "none",
              ...arrastre.estiloFila(b.id, i),
            }}>
              <button type="button" {...arrastre.propsHandle(b.id)}
                aria-label={`Reordenar ${label}. Posición ${i + 1} de ${borrador.length}`}
                aria-roledescription="controlador de arrastre"
                aria-describedby={AYUDA_HANDLE_ID}
                aria-disabled={!editable}
                title={editable ? "Arrastrá para reordenar" : undefined}
                style={estiloHandle(editable, agarrada)}>
                <SeisPuntos/>
              </button>
              <span style={{ width: 18, textAlign: "right", fontSize: 10.5, color: "rgba(240,232,255,.35)", fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
              <span style={{ fontSize: 17, width: 24, display: "flex", justifyContent: "center", opacity: b.visible ? 1 : .35 }}>{icon}</span>
              <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span data-label style={{ fontSize: 12.5, fontWeight: 600, color: b.visible ? "#F0E8FF" : "rgba(240,232,255,.4)",
                  textDecoration: b.visible ? "none" : "line-through" }}>{label}</span>
                {e.type === "flyout" && <Etiqueta>Grupo · {e.children.filter((c) => secsPorId.has(c)).length} opciones</Etiqueta>}
                {e.obligatorio && <Etiqueta color="#00E5FF">Sistema · siempre visible</Etiqueta>}
                {nuevas.has(b.id) && <Etiqueta color="#00F5A0">Nueva</Etiqueta>}
                {!disponible && <Etiqueta color="#FF9500">No disponible para tu rol</Etiqueta>}
                {cambiada && <Etiqueta color="#FFD600">Modificada</Etiqueta>}
              </span>

              {(() => {
                // `aria-disabled` y no `disabled`: un botón deshabilitado no
                // muestra el tooltip, y en Ajustes el tooltip es la explicación.
                const bloqueado = !!e.obligatorio;
                const texto = bloqueado ? `${label} debe permanecer visible`
                  : b.visible ? "Ocultar del panel" : "Mostrar en el panel";
                const inactivo = bloqueado || !editable;
                return (
                  <button type="button" data-ojo
                    aria-label={bloqueado ? texto : `${b.visible ? "Ocultar" : "Mostrar"} ${label} ${b.visible ? "del" : "en el"} panel`}
                    aria-disabled={inactivo}
                    title={texto}
                    style={estiloOjo(b.visible, bloqueado, editable)}
                    onMouseEnter={(ev) => { if (!inactivo) ev.currentTarget.style.background = "rgba(240,232,255,.07)"; }}
                    onMouseLeave={(ev) => { ev.currentTarget.style.background = "transparent"; }}
                    onClick={() => { if (!inactivo) alternar(b.id); }}>
                    {b.visible ? <IconoOjo/> : <IconoOjoTachado/>}
                  </button>
                );
              })()}
            </li>
          );
        })}
      </ol>

      {aviso && (
        <div role={aviso.tipo === "error" ? "alert" : "status"} style={{
          marginTop: 12, padding: "9px 12px", borderRadius: 10, fontSize: 11.5, lineHeight: 1.5,
          ...(aviso.tipo === "ok"
            ? { background: "rgba(0,245,160,.08)", border: "1px solid rgba(0,245,160,.3)", color: "#00F5A0" }
            : { background: "rgba(255,45,120,.08)", border: "1px solid rgba(255,45,120,.3)", color: "#FCA5A5" }),
        }}>{aviso.texto}</div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
        <button type="button" className="btn btn-g" disabled={!sucio || !editable} onClick={descartar}>
          Descartar cambios
        </button>
        <button type="button" className="btn btn-p" disabled={!sucio || !editable} onClick={guardar}
          style={{ "--sg": "linear-gradient(135deg,#9B2FFF,#00E5FF)", "--gw": "rgba(155,47,255,.3)", minWidth: 110 }}>
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
