import { useEffect, useId, useRef, useState } from "react";
import { leerArchivo, esCsv, descargarEjemplo, normalizarSeccion, SECCION_MAX } from "./importar";

/**
 * Piezas compartidas por las bibliotecas de Arma la Palabra y Desafío:
 * el filtro por sección, el campo de sección y el modal de importación.
 */

export const TODAS = "__todas";
export const SIN_SECCION = "__sin";

/** ¿La fila entra en el filtro elegido? */
export const enSeccion = (fila, filtro) =>
  filtro === TODAS || (filtro === SIN_SECCION ? !fila.seccion : fila.seccion === filtro);

/** ¿El filtro elegido todavía tiene algo? (una sección vacía deja de existir). */
export const enSeccionValida = (filtro, nombres, sinSeccion) =>
  filtro === TODAS || (filtro === SIN_SECCION ? sinSeccion > 0 : nombres.includes(filtro));

/** Sección para lo nuevo: la del filtro si es una sección con nombre. */
export const seccionDelFiltro = (filtro) => (filtro === TODAS || filtro === SIN_SECCION ? null : filtro);

/**
 * Menú desplegable de secciones: Todas · Animales (12) · Comidas (8) ·
 * Sin sección (3). Desplegable y no pastillas: con muchas secciones la fila
 * no entraba y había que deslizarla para descubrirlas.
 * No se muestra mientras no haya ninguna sección con nombre.
 */
export function FiltroSecciones({ secciones, sinSeccion, total, valor, onCambiar, color = "#A855F7" }) {
  if (!secciones.length) return null;
  const filtrando = valor !== TODAS;
  return (
    <label className="bib-secs">
      <span className="bib-secs-t">📂 Sección</span>
      <select className="bib-sec-sel" value={valor} onChange={(e) => onCambiar(e.target.value)}
        style={filtrando ? { borderColor: color, backgroundColor: `${color}1f` } : undefined}>
        <option value={TODAS}>Todas las secciones ({total})</option>
        {secciones.map((s) => <option key={s.nombre} value={s.nombre}>{s.nombre} ({s.cuantos})</option>)}
        {sinSeccion > 0 && <option value={SIN_SECCION}>Sin sección ({sinSeccion})</option>}
      </select>
    </label>
  );
}

/** Input de sección con las existentes como sugerencia. Vacío = sin sección. */
export function CampoSeccion({ valor, onCambiar, secciones, style, autoFocus }) {
  const id = useId();
  return (
    <>
      <input className="inp" list={id} value={valor} maxLength={SECCION_MAX} autoFocus={autoFocus}
        placeholder="Sección (opcional)" style={{ margin: 0, ...style }}
        onChange={(e) => onCambiar(e.target.value)}/>
      <datalist id={id}>{secciones.map((s) => <option key={s.nombre} value={s.nombre}/>)}</datalist>
    </>
  );
}

/** CSS de las piezas de arriba; va dentro del CSS del Admin. */
export const CSS_SECCIONES = `
  .bib-secs{display:flex;align-items:center;gap:8px;margin:0 0 8px;}
  .bib-secs-t{flex-shrink:0;font-size:10.5px;font-weight:700;color:rgba(240,232,255,.5);}
  .bib-sec-sel{flex:1;min-width:0;height:34px;padding:0 30px 0 10px;border-radius:10px;cursor:pointer;
    font:700 12px 'DM Sans',sans-serif;color:#F0E8FF;appearance:none;-webkit-appearance:none;
    background-color:rgba(240,232,255,.05);border:1px solid rgba(240,232,255,.16);
    background-image:linear-gradient(45deg,transparent 50%,rgba(240,232,255,.6) 50%),
      linear-gradient(135deg,rgba(240,232,255,.6) 50%,transparent 50%);
    background-position:calc(100% - 15px) 50%,calc(100% - 10px) 50%;
    background-size:5px 5px,5px 5px;background-repeat:no-repeat;}
  .bib-sec-sel option{background:#1A0D2E;color:#F0E8FF;}
  .bib-tag{display:inline-block;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    vertical-align:middle;padding:1px 6px;border-radius:6px;font-size:9px;font-weight:700;
    color:rgba(240,232,255,.5);background:rgba(240,232,255,.06);border:1px solid rgba(240,232,255,.1);}
  .bib-imp-res{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0;}
  .bib-imp-res > div{padding:10px;border-radius:11px;text-align:center;background:rgba(240,232,255,.04);
    border:1px solid rgba(240,232,255,.08);}
  .bib-imp-res b{display:block;font:700 22px 'DM Sans',sans-serif;}
  .bib-imp-res small{font-size:10px;color:rgba(240,232,255,.45);}
  .anf .bib-sec-sel{height:46px;font-size:15px;}
  .anf .bib-secs-t{font-size:13px;}
`;

/**
 * Importar .txt / .csv. Pasos: elegir archivo → ver el resumen (nuevas,
 * repetidas, con error) → importar. `parsear(texto, csv, seccionPorDefecto)`
 * devuelve {items, repetidas, errores}; `onImportar(items)` hace el INSERT y
 * devuelve {agregadas, repetidas}.
 */
