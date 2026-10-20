import { useEffect, useState } from "react";

/**
 * Panel «Sets guardados» del Editor (como en el original).
 *
 *   · Sin set → entran a la votación todas las canciones habilitadas.
 *   · Un set activo → sólo sus canciones (lo aplica el servidor: las candidatas
 *     de afuera salen en el acto, la que suena no se toca).
 *   · Crear un set con las canciones seleccionadas en la lista.
 */
export default function SetsGuardados({ sets, activoId, seleccionadas, ocupado, onActivar, onCrear, onBorrar, onCerrar }) {
  const [nombre, setNombre] = useState("");

  useEffect(() => {
    const esc = (e) => { if (e.key === "Escape") onCerrar(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onCerrar]);

  const crear = () => {
    const n = nombre.trim();
    if (!n || !seleccionadas) return;
    onCrear(n);
    setNombre("");
  };

  return (
    <div className="pdj-sets-fondo" role="dialog" aria-modal="true" aria-label="Sets guardados"
      onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="pdj-sets-caja">
        <div className="pdj-sets-cab">
          <div>
            <div className="pdj-sets-tit">Sets guardados</div>
            <div className="pdj-sets-sub">Con un set activo, sólo sus canciones entran a la votación.</div>
          </div>
          <button type="button" className="pdj-cr-cerrar" aria-label="Cerrar" onClick={onCerrar}>✕</button>
        </div>

        <div className="pdj-sets-lista">
          <div className={`pdj-sets-fila${!activoId ? " pdj-sets-fila-on" : ""}`}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="pdj-sets-nombre">Sin set</div>
              <div className="pdj-sets-det">Entran todas las canciones habilitadas</div>
            </div>
            {!activoId
              ? <span className="pdj-sets-activo">ACTIVO</span>
              : <button type="button" className="pdj-mini" disabled={ocupado} onClick={() => onActivar(null)}>Usar todas</button>}
          </div>

          {sets.map((s) => {
            const activo = s.id === activoId;
            return (
              <div key={s.id} className={`pdj-sets-fila${activo ? " pdj-sets-fila-on" : ""}`}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="pdj-sets-nombre">{s.name}</div>
                  <div className="pdj-sets-det">{s.itemIds.size} tema{s.itemIds.size === 1 ? "" : "s"}</div>
                </div>
                {activo
                  ? <span className="pdj-sets-activo">ACTIVO</span>
                  : <button type="button" className="pdj-mini pdj-mini-p" disabled={ocupado || s.itemIds.size === 0}
                      title={s.itemIds.size === 0 ? "El set está vacío" : "Activar este set"}
                      onClick={() => onActivar(s.id)}>Activar</button>}
                <button type="button" className="pdj-mini pdj-mini-r" disabled={ocupado}
                  title={activo ? "Borrarlo deja el evento sin set" : "Borrar el set (las canciones no se tocan)"}
                  onClick={() => {
                    if (window.confirm(`¿Borrar el set «${s.name}»?\n\nLas canciones quedan en la playlist; sólo se borra la agrupación.`)) onBorrar(s.id);
                  }}>✕</button>
              </div>
            );
          })}
          {sets.length === 0 && (
            <div className="pdj-sets-det" style={{ padding: "6px 2px" }}>Todavía no guardaste ningún set.</div>
          )}
        </div>

        <div className="pdj-sets-nuevo">
          <div className="pdj-sets-det" style={{ marginBottom: 6 }}>
            Nuevo set con las <strong>{seleccionadas}</strong> canción(es) seleccionada(s) en la lista.
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input className="pdj-input" value={nombre} maxLength={60} placeholder="Nombre del set (ej. Rock Internacional)"
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") crear(); }}/>
            <button type="button" className="pdj-mini pdj-mini-p" style={{ whiteSpace: "nowrap" }}
              disabled={ocupado || !nombre.trim() || !seleccionadas} onClick={crear}>＋ Crear set</button>
          </div>
          {!seleccionadas && (
            <div className="pdj-campo-hint" style={{ marginTop: 6 }}>
              Primero marcá canciones en la lista (podés filtrar por categoría y usar «Seleccionar todo»).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
