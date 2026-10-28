import { useEffect, useState } from "react";
import { useFrasesAnfitrion, TIPOS_FRASE, FRASE_MAX, NOMBRE_BIBLIOTECA_MAX } from "../../hooks/realtime/useFrasesAnfitrion";

/**
 * Ajustes → General: bibliotecas de frases del Anfitrión. Cada biblioteca
 * tiene su aliento (para el que va ganando) y su desaliento (para el que va
 * perdiendo). Se marcan una o varias «en uso» y la tablet las mezcla. Una
 * biblioteca nueva se arma de cero o copiando frases de las otras. Sirven en
 * todos los juegos con participante (Duelo, Follow the Leader, Personal
 * Trainer) y se prenden o apagan con la opción «Frases del Anfitrión».
 */

const TIPO = {
  aliento:    { titulo: "💪 Aliento",    sub: "Para el que va ganando", col: "#00F5A0" },
  desaliento: { titulo: "😈 Desaliento", sub: "Para el que va perdiendo", col: "#FF2D78" },
};

export default function FrasesAnfitrion({ puedeEditar, activas }) {
  const h = useFrasesAnfitrion();
  const { bibliotecas, frases, cargando, error, enUso, recargar } = h;
  const [abiertaId, setAbiertaId] = useState(null);
  const [nueva, setNueva] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  // Arranca abierta la primera en uso (o la primera); si la abierta se borra, vuelve ahí.
  useEffect(() => {
    if (bibliotecas.some((b) => b.id === abiertaId)) return;
    setAbiertaId((bibliotecas.find((b) => b.activa) || bibliotecas[0])?.id ?? null);
  }, [bibliotecas, abiertaId]);

  const correr = async (fn) => {
    if (busy) return;
    setBusy(true); setErr(null);
    try { await fn(); } catch (e) { setErr(e?.message || String(e)); } finally { setBusy(false); }
  };

  if (error) return (
    <div role="alert" style={{ fontSize: 12.5, color: "#FCA5A5" }}>
      {error}{" "}
      <button type="button" className="btn btn-g" style={{ padding: "5px 10px", fontSize: 10, marginLeft: 8 }} onClick={recargar}>Reintentar</button>
    </div>
  );
  if (cargando) return <div style={{ fontSize: 12, color: "rgba(240,232,255,.45)" }}>Cargando frases…</div>;

  const abierta = bibliotecas.find((b) => b.id === abiertaId) || null;
  const enUsoNombres = bibliotecas.filter((b) => b.activa).map((b) => b.nombre);
  const cuantas = (id, tipo) => frases.filter((f) => f.biblioteca_id === id && (!tipo || f.tipo === tipo)).length;

  return (
    <div className="frases" style={{ opacity: activas ? 1 : .6 }}>
      <style>{CSS}</style>
      <div className="frases-resumen">
        {!activas ? "Las frases están apagadas: la tablet no las muestra. Podés seguir editando las bibliotecas."
          : enUsoNombres.length
            ? <>La tablet usa <b>{enUsoNombres.join(" + ")}</b>: {enUso.aliento.length} de aliento y {enUso.desaliento.length} de desaliento, mezcladas al azar.</>
            : <>Ninguna biblioteca está en uso: marcá al menos una para que la tablet muestre frases.</>}
      </div>

      {/* Solapas: tocar abre la biblioteca; la casilla la pone o la saca de uso. */}
      <div className="frases-libs" role="tablist">
        {bibliotecas.map((b) => (
          <div key={b.id} className={`frases-lib-tab${b.id === abiertaId ? " sel" : ""}${b.activa ? " uso" : ""}`}>
            <label title={b.activa ? "En uso: la tablet la usa" : "No se usa"} onClick={(e) => e.stopPropagation()}>
              <input type="checkbox" checked={b.activa} disabled={!puedeEditar || busy}
                onChange={(e) => correr(() => h.usarBiblioteca(b.id, e.target.checked))}/>
            </label>
            <button type="button" role="tab" aria-selected={b.id === abiertaId} onClick={() => setAbiertaId(b.id)}>
              {b.nombre} <small>{cuantas(b.id)}</small>
            </button>
          </div>
        ))}
        {puedeEditar && (
          <div className="frases-lib-nueva">
            <input className="inp" value={nueva} maxLength={NOMBRE_BIBLIOTECA_MAX} placeholder="Nueva biblioteca…"
              onChange={(e) => setNueva(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && nueva.trim()) correr(async () => { setAbiertaId(await h.crearBiblioteca(nueva)); setNueva(""); }); }}/>
            <button type="button" className="btn btn-p" disabled={busy || !nueva.trim()}
              onClick={() => correr(async () => { setAbiertaId(await h.crearBiblioteca(nueva)); setNueva(""); })}>+ Crear</button>
          </div>
        )}
      </div>
      {err && <div className="frases-err">{err}</div>}

      {abierta && (
        <div className="frases-hoja">
          <CabeceraBiblioteca biblioteca={abierta} total={cuantas(abierta.id)} puedeEditar={puedeEditar} busy={busy} correr={correr}
            renombrar={h.renombrarBiblioteca} usar={h.usarBiblioteca} eliminar={h.eliminarBiblioteca}/>
          <div className="frases-cols">
            {TIPOS_FRASE.map((t) => (
              <Lista key={t} tipo={t} frases={frases.filter((f) => f.biblioteca_id === abierta.id && f.tipo === t)}
                puedeEditar={puedeEditar} agregar={(texto) => h.agregar(abierta.id, t, texto)} editar={h.editar} eliminar={h.eliminar}/>
            ))}
          </div>
          {puedeEditar && bibliotecas.length > 1 && (
            <Armador destino={abierta} bibliotecas={bibliotecas.filter((b) => b.id !== abierta.id)} frases={frases}
              copiar={(ids) => h.copiar(abierta.id, ids)}/>
          )}
        </div>
      )}
    </div>
  );
}

