import { useRef, useState } from "react";
import {
  ALLOWED_MIME, ALLOWED_LABEL, MAX_FILE_BYTES,
  formatBytes, prettyName, validateFile,
} from "../../services/mediaAssets";

const ACCEPT = ALLOWED_MIME.join(",");

/**
 * Subida de imágenes a la biblioteca desde el navegador.
 * Acepta varios archivos a la vez (sirve para cargar un lote completo de una)
 * y sube de a uno para no saturar la conexión del bar.
 */
export default function MediaUploader({ categories = [], onUpload, onUploaded, onClose }) {
  const inputRef = useRef(null);
  const [category, setCategory] = useState("");
  const [queue,    setQueue]    = useState([]);   // [{name, status, error}]
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState(null);

  const pick = async (event) => {
    const files = Array.from(event.target.files || []);
    // Permite volver a elegir el mismo archivo después de un error.
    event.target.value = "";
    if (!files.length) return;

    const rejected = files.map(validateFile).filter(Boolean);
    const valid    = files.filter((f) => !validateFile(f));

    setError(rejected.length ? rejected.join("\n") : null);
    if (!valid.length) return;

    setBusy(true);
    setQueue(valid.map((f) => ({ name: f.name, status: "pending", error: null })));

    const created = [];
    for (let i = 0; i < valid.length; i++) {
      const file = valid[i];
      setQueue((q) => q.map((item, idx) => (idx === i ? { ...item, status: "uploading" } : item)));
      try {
        const asset = await onUpload(file, { name: prettyName(file.name), category });
        created.push(asset);
        setQueue((q) => q.map((item, idx) => (idx === i ? { ...item, status: "done" } : item)));
      } catch (err) {
        console.error("[MediaUploader] upload error:", err);
        setQueue((q) => q.map((item, idx) =>
          (idx === i ? { ...item, status: "error", error: err.message } : item)));
      }
    }

    setBusy(false);
    if (created.length) onUploaded?.(created[created.length - 1], created);
  };

  const done   = queue.filter((f) => f.status === "done").length;
  const failed = queue.filter((f) => f.status === "error");
  const pct    = queue.length ? Math.round((done / queue.length) * 100) : 0;

  return (
    <div className="ml-up">
      <div className="ml-up-row">
        <input
          className="ml-field"
          list="ml-categories"
          placeholder="Categoría (opcional): personajes, logos…"
          value={category}
          disabled={busy}
          onChange={(e) => setCategory(e.target.value)}
        />
        <datalist id="ml-categories">
          {categories.map((c) => <option key={c} value={c} />)}
        </datalist>

        <button type="button" className="ml-btn ml-btn-p" disabled={busy}
          onClick={() => inputRef.current?.click()}>
          {busy ? "Subiendo…" : "Elegir archivos"}
        </button>
        {onClose && (
          <button type="button" className="ml-btn ml-btn-g" disabled={busy} onClick={onClose}>
            Cancelar
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={pick}
        />
      </div>

      <div className="ml-up-hint">
        {ALLOWED_LABEL} · hasta {formatBytes(MAX_FILE_BYTES)} por archivo · se generan miniaturas
        automáticamente. Los PNG mantienen la transparencia. Podés seleccionar varios de una vez.
      </div>

      {error && <div className="ml-err" style={{ marginTop: 9, marginBottom: 0 }}>{error}</div>}

      {queue.length > 0 && (
        <>
          <div className="ml-bar"><div className="ml-bar-fill" style={{ width: `${pct}%` }} /></div>
          <div className="ml-up-list">
            {queue.map((f, i) => (
              <div className="ml-up-file" key={`${f.name}-${i}`}>
                {f.status === "uploading"
                  ? <span className="ml-spin" />
                  : <span className="ml-dot" style={{
                      background: f.status === "done"  ? "#00F5A0"
                                : f.status === "error" ? "#FF2D78"
                                :                        "rgba(240,232,255,.2)",
                    }} />}
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {f.name}
                </span>
                {f.status === "error" && (
                  <span style={{ color: "#FCA5A5", fontSize: 9.5 }}>{f.error}</span>
                )}
              </div>
            ))}
          </div>
          {!busy && (
            <div className="ml-up-hint">
              {done} de {queue.length} subidas
              {failed.length > 0 && ` · ${failed.length} con error`}
            </div>
          )}
        </>
      )}
    </div>
  );
}