export function ImportarModal({ titulo, formato, ejemplo, secciones, seccionInicial, parsear, onImportar, onCerrar }) {
  const [seccion, setSeccion] = useState(seccionInicial || "");
  const [archivo, setArchivo] = useState(null);   // {nombre, texto, csv}
  const [importando, setImportando] = useState(false);
  const [error, setError] = useState(null);
  const [hecho, setHecho] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !importando) onCerrar(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [importando, onCerrar]);

  const elegir = async (file) => {
    setError(null); setHecho(null);
    if (!file) return;
    if (!/\.(txt|csv)$/i.test(file.name)) { setError("El archivo tiene que ser .txt o .csv."); return; }
    try { setArchivo({ nombre: file.name, texto: await leerArchivo(file), csv: esCsv(file) }); }
    catch { setError("No pudimos leer el archivo."); }
  };

  // Se recalcula al cambiar la sección por defecto: es la que reciben las
  // filas que no traen una propia.
  const res = archivo ? parsear(archivo.texto, archivo.csv, normalizarSeccion(seccion)) : null;

  const importar = async () => {
    if (!res?.items.length || importando) return;
    setImportando(true); setError(null);
    try { setHecho(await onImportar(res.items)); setArchivo(null); }
    catch (e) { setError(e?.message || "No pudimos importar."); }
    finally { setImportando(false); }
  };

  return (
    <div className="dd-modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget && !importando) onCerrar(); }}>
      <div className="dd-modal" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="dd-modal-t">📥 {titulo}</div>

        <div style={{ fontSize: 11, color: "rgba(240,232,255,.55)", lineHeight: 1.55, marginBottom: 10 }}>
          <div style={{ marginBottom: 5 }}><b style={{ color: "#F0E8FF" }}>.txt</b> — {formato.txt}</div>
          <div><b style={{ color: "#F0E8FF" }}>.csv</b> — {formato.csv}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 7 }}>
            <button type="button" className="dd-lib-link" onClick={() => descargarEjemplo(`${ejemplo}.txt`, formato.ejemploTxt)}>⬇ Ejemplo .txt</button>
            <button type="button" className="dd-lib-link" onClick={() => descargarEjemplo(`${ejemplo}.csv`, formato.ejemploCsv)}>⬇ Ejemplo .csv</button>
          </div>
        </div>

        <div className="ctitle">Sección para las que no traen una</div>
        <CampoSeccion valor={seccion} onCambiar={setSeccion} secciones={secciones} style={{ width: "100%", marginBottom: 10 }}/>

        <input ref={inputRef} type="file" accept=".txt,.csv,text/plain,text/csv" hidden
          onChange={(e) => { elegir(e.target.files?.[0]); e.target.value = ""; }}/>
        <button type="button" className="btn btn-g btn-full" disabled={importando}
          onClick={() => inputRef.current?.click()}>
          {archivo ? `📄 ${archivo.nombre} · cambiar` : "📄 Elegir archivo .txt o .csv"}
        </button>

        {res && (
          <>
            <div className="bib-imp-res">
              <div><b style={{ color: "#00F5A0" }}>{res.items.length}</b><small>nuevas</small></div>
              <div><b style={{ color: "#FFD600" }}>{res.repetidas.length}</b><small>ya estaban</small></div>
              <div><b style={{ color: res.errores.length ? "#FF2D78" : "rgba(240,232,255,.3)" }}>{res.errores.length}</b><small>con error</small></div>
            </div>
            {res.errores.length > 0 && (
              <div style={{ maxHeight: 130, overflowY: "auto", fontSize: 10.5, lineHeight: 1.5, color: "#FCA5A5",
                padding: "8px 10px", borderRadius: 10, background: "rgba(255,45,120,.06)",
                border: "1px solid rgba(255,45,120,.2)", marginBottom: 10 }}>
                {res.errores.slice(0, 50).map((e, i) => (
                  <div key={i}>Línea {e.linea} · <b>{e.texto}</b> — {e.motivo}</div>
                ))}
                {res.errores.length > 50 && <div>… y {res.errores.length - 50} más.</div>}
              </div>
            )}
            {res.items.length > 0 && (() => {
              const porSeccion = new Map();
              res.items.forEach((it) => porSeccion.set(it.seccion || "Sin sección", (porSeccion.get(it.seccion || "Sin sección") || 0) + 1));
              return (
                <div style={{ fontSize: 10.5, color: "rgba(240,232,255,.5)", marginBottom: 10, lineHeight: 1.6 }}>
                  {[...porSeccion.entries()].map(([s, n]) => (
                    <span key={s} className="bib-tag" style={{ marginRight: 5, maxWidth: "none" }}>{s} · {n}</span>
                  ))}
                </div>
              );
            })()}
          </>
        )}

        {hecho && (
          <div style={{ fontSize: 11.5, color: "#00F5A0", fontWeight: 700, margin: "10px 0", lineHeight: 1.5 }}>
            ✓ {hecho.agregadas} {hecho.agregadas === 1 ? "agregada" : "agregadas"} a la biblioteca
            {hecho.repetidas ? ` · ${hecho.repetidas} ya estaban` : ""}.
          </div>
        )}
        {error && <div style={{ fontSize: 10.5, color: "#FCA5A5", margin: "8px 0", lineHeight: 1.5 }}>{error}</div>}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
          <button className="btn btn-g" style={{ padding: "8px 16px", fontSize: 11 }} disabled={importando} onClick={onCerrar}>
            {hecho ? "Listo" : "Cancelar"}
          </button>
          <button className="btn btn-p" style={{ padding: "8px 16px", fontSize: 11 }}
            disabled={!res?.items.length || importando} onClick={importar}>
            {importando ? "Importando…" : `Importar ${res?.items.length || ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