function CabeceraBiblioteca({ biblioteca, total, puedeEditar, busy, correr, renombrar, usar, eliminar }) {
  const [nombre, setNombre] = useState(null);   // null = no se está renombrando
  return (
    <div className="frases-hoja-cab">
      {nombre == null ? (
        <strong>{biblioteca.nombre}</strong>
      ) : (
        <input className="inp" value={nombre} maxLength={NOMBRE_BIBLIOTECA_MAX} autoFocus
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") correr(async () => { await renombrar(biblioteca.id, nombre); setNombre(null); });
            if (e.key === "Escape") setNombre(null);
          }}/>
      )}
      <span className={`frases-uso${biblioteca.activa ? " on" : ""}`}>{biblioteca.activa ? "● En uso" : "○ Sin usar"}</span>
      {puedeEditar && (<>
        <button type="button" className="btn btn-g" disabled={busy} onClick={() => correr(() => usar(biblioteca.id, !biblioteca.activa))}>
          {biblioteca.activa ? "Dejar de usar" : "Usar en la tablet"}
        </button>
        {nombre == null
          ? <button type="button" className="btn btn-g" disabled={busy} onClick={() => setNombre(biblioteca.nombre)}>✏️ Renombrar</button>
          : <button type="button" className="btn btn-g" disabled={busy}
              onClick={() => correr(async () => { await renombrar(biblioteca.id, nombre); setNombre(null); })}>✓ Guardar</button>}
        <button type="button" className="btn btn-r" disabled={busy}
          onClick={() => { if (window.confirm(`¿Borrar la biblioteca «${biblioteca.nombre}» y sus ${total} frases?`)) correr(() => eliminar(biblioteca.id)); }}>
          🗑️ Borrar
        </button>
      </>)}
    </div>
  );
}

