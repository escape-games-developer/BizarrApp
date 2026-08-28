import { useCallback, useEffect, useState } from "react";
import { saveEventFields, extractYtId, ytThumb } from "../../../services/pantallaDj";
import {
  fetchAdClips, createAdClip, updateAdClip, deleteAdClip,
} from "../../../services/pantallaConfig";
import { P } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";
import { BotonGuardar, CampoNumero, CampoSwitch, useBorrador, useGuardado } from "../panelControls";

/**
 * Tandas publicitarias: clips que se meten entre canciones.
 *
 * La cola es `pantalla_ad_clips` ordenada por `position`, y el motor va rotando
 * — `times_played` cuenta cuántas veces salió cada uno, así que la rotación es
 * visible acá sin tener que adivinar.
 *
 * Sólo se cargan links de YouTube. Los MP3 propios necesitan un bucket de audio
 * en Storage que todavía no existe: la columna `audio_path` está, el camino
 * para llenarla no.
 */
export default function SeccionTandas({ event, refresh, onError }) {
  const [clips,   setClips]   = useState([]);
  const [link,    setLink]    = useState("");
  const [titulo,  setTitulo]  = useState("");
  const [ocupado, setOcupado] = useState(false);

  const [b, set] = useBorrador(
    { ads_enabled: !!event.ads_enabled, ads_every_n_songs: event.ads_every_n_songs },
    [event.id, event.ads_enabled, event.ads_every_n_songs],
  );

  const cargar = useCallback(async () => {
    try { setClips(await fetchAdClips(event.id)); }
    catch (err) { onError?.(err); }
  }, [event.id, onError]);

  useEffect(() => { cargar(); }, [cargar]);

  const { estado, mensaje, guardar } = useGuardado(async () => {
    await saveEventFields(event.id, {
      ads_enabled:       b.ads_enabled,
      ads_every_n_songs: b.ads_every_n_songs,
    });
    await refresh();
  });

  const cambiado = b.ads_enabled !== !!event.ads_enabled
    || b.ads_every_n_songs !== event.ads_every_n_songs;

  const correr = async (fn) => {
    setOcupado(true); onError?.(null);
    try { await fn(); await cargar(); }
    catch (err) { onError?.(err); }
    finally { setOcupado(false); }
  };

  const ytId = extractYtId(link);

  const agregar = () => {
    if (!ytId) { onError?.("Ese link de YouTube no se pudo leer."); return; }
    correr(async () => {
      await createAdClip(event.id, {
        title: titulo.trim() || "Tanda sin título",
        source_type: "youtube", youtube_id: ytId, position: clips.length,
      });
      setLink(""); setTitulo("");
    });
  };

  const off = !b.ads_enabled;

  return (
    <PanelSection id="tandas" title="Tandas publicitarias" icon="📣" badge={clips.length || null}>
      <CampoSwitch label="Tandas habilitadas" checked={b.ads_enabled}
        onChange={(v) => set("ads_enabled", v)} />

      <div style={{ marginTop: 11, opacity: off ? .5 : 1 }}>
        <CampoNumero label="Insertar cada N canciones" min={1} max={50} disabled={off}
          value={b.ads_every_n_songs} onChange={(v) => set("ads_every_n_songs", v)}
          hint="Después de esta cantidad de canciones, entra el siguiente clip de la cola." />
      </div>

      <BotonGuardar estado={estado} mensaje={mensaje} disabled={!cambiado} onClick={guardar} />

      {/* ── Cola de rotación ────────────────────────────────────────── */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(240,232,255,.08)" }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: P.tenue, marginBottom: 7 }}>
          COLA DE ROTACIÓN
        </div>

        {clips.length === 0 && (
          <div className="pdj-campo-hint" style={{ marginTop: 0, marginBottom: 9 }}>
            Todavía no hay clips. Con la cola vacía no se inserta ninguna tanda, aunque estén
            habilitadas.
          </div>
        )}

        {clips.map((c, i) => (
          <div key={c.id} style={{
            display: "flex", alignItems: "center", gap: 7, marginBottom: 5,
            padding: "6px 8px", borderRadius: 10, opacity: c.enabled ? 1 : .5,
            background: "rgba(240,232,255,.035)", border: "1px solid rgba(240,232,255,.08)",
          }}>
            <span style={{
              fontFamily: "'Syne',sans-serif", fontWeight: 900, fontSize: 10,
              color: P.amarillo, width: 16, flexShrink: 0,
            }}>{i + 1}</span>
            {c.youtube_id && (
              <img src={ytThumb(c.youtube_id)} alt="" loading="lazy" style={{
                width: 34, height: 26, borderRadius: 6, objectFit: "cover", flexShrink: 0,
              }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: P.texto,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{c.title}</div>
              <div style={{ fontSize: 9, color: P.tenue2 }}>
                {c.source_type === "youtube" ? "YouTube" : "Audio"}
                {c.times_played > 0 && ` · ${c.times_played}× emitida`}
              </div>
            </div>
            <button type="button" className={`pdj-ico${c.enabled ? " pdj-ico-on" : ""}`}
              disabled={ocupado} title={c.enabled ? "Desactivar" : "Activar"}
              aria-label="Activar o desactivar el clip"
              onClick={() => correr(() => updateAdClip(c.id, { enabled: !c.enabled }))}>
              {c.enabled ? "👁" : "🚫"}
            </button>
            <button type="button" className="pdj-ico pdj-ico-peligro" disabled={ocupado}
              title="Eliminar de la cola" aria-label="Eliminar de la cola"
              onClick={() => {
                if (window.confirm(`¿Eliminar "${c.title}" de la cola de tandas?`)) {
                  correr(() => deleteAdClip(c.id));
                }
              }}>✕</button>
          </div>
        ))}

        <div style={{ display: "grid", gap: 5, marginTop: 9 }}>
          <input className="pdj-input" value={link} placeholder="Link de YouTube de la tanda"
            aria-label="Link de YouTube de la tanda" disabled={ocupado}
            onChange={(e) => setLink(e.target.value)} style={{ fontSize: 11.5 }} />
          <div style={{ display: "flex", gap: 5 }}>
            <input className="pdj-input" value={titulo} placeholder="Título (opcional)"
              aria-label="Título de la tanda" disabled={ocupado}
              onChange={(e) => setTitulo(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregar(); } }}
              style={{ flex: 1, minWidth: 0, fontSize: 11.5 }} />
            <button type="button" className="pdj-mini pdj-mini-p" disabled={ocupado || !ytId}
              onClick={agregar}>+ Agregar</button>
          </div>
          {link && !ytId && (
            <div className="pdj-campo-hint" style={{ color: P.amarillo }}>
              No se reconoció un link de YouTube en ese texto.
            </div>
          )}
        </div>

        <div className="pdj-campo-hint" style={{ marginTop: 8 }}>
          Subir MP3 propios todavía no está disponible: falta el bucket de audio en Storage.
          Por ahora, sólo links de YouTube.
        </div>
      </div>
    </PanelSection>
  );
}
