import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MediaLibraryModal from "../../components/media/MediaLibraryModal";
import { FondoLienzo, ElementoLienzo, LIENZO_CSS } from "../LienzoPantalla";
import { FORMATOS, MAX_ELEMENTOS, normalizarElemento, normalizarPantalla, nuevoId } from "../modelo";
import { ESTILO_BASE } from "../estilosTexto";
import { useLienzoAdmin } from "../useLienzo";
import PanelPropiedades from "./PanelPropiedades";
import MarcoCelular from "./MarcoCelular";
import { nota } from "./controles";

/**
 * Editor libre de las pantallas de un juego (estilo Paint): cada elemento se
 * elige con un clic, se mueve arrastrándolo o con las flechas (Shift = de a
 * 10 px), se agranda o achica desde los tiradores (Shift en una esquina
 * mantiene la proporción) y se edita en el panel de la derecha.
 *
 * Teclado (con el foco fuera de los campos): flechas, Supr/Borrar, Ctrl+D
 * duplicar, Ctrl+Z deshacer, Ctrl+Y / Ctrl+Shift+Z rehacer, Esc soltar.
 *
 * Trabaja sobre una copia; «Guardar» la escribe en `lienzo_<juego>` y la TV la
 * toma en ≤ 3 s. Un estado sin diseño guardado arranca desde `porDefecto`.
 *
 * `formato`: "tv" (1920 × 1080) o "celular" (390 × 640, la sección de la app).
 */

const TIRADORES = [
  ["nw", 0, 0, "nwse-resize"], ["n", 50, 0, "ns-resize"], ["ne", 100, 0, "nesw-resize"], ["e", 100, 50, "ew-resize"],
  ["se", 100, 100, "nwse-resize"], ["s", 50, 100, "ns-resize"], ["sw", 0, 100, "nesw-resize"], ["w", 0, 50, "ew-resize"],
];
const IMAN_PX = 8;         // px de pantalla: distancia a la que una guía «engancha»
const GRILLAS = { tv: [20, 40, 60, 120], celular: [5, 10, 20, 40] };
const PREF_AYUDAS = "bizarrapp.lienzo.ayudas";
// Ayudas de alineación (preferencia del navegador): guías inteligentes y cuadrícula.
const leerAyudas = () => {
  try { return { guias: true, grilla: false, paso: 40, ...JSON.parse(localStorage.getItem(PREF_AYUDAS) || "{}") }; }
  catch { return { guias: true, grilla: false, paso: 40 }; }
};

/**
 * Enganche: de las posiciones `propias` (bordes / centro del elemento), la que
 * quede más cerca de una línea `objetivo` dentro de `umbral`. Devuelve el
 * corrimiento y la línea, o null.
 */
function enganchar(propias, objetivos, umbral) {
  let mejor = null;
  for (const p of propias) for (const t of objetivos) {
    const d = t - p;
    if (Math.abs(d) <= umbral && (!mejor || Math.abs(d) < Math.abs(mejor.d))) mejor = { d, t };
  }
  return mejor;
}
const HISTORIAL_MAX = 80;

const esCampo = (t) => t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);