function Lista({ tipo, frases, puedeEditar, agregar, editar, eliminar }) {
  const cfg = TIPO[tipo];
  const [nueva, setNueva] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState(null);   // { id, texto }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const correr = async (fn) => {
    if (busy) return;
    setBusy(true); setErr(null);
    try { await fn(); } catch (e) { setErr(e?.message || String(e)); } finally { setBusy(false); }
  };
  const filtro = busqueda.trim().toLowerCase();
  const visibles = filtro ? frases.filter((f) => f.texto.toLowerCase().includes(filtro)) : frases;

  return (
    <div className="frases-lista-box" style={{ "--fc": cfg.col }}>
      <div className="frases-cab">
        <strong>{cfg.titulo}</strong>
        <span>{cfg.sub} · {frases.length}</span>
      </div>
      {puedeEditar && (
        <div className="frases-alta">
          <input className="inp" value={nueva} maxLength={FRASE_MAX} placeholder="Nueva frase…"
            onChange={(e) => setNueva(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") correr(async () => { await agregar(nueva); setNueva(""); }); }}/>
          <button type="button" className="btn btn-p" disabled={busy || !nueva.trim()}
            onClick={() => correr(async () => { await agregar(nueva); setNueva(""); })}>+ Agregar</button>
        </div>
      )}
      {frases.length > 6 && (
        <input className="inp frases-buscar" value={busqueda} placeholder="🔎 Buscar…" onChange={(e) => setBusqueda(e.target.value)}/>
      )}
      {err && <div className="frases-err">{err}</div>}
      <div className="frases-lista">
        {!frases.length && <div className="frases-vacio">Todavía no hay frases.</div>}
        {visibles.map((f) => editando?.id === f.id ? (
          <div key={f.id} className="frases-row edit">
            <input className="inp" value={editando.texto} maxLength={FRASE_MAX} autoFocus
              onChange={(e) => setEditando({ id: f.id, texto: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") correr(async () => { await editar(f.id, editando.texto); setEditando(null); });
                if (e.key === "Escape") setEditando(null);
              }}/>
            <button type="button" className="btn btn-g" disabled={busy}
              onClick={() => correr(async () => { await editar(f.id, editando.texto); setEditando(null); })}>✓</button>
            <button type="button" className="btn btn-r" onClick={() => setEditando(null)}>✕</button>
          </div>
        ) : (
          <div key={f.id} className="frases-row">
            <span>{f.texto}</span>
            {puedeEditar && (<>
              <button type="button" title="Editar" disabled={busy} onClick={() => setEditando({ id: f.id, texto: f.texto })}>✏️</button>
              <button type="button" title="Borrar" disabled={busy}
                onClick={() => { if (window.confirm(`¿Borrar esta frase?\n\n${f.texto}`)) correr(() => eliminar(f.id)); }}>🗑️</button>
            </>)}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Armar la biblioteca abierta con frases elegidas de las otras (se copian; las originales quedan). */
function Armador({ destino, bibliotecas, frases, copiar }) {
  const [abierto, setAbierto] = useState(false);
  const [origenId, setOrigenId] = useState(bibliotecas[0]?.id ?? null);
  const [sel, setSel] = useState([]);
  const [busy, setBusy] = useState(false);
  const [nota, setNota] = useState(null);
  useEffect(() => { setSel([]); setNota(null); }, [destino.id]);
  useEffect(() => { if (!bibliotecas.some((b) => b.id === origenId)) setOrigenId(bibliotecas[0]?.id ?? null); }, [bibliotecas, origenId]);

  const yaTiene = new Set(frases.filter((f) => f.biblioteca_id === destino.id).map((f) => `${f.tipo}|${f.texto.toLowerCase()}`));
  const delOrigen = frases.filter((f) => f.biblioteca_id === origenId);
  const alternar = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const agregarSel = async () => {
    setBusy(true); setNota(null);
    try {
      const n = await copiar(sel);
      setSel([]);
      setNota({ ok: true, texto: n ? `✅ ${n} ${n === 1 ? "frase agregada" : "frases agregadas"} a «${destino.nombre}».` : "Esas frases ya estaban en la biblioteca." });
    } catch (e) { setNota({ ok: false, texto: e?.message || String(e) }); }
    finally { setBusy(false); }
  };

  return (
    <div className="frases-armador">
      <button type="button" className="frases-armador-t" onClick={() => setAbierto((a) => !a)}>
        {abierto ? "▾" : "▸"} 🧩 Sumar a «{destino.nombre}» frases de otras bibliotecas
      </button>
      {abierto && (<>
        <div className="frases-armador-origen">
          {bibliotecas.map((b) => (
            <button key={b.id} type="button" className={`btn ${b.id === origenId ? "btn-p" : "btn-g"}`} onClick={() => setOrigenId(b.id)}>{b.nombre}</button>
          ))}
        </div>
        <div className="frases-cols">
          {TIPOS_FRASE.map((t) => {
            const lista = delOrigen.filter((f) => f.tipo === t);
            const libres = lista.filter((f) => !yaTiene.has(`${f.tipo}|${f.texto.toLowerCase()}`));
            const todas = libres.length > 0 && libres.every((f) => sel.includes(f.id));
            return (
              <div key={t} className="frases-lista-box" style={{ "--fc": TIPO[t].col }}>
                <div className="frases-cab">
                  <strong>{TIPO[t].titulo}</strong>
                  {libres.length > 0 && (
                    <button type="button" className="frases-todas"
                      onClick={() => setSel((s) => todas ? s.filter((id) => !libres.some((f) => f.id === id)) : [...new Set([...s, ...libres.map((f) => f.id)])])}>
                      {todas ? "Ninguna" : "Todas"}
                    </button>
                  )}
                </div>
                <div className="frases-lista">
                  {!lista.length && <div className="frases-vacio">Sin frases.</div>}
                  {lista.map((f) => {
                    const esta = yaTiene.has(`${f.tipo}|${f.texto.toLowerCase()}`);
                    return (
                      <label key={f.id} className={`frases-row elegir${esta ? " ya" : ""}`}>
                        <input type="checkbox" disabled={esta} checked={esta || sel.includes(f.id)} onChange={() => alternar(f.id)}/>
                        <span>{f.texto}</span>
                        {esta && <em>ya está</em>}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="frases-armador-pie">
          <button type="button" className="btn btn-p" disabled={busy || !sel.length} onClick={agregarSel}>
            + Agregar {sel.length || ""} {sel.length === 1 ? "frase" : "frases"} a «{destino.nombre}»
          </button>
          {nota && <span style={{ color: nota.ok ? "#00F5A0" : "#FCA5A5" }}>{nota.texto}</span>}
        </div>
      </>)}
    </div>
  );
}

const CSS = `
  .frases{display:flex;flex-direction:column;gap:10px;}
  .frases-resumen{font-size:12px;color:rgba(240,232,255,.55);line-height:1.5;}
  .frases-resumen b{color:#F0E8FF;}
  .frases-libs{display:flex;flex-wrap:wrap;align-items:center;gap:6px;}
  .frases-lib-tab{display:flex;align-items:center;gap:2px;padding:0 4px 0 8px;border-radius:999px;
    background:rgba(240,232,255,.04);border:1px solid rgba(240,232,255,.12);}
  .frases-lib-tab.uso{border-color:rgba(0,245,160,.45);}
  .frases-lib-tab.sel{background:rgba(155,47,255,.16);border-color:#9B2FFF;}
  .frases-lib-tab label{display:flex;cursor:pointer;}
  .frases-lib-tab input{accent-color:#00F5A0;width:15px;height:15px;cursor:pointer;}
  .frases-lib-tab button{background:none;border:0;color:#F0E8FF;font:700 12.5px 'DM Sans',sans-serif;padding:8px 8px 8px 4px;cursor:pointer;}
  .frases-lib-tab small{color:rgba(240,232,255,.4);font-weight:600;margin-left:3px;}
  .frases-lib-nueva{display:flex;gap:6px;}
  .frases-lib-nueva .inp{margin:0;width:170px;}
  .frases-lib-nueva .btn{padding:6px 12px;font-size:11px;}
  .frases-hoja{padding:14px;border-radius:14px;background:rgba(240,232,255,.02);border:1px solid rgba(155,47,255,.3);display:flex;flex-direction:column;gap:12px;}
  .frases-hoja-cab{display:flex;flex-wrap:wrap;align-items:center;gap:8px;}
  .frases-hoja-cab strong{font-size:15px;margin-right:4px;}
  .frases-hoja-cab .inp{margin:0;width:200px;}
  .frases-hoja-cab .btn{padding:5px 10px;font-size:10.5px;}
  .frases-uso{font-size:10px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:rgba(240,232,255,.4);margin-right:auto;}
  .frases-uso.on{color:#00F5A0;}
  .frases-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;}
  .frases-lista-box{padding:12px;border-radius:12px;background:rgba(240,232,255,.03);border:1px solid var(--fc);}
  .frases-cab{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:10px;}
  .frases-cab strong{font-size:13.5px;color:var(--fc);}
  .frases-cab span{font-size:11px;color:rgba(240,232,255,.45);}
  .frases-alta{display:flex;gap:6px;margin-bottom:8px;}
  .frases-alta .inp{flex:1;margin:0;}
  .frases-alta .btn{padding:6px 12px;font-size:11px;white-space:nowrap;}
  .frases-buscar{width:100%;margin:0 0 8px;}
  .frases-err{font-size:11px;color:#FCA5A5;}
  .frases-lista{max-height:320px;overflow-y:auto;display:flex;flex-direction:column;gap:5px;}
  .frases-vacio{font-size:11.5px;color:rgba(240,232,255,.35);padding:8px 0;}
  .frases-row{display:flex;align-items:center;gap:6px;padding:7px 9px;border-radius:9px;font-size:12px;line-height:1.45;
    background:rgba(240,232,255,.04);border:1px solid rgba(240,232,255,.07);}
  .frases-row > span{flex:1;min-width:0;}
  .frases-row > button:not(.btn){flex-shrink:0;padding:3px 6px;font-size:11px;border-radius:7px;cursor:pointer;
    background:transparent;border:1px solid rgba(240,232,255,.12);}
  .frases-row.edit .inp{flex:1;margin:0;}
  .frases-row.edit .btn{padding:5px 9px;font-size:11px;}
  .frases-row.elegir{cursor:pointer;}
  .frases-row.elegir input{accent-color:var(--fc);flex-shrink:0;}
  .frases-row.ya{opacity:.45;cursor:default;}
  .frases-row em{font-style:normal;font-size:10px;color:rgba(240,232,255,.5);flex-shrink:0;}
  .frases-todas{background:none;border:0;color:var(--fc);font:700 11px 'DM Sans',sans-serif;cursor:pointer;}
  .frases-armador{border-top:1px solid rgba(240,232,255,.08);padding-top:10px;display:flex;flex-direction:column;gap:10px;}
  .frases-armador-t{align-self:flex-start;background:none;border:0;color:#C4B5FD;font:700 12.5px 'DM Sans',sans-serif;cursor:pointer;padding:0;}
  .frases-armador-origen{display:flex;flex-wrap:wrap;gap:6px;}
  .frases-armador-origen .btn{padding:5px 12px;font-size:11px;}
  .frases-armador-pie{display:flex;flex-wrap:wrap;align-items:center;gap:10px;font-size:11.5px;}
  .frases-armador-pie .btn{padding:7px 14px;font-size:11.5px;}
`;
