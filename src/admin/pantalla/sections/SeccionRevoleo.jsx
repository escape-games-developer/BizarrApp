import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchThrowObjects, createThrowObject, deleteThrowObject,
} from "../../../services/pantallaConfig";
import { uploadMediaAsset } from "../../../services/mediaAssets";
import { P } from "../../../components/pantalla/pantallaUi";

const miniButton = {
  border: "1px solid rgba(255,149,0,.65)",
  background: "rgba(255,149,0,.12)",
  color: "#FF9A00",
  borderRadius: 8,
  padding: "6px 9px",
  fontSize: 10,
  fontWeight: 850,
  cursor: "pointer",
};

function ImagenElegida({ label, url, onPick, disabled }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
      <button type="button" disabled={disabled} onClick={onPick}
        style={{ ...miniButton, opacity: disabled ? .45 : 1 }}>
        {label}
      </button>
      {url ? (
        <>
          <div style={{
            width: 34, height: 34, borderRadius: 8, overflow: "hidden", flexShrink: 0,
            border: "1px solid rgba(240,232,255,.14)", background: "rgba(240,232,255,.04)",
          }}>
            <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <span style={{
            maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            fontSize: 9.5, color: P.tenue2,
          }}>Imagen cargada</span>
        </>
      ) : null}
    </div>
  );
}

export default function SeccionRevoleo({ event, disabled = false, onError }) {
  const [objetos, setObjetos] = useState([]);
  const [nombre, setNombre] = useState("");
  const [flyingUrl, setFlyingUrl] = useState("");
  const [fallenUrl, setFallenUrl] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [tipoUpload, setTipoUpload] = useState(null);
  const fileRef = useRef(null);

  const cargar = useCallback(async () => {
    try {
      setObjetos(await fetchThrowObjects(event.id));
    } catch (err) {
      // La tabla se agrega por migración local. Antes de aplicarla, no rompemos
      // el resto del editor: la acción de agregar seguirá informando el error.
      if (String(err?.message || err).includes("pantalla_throw_objects")) {
        setObjetos([]);
        return;
      }
      onError?.(err);
    }
  }, [event.id, onError]);

  useEffect(() => { cargar(); }, [cargar]);

  const elegir = (tipo) => {
    setTipoUpload(tipo);
    fileRef.current?.click();
  };

  const subir = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !tipoUpload) return;
    setOcupado(true);
    try {
      const sufijo = tipoUpload === "flying" ? "volando" : "caído";
      const asset = await uploadMediaAsset(file, {
        name: `Revoleo ${nombre.trim() || "objeto"} ${sufijo}`,
        category: "dj-revoleo",
      });
      if (tipoUpload === "flying") setFlyingUrl(asset.file_url);
      else setFallenUrl(asset.file_url);
    } catch (err) {
      onError?.(err);
    } finally {
      setOcupado(false);
      setTipoUpload(null);
    }
  };

  const agregar = async () => {
    if (!nombre.trim() || !flyingUrl || !fallenUrl) return;
    setOcupado(true);
    try {
      await createThrowObject(event.id, {
        name: nombre.trim(),
        flying_url: flyingUrl,
        fallen_url: fallenUrl,
        position: objetos.length,
      });
      setNombre(""); setFlyingUrl(""); setFallenUrl("");
      await cargar();
    } catch (err) {
      onError?.(err);
    } finally {
      setOcupado(false);
    }
  };

  const borrar = async (objeto) => {
    if (!window.confirm(`¿Eliminar "${objeto.name}" de la galería de revoleo?`)) return;
    setOcupado(true);
    try {
      await deleteThrowObject(objeto.id);
      await cargar();
    } catch (err) {
      onError?.(err);
    } finally {
      setOcupado(false);
    }
  };

  const off = disabled || ocupado;

  return (
    <div style={{
      marginTop: 15, paddingTop: 13, borderTop: "1px solid rgba(240,232,255,.08)",
      opacity: disabled ? .5 : 1,
    }}>
      <div style={{
        fontSize: 10.5, fontWeight: 900, color: P.tenue, marginBottom: 5,
        letterSpacing: .25,
      }}>
        REVOLEO A PANTALLA — GALERÍA DE OBJETOS
      </div>
      <div className="pdj-campo-hint" style={{ marginTop: 0, marginBottom: 8 }}>
        Cargá los objetos que se pueden revolear. Cada uno necesita dos imágenes:
        volando y caído en el piso. El invitado elige cuál tirar cuando obtiene este premio.
      </div>

      {objetos.length === 0 && (
        <div style={{
          padding: "7px 9px", borderRadius: 8, marginBottom: 9,
          border: "1px solid rgba(255,75,110,.28)",
          background: "rgba(255,75,110,.06)", color: "#FF6B85", fontSize: 9.5,
        }}>
          Cargá al menos un objeto para que este premio esté disponible.
        </div>
      )}

      {objetos.length > 0 && (
        <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
          {objetos.map((o) => (
            <div key={o.id} style={{
              display: "grid", gridTemplateColumns: "40px 40px minmax(0,1fr) 30px",
              alignItems: "center", gap: 7, padding: "6px 7px", borderRadius: 9,
              background: "rgba(240,232,255,.035)",
              border: "1px solid rgba(240,232,255,.08)",
            }}>
              {[o.flying_url, o.fallen_url].map((url, i) => (
                <div key={i} title={i === 0 ? "Imagen volando" : "Imagen caída"} style={{
                  width: 38, height: 38, borderRadius: 7, overflow: "hidden",
                  border: "1px solid rgba(240,232,255,.12)",
                  background: "rgba(240,232,255,.035)",
                }}>
                  {url && <img src={url} alt="" style={{
                    width: "100%", height: "100%", objectFit: "contain",
                  }} />}
                </div>
              ))}
              <strong style={{
                fontSize: 10.5, color: P.texto, overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{o.name}</strong>
              <button type="button" className="pdj-ico pdj-ico-peligro"
                disabled={off} title="Eliminar objeto" onClick={() => borrar(o)}>🗑</button>
            </div>
          ))}
        </div>
      )}

      <input className="pdj-input" value={nombre} disabled={off}
        placeholder="Nombre del objeto (ej. Osito de peluche)"
        aria-label="Nombre del objeto de revoleo"
        onChange={(e) => setNombre(e.target.value)}
        style={{ marginBottom: 7 }} />

      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
        <ImagenElegida label="Imagen volando" url={flyingUrl}
          disabled={off} onPick={() => elegir("flying")} />
        <ImagenElegida label="Imagen caída" url={fallenUrl}
          disabled={off} onPick={() => elegir("fallen")} />
        <button type="button" className="pdj-mini pdj-mini-p"
          disabled={off || !nombre.trim() || !flyingUrl || !fallenUrl}
          onClick={agregar}>
          + Agregar objeto
        </button>
      </div>

      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp"
        hidden onChange={subir} />
    </div>
  );
}