export default function EditorLienzo({ juego, pantallas: listaPantallas, porDefecto, datos, formato = "tv" }) {
  const fmt = FORMATOS[formato] || FORMATOS.tv;
  const { ancho: ANCHO, alto: ALTO } = fmt;
  const cel = fmt.id === "celular";
  const grillas = GRILLAS[fmt.id];
  const admin = useLienzoAdmin(juego);
  const [estado, setEstado] = useState(listaPantallas[0].id);
  const [doc, setDoc] = useState(null);          // { <estado>: pantalla } — copia de trabajo
  const [base, setBase] = useState(null);        // lo guardado, para saber si hay cambios
  const [sel, setSel] = useState(null);
  const [hist, setHist] = useState({ pasado: [], futuro: [] });
  const [guias, setGuias] = useState({ v: [], h: [] });   // líneas de alineación activas (px lógicos)
  const [ayudas, setAyudas] = useState(leerAyudas);
  const [libPara, setLibPara] = useState(null);  // null | "nueva" | "cambiar" | "fondo"
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [enfocar, setEnfocar] = useState(0);
  const zonaRef = useRef(null);
  const [escala, setEscala] = useState(0);
  const arrastre = useRef(null);
  const docRef = useRef(null);
  docRef.current = doc;
  const estadoRef = useRef(null);
  const histRef = useRef(hist);
  histRef.current = hist;

  // Copia de trabajo: lo guardado o, si un estado no tiene diseño, el de fábrica.
  useEffect(() => {
    if (!admin.pantallas) return;
    const d = {};
    for (const p of listaPantallas) d[p.id] = admin.pantallas[p.id] || normalizarPantalla(porDefecto[p.id]);
    setDoc(d); setBase(d); setHist({ pasado: [], futuro: [] });
  }, [admin.pantallas]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = zonaRef.current;
    if (!el) return undefined;
    const medir = () => setEscala(el.clientWidth / ANCHO);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [doc !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  const pantalla = doc?.[estado];
  estadoRef.current = estado;
  const cambiarAyudas = (patch) => setAyudas((g) => {
    const n = { ...g, ...patch };
    try { localStorage.setItem(PREF_AYUDAS, JSON.stringify(n)); } catch { /* sólo en memoria */ }
    return n;
  });
  const sucio = useMemo(() => doc && base && JSON.stringify(doc) !== JSON.stringify(base), [doc, base]);

  // ── Cambios con historial ────────────────────────────────────────────────
  const cambiar = useCallback((fn, { historial = true } = {}) => {
    const actual = docRef.current;
    if (!actual) return;
    const siguiente = { ...actual, [estado]: fn(actual[estado]) };
    if (historial) setHist((h) => ({ pasado: [...h.pasado.slice(-HISTORIAL_MAX), actual], futuro: [] }));
    setDoc(siguiente);
  }, [estado]);

  const cambiarElemento = useCallback((id, patch, opts) => cambiar((p) => ({
    ...p, elementos: p.elementos.map((e) => (e.id === id ? { ...e, ...patch } : e)),
  }), opts), [cambiar]);

  const deshacer = useCallback(() => {
    const h = histRef.current;
    if (!h.pasado.length) return;
    setHist({ pasado: h.pasado.slice(0, -1), futuro: [docRef.current, ...h.futuro] });
    setDoc(h.pasado[h.pasado.length - 1]);
  }, []);
  const rehacer = useCallback(() => {
    const h = histRef.current;
    if (!h.futuro.length) return;
    const [prox, ...resto] = h.futuro;
    setHist({ pasado: [...h.pasado, docRef.current], futuro: resto });
    setDoc(prox);
  }, []);

  const accion = useCallback((tipo) => {
    const p = docRef.current?.[estado];
    const el = p?.elementos.find((e) => e.id === sel);
    if (!el) return;
    if (tipo === "borrar" && el.tipo !== "dato") {
      cambiar((q) => ({ ...q, elementos: q.elementos.filter((e) => e.id !== sel) }));
      setSel(null);
    } else if (tipo === "duplicar" && el.tipo !== "dato" && p.elementos.length < MAX_ELEMENTOS) {
      const copia = { ...el, id: nuevoId(), nombre: el.nombre ? `${el.nombre} (copia)` : "", x: el.x + 30, y: el.y + 30 };
      cambiar((q) => ({ ...q, elementos: [...q.elementos, copia] }));
      setSel(copia.id);
    } else if (tipo === "frente" || tipo === "fondo") {
      cambiar((q) => {
        const resto = q.elementos.filter((e) => e.id !== sel);
        return { ...q, elementos: tipo === "frente" ? [...resto, el] : [el, ...resto] };
      });
    }
  }, [estado, sel, cambiar]);

  const agregar = (el) => {
    if (pantalla.elementos.length >= MAX_ELEMENTOS) { setAviso({ ok: false, text: `Máximo ${MAX_ELEMENTOS} elementos por pantalla.` }); return; }
    const n = normalizarElemento(el);
    cambiar((p) => ({ ...p, elementos: [...p.elementos, n] }));
    setSel(n.id);
  };
  const agregarTexto = () => {
    const w = Math.round(ANCHO * 0.6), h = Math.round(ALTO * (cel ? 0.08 : 0.11));
    agregar({ id: nuevoId(), tipo: "texto", texto: "Texto nuevo", x: Math.round((ANCHO - w) / 2), y: Math.round((ALTO - h) / 2), w, h,
      estilo: { ...ESTILO_BASE, tamano: cel ? 22 : ESTILO_BASE.tamano } });
    setEnfocar((n) => n + 1);
  };
  const agregarForma = () => {
    const w = Math.round(ANCHO * 0.6), h = Math.round(ALTO * 0.2);
    agregar({ id: nuevoId(), tipo: "forma", nombre: "Forma", x: Math.round((ANCHO - w) / 2), y: Math.round((ALTO - h) / 2), w, h,
      radio: cel ? 16 : 24 });
  };

  const elegirImagen = (asset) => {
    const para = libPara;
    setLibPara(null);
    if (!asset?.file_url) return;
    if (para === "fondo") cambiar((p) => ({ ...p, fondo: { ...p.fondo, tipo: "imagen", imagen: asset.file_url } }));
    else if (para === "cambiar" && sel) cambiarElemento(sel, { src: asset.file_url });
    else {
      const ratio = asset.width && asset.height ? asset.width / asset.height : 16 / 9;
      const lado = cel ? 200 : 600;
      const w = ratio >= 1 ? lado : Math.round(lado * 0.66 * ratio);
      const h = ratio >= 1 ? Math.round(lado / ratio) : Math.round(lado * 0.66);
      agregar({ id: nuevoId(), tipo: "imagen", src: asset.file_url, nombre: (asset.name || "Imagen").slice(0, 40),
        x: Math.round((ANCHO - w) / 2), y: Math.round((ALTO - h) / 2), w, h, ajuste: "contain" });
    }
  };

  // ── Arrastre: mover y redimensionar ─────────────────────────────────────
  const empezar = (e, el, modo) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    setSel(el.id);
    zonaRef.current?.focus({ preventScroll: true });
    arrastre.current = { id: el.id, modo, x0: e.clientX, y0: e.clientY, orig: { x: el.x, y: el.y, w: el.w, h: el.h }, movido: false };
  };

  useEffect(() => {
    const mover = (e) => {
      const a = arrastre.current;
      if (!a || !escala) return;
      const dx = (e.clientX - a.x0) / escala;
      const dy = (e.clientY - a.y0) / escala;
      if (!a.movido) {
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
        a.movido = true;
        setHist((h) => ({ pasado: [...h.pasado.slice(-HISTORIAL_MAX), docRef.current], futuro: [] }));
      }
      const o = a.orig;
      let { x, y, w, h } = o;
      // Guías inteligentes (si están activas): bordes y centro de la pantalla y
      // de los demás elementos visibles. Si no engancha una guía y la
      // cuadrícula está activa, engancha a la cuadrícula. Alt = sin enganche.
      const libre = e.altKey;
      const umbral = IMAN_PX / escala;
      const otros = ayudas.guias
        ? (docRef.current?.[estadoRef.current]?.elementos || []).filter((q) => q.id !== a.id && q.visible) : [];
      const lineasV = ayudas.guias ? [0, ANCHO / 2, ANCHO, ...otros.flatMap((q) => [q.x, q.x + q.w / 2, q.x + q.w])] : [];
      const lineasH = ayudas.guias ? [0, ALTO / 2, ALTO, ...otros.flatMap((q) => [q.y, q.y + q.h / 2, q.y + q.h])] : [];
      const aGrilla = (v) => (ayudas.grilla ? Math.round(v / ayudas.paso) * ayudas.paso : v);
      const gv = [], gh = [];
      if (a.modo === "mover") {
        x = o.x + dx; y = o.y + dy;
        if (!libre) {
          const ev = enganchar([x, x + w / 2, x + w], lineasV, umbral);
          const eh = enganchar([y, y + h / 2, y + h], lineasH, umbral);
          if (ev) { x += ev.d; gv.push(ev.t); } else x = aGrilla(x);
          if (eh) { y += eh.d; gh.push(eh.t); } else y = aGrilla(y);
        }
      } else {
        if (a.modo.includes("e")) w = o.w + dx;
        if (a.modo.includes("s")) h = o.h + dy;
        if (a.modo.includes("w")) { w = o.w - dx; x = o.x + dx; }
        if (a.modo.includes("n")) { h = o.h - dy; y = o.y + dy; }
        if (e.shiftKey && a.modo.length === 2) {           // esquina + Shift: misma proporción
          const r = o.w / o.h;
          if (Math.abs(w - o.w) / o.w > Math.abs(h - o.h) / o.h) h = w / r; else w = h * r;
          if (a.modo.includes("w")) x = o.x + o.w - w;
          if (a.modo.includes("n")) y = o.y + o.h - h;
        }
        // Sólo enganchan los bordes que se están moviendo (con Shift en una
        // esquina manda la proporción, sin enganche).
        if (!libre && !(e.shiftKey && a.modo.length === 2)) {
          if (a.modo.includes("e")) { const g = enganchar([x + w], lineasV, umbral); if (g) { w += g.d; gv.push(g.t); } else w = aGrilla(x + w) - x; }
          if (a.modo.includes("w")) { const g = enganchar([x], lineasV, umbral); const nx = g ? x + g.d : aGrilla(x); w += x - nx; x = nx; if (g) gv.push(g.t); }
          if (a.modo.includes("s")) { const g = enganchar([y + h], lineasH, umbral); if (g) { h += g.d; gh.push(g.t); } else h = aGrilla(y + h) - y; }
          if (a.modo.includes("n")) { const g = enganchar([y], lineasH, umbral); const ny = g ? y + g.d : aGrilla(y); h += y - ny; y = ny; if (g) gh.push(g.t); }
        }
        if (w < 10) { if (a.modo.includes("w")) x -= 10 - w; w = 10; }
        if (h < 10) { if (a.modo.includes("n")) y -= 10 - h; h = 10; }
      }
      setGuias({ v: gv, h: gh });
      cambiarElemento(a.id, { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) }, { historial: false });
    };
    const soltar = () => { arrastre.current = null; setGuias({ v: [], h: [] }); };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", soltar);
    return () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
    };
  }, [escala, cambiarElemento, ayudas, ANCHO, ALTO]);

  // ── Teclado ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const tecla = (e) => {
      if (esCampo(e.target) || libPara) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) rehacer(); else deshacer(); return; }
      if (ctrl && e.key.toLowerCase() === "y") { e.preventDefault(); rehacer(); return; }
      if (!sel) return;
      const el = docRef.current?.[estado]?.elementos.find((x) => x.id === sel);
      if (!el) return;
      const paso = e.shiftKey ? 10 : 1;
      const mov = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] }[e.key];
      if (mov) { e.preventDefault(); cambiarElemento(sel, { x: el.x + mov[0], y: el.y + mov[1] }); return; }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); accion("borrar"); return; }
      if (ctrl && e.key.toLowerCase() === "d") { e.preventDefault(); accion("duplicar"); return; }
      if (e.key === "Escape") setSel(null);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [sel, estado, libPara, cambiarElemento, accion, deshacer, rehacer]);

  // ── Guardar / restablecer ───────────────────────────────────────────────
  const guardar = async () => {
    setGuardando(true); setAviso(null);
    try {
      await admin.guardar({ ...(admin.pantallas || {}), ...doc });
      setAviso({ ok: true, text: "Guardado. La TV lo toma en unos segundos." });
    } catch (e) { setAviso({ ok: false, text: e.message }); }
    finally { setGuardando(false); }
  };
  const restablecer = () => {
    if (!window.confirm("¿Volver esta pantalla al diseño original? Se pierden los cambios de esta pantalla (hasta que guardes podés deshacer).")) return;
    cambiar(() => normalizarPantalla(porDefecto[estado]));
    setSel(null);
  };

  if (admin.error) return <div className="card"><div role="alert" style={{ color: "#FCA5A5", fontSize: 12 }}>{admin.error}</div></div>;
  if (!pantalla) return <div className="card"><div style={nota}>Cargando el editor…</div></div>;

  const btn = { padding: "6px 12px", fontSize: 11.5 };

  // El lienzo editable (en el celular, va dentro del marco de la app).
  const lienzo = (
    <div ref={zonaRef} tabIndex={0} onPointerDown={() => setSel(null)}
      style={{ position: "relative", width: "100%", aspectRatio: `${ANCHO} / ${ALTO}`, overflow: "hidden", borderRadius: cel ? 4 : 10, outline: "none",
        border: cel ? "1px dashed rgba(0,229,255,.35)" : "1px solid rgba(240,232,255,.14)",
        boxShadow: cel ? "none" : "0 10px 40px rgba(0,0,0,.45)", background: "#000", touchAction: "none" }}>
      <FondoLienzo fondo={pantalla.fondo} transparente={fmt.transparente}/>
      {ayudas.grilla && escala > 0 && (
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1,
          backgroundImage: "linear-gradient(rgba(0,229,255,.22) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,.22) 1px, transparent 1px)",
          backgroundSize: `${ayudas.paso * escala}px ${ayudas.paso * escala}px` }}/>
      )}
      <div style={{ position: "absolute", left: 0, top: 0, width: ANCHO, height: ALTO, transformOrigin: "0 0", zIndex: 2,
        transform: `scale(${escala})`, visibility: escala ? "visible" : "hidden" }}>
        {pantalla.elementos.map((el, i) => (
          <ElementoLienzo key={el.id} el={el} datos={datos} z={i + 1}
            props={{
              onPointerDown: (e) => empezar(e, el, "mover"),
              onDoubleClick: () => { if (el.tipo === "texto") setEnfocar((n) => n + 1); },
              // Oculto: se ve translúcido y punteado para poder elegirlo y mostrarlo de nuevo.
              style: { cursor: "move", opacity: el.visible ? el.opacidad : el.opacidad * 0.25,
                outline: sel === el.id ? `${2 / (escala || 1)}px solid #FFD600`
                  : el.visible ? undefined : `${1.5 / (escala || 1)}px dashed rgba(240,232,255,.6)`,
                outlineOffset: 0 },
            }}>
            {sel === el.id && TIRADORES.map(([modo, l, t, cursor]) => (
              <span key={modo} onPointerDown={(e) => empezar(e, el, modo)}
                style={{ position: "absolute", left: `${l}%`, top: `${t}%`, width: 14 / (escala || 1), height: 14 / (escala || 1),
                  transform: "translate(-50%,-50%)", background: "#FFD600", border: `${1.5 / (escala || 1)}px solid #08040F`,
                  borderRadius: 3 / (escala || 1), cursor, zIndex: 5 }}/>
            ))}
          </ElementoLienzo>
        ))}
        {guias.v.map((t) => <div key={`v${t}`} style={{ position: "absolute", left: t, top: 0, bottom: 0, width: 1.5 / (escala || 1), transform: "translateX(-50%)", background: "#FF2D78", boxShadow: "0 0 6px #FF2D78", pointerEvents: "none", zIndex: 999 }}/>)}
        {guias.h.map((t) => <div key={`h${t}`} style={{ position: "absolute", top: t, left: 0, right: 0, height: 1.5 / (escala || 1), transform: "translateY(-50%)", background: "#FF2D78", boxShadow: "0 0 6px #FF2D78", pointerEvents: "none", zIndex: 999 }}/>)}
      </div>
    </div>
  );

  return (
    <div>
      <style>{LIENZO_CSS}</style>
      {/* Barra: pantallas del juego + herramientas */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {listaPantallas.map((p) => (
          <button key={p.id} type="button" className="btn" onClick={() => { setEstado(p.id); setSel(null); }}
            style={{ ...btn, background: estado === p.id ? "rgba(155,47,255,.28)" : "rgba(240,232,255,.04)",
              border: `1px solid ${estado === p.id ? "#9B2FFF" : "rgba(240,232,255,.14)"}`, color: "#F0E8FF" }}>
            {p.nombre}
          </button>
        ))}
        <span style={{ width: 1, alignSelf: "stretch", background: "rgba(240,232,255,.14)" }}/>
        <button type="button" className="btn btn-g" style={btn} onClick={agregarTexto}>+ Texto</button>
        <button type="button" className="btn btn-g" style={btn} onClick={() => setLibPara("nueva")}>+ Imagen</button>
        <button type="button" className="btn btn-g" style={btn} onClick={agregarForma} title="Rectángulo: tarjetas, botones dibujados, separadores">+ Forma</button>
        <button type="button" className="btn btn-g" style={btn} onClick={() => { setSel(null); }}>Fondo</button>
        <span style={{ width: 1, alignSelf: "stretch", background: "rgba(240,232,255,.14)" }}/>
        <button type="button" className="btn btn-g" style={btn} onClick={deshacer} disabled={!hist.pasado.length} title="Ctrl+Z">↶ Deshacer</button>
        <button type="button" className="btn btn-g" style={btn} onClick={rehacer} disabled={!hist.futuro.length} title="Ctrl+Y">↷ Rehacer</button>
        <button type="button" className="btn btn-g" style={btn} onClick={restablecer}>Diseño original</button>
        <span style={{ width: 1, alignSelf: "stretch", background: "rgba(240,232,255,.14)" }}/>
        <button type="button" className="btn" onClick={() => cambiarAyudas({ guias: !ayudas.guias })} aria-pressed={ayudas.guias}
          title="Líneas que marcan la alineación con la pantalla y los demás elementos al mover"
          style={{ ...btn, background: ayudas.guias ? "#FF2D7829" : "rgba(240,232,255,.04)",
            border: `1px solid ${ayudas.guias ? "#FF2D78" : "rgba(240,232,255,.14)"}`, color: ayudas.guias ? "#FF2D78" : "#F0E8FF" }}>
          {ayudas.guias ? "✓ " : ""}Guías
        </button>
        <button type="button" className="btn" onClick={() => cambiarAyudas({ grilla: !ayudas.grilla })} aria-pressed={ayudas.grilla}
          title="Cuadrícula para alinear (los elementos se enganchan a ella)"
          style={{ ...btn, background: ayudas.grilla ? "#00E5FF29" : "rgba(240,232,255,.04)",
            border: `1px solid ${ayudas.grilla ? "#00E5FF" : "rgba(240,232,255,.14)"}`, color: ayudas.grilla ? "#00E5FF" : "#F0E8FF" }}>
          {ayudas.grilla ? "✓ " : ""}Cuadrícula
        </button>
        {ayudas.grilla && (
          <select className="inp" value={ayudas.paso} onChange={(e) => cambiarAyudas({ paso: Number(e.target.value) })}
            aria-label="Tamaño de la cuadrícula" style={{ margin: 0, padding: "5px 6px", width: 76 }}>
            {[...new Set([...grillas, ayudas.paso])].sort((a, b) => a - b).map((g) => <option key={g} value={g}>{g} px</option>)}
          </select>
        )}
        <span style={{ flex: 1 }}/>
        {aviso && <span role={aviso.ok ? "status" : "alert"} style={{ fontSize: 11, color: aviso.ok ? "#00F5A0" : "#FCA5A5" }}>{aviso.text}</span>}
        {sucio && !aviso && <span style={{ ...nota, color: "#FFD600" }}>Cambios sin guardar</span>}
        <button type="button" className="btn btn-p" style={{ ...btn, padding: "7px 16px" }} disabled={!sucio || guardando} onClick={guardar}>
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 330px", gap: 14, alignItems: "start" }}>
        {/* Lienzo (celular: del ancho de un teléfono, centrado) */}
        <div style={cel ? { width: "100%", maxWidth: 420, justifySelf: "center" } : undefined}>
          {/* Celular: el lienzo va dentro del marco de la app (logo, campana y
              navegación, como los ve el cliente); el marco no se edita. */}
          {cel ? <MarcoCelular>{lienzo}</MarcoCelular> : lienzo}
          <div style={{ ...nota, marginTop: 6 }}>
            Clic para elegir · arrastrá para mover (Guías: líneas rosas de alineación; Alt = sin enganche) · tiradores para el tamaño (Shift = misma proporción) · flechas para mover de a 1 px (Shift = 10) ·
            Supr borra · Ctrl+D duplica · Ctrl+Z deshace · doble clic en un texto para escribir. Las fichas muestran una palabra de ejemplo.
          </div>
        </div>

        {/* Propiedades */}
        <div className="card" style={{ maxHeight: "calc(100vh - 190px)", overflowY: "auto", margin: 0 }}>
          <PanelPropiedades pantalla={pantalla} sel={sel} enfocarTexto={enfocar} formato={fmt}
            onCambiarElemento={cambiarElemento}
            onCambiarFondo={(fondo) => cambiar((p) => ({ ...p, fondo }))}
            onAccion={accion} onElegir={setSel} onPedirImagen={setLibPara}/>
        </div>
      </div>

      <MediaLibraryModal open={!!libPara} onClose={() => setLibPara(null)} onSelect={elegirImagen}
        title={libPara === "fondo" ? "Imagen de fondo (ideal 1920 × 1080)" : "Imagen"}/>
    </div>
  );
}
