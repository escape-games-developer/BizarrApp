import { useCallback, useEffect, useRef, useState } from "react";
import { saveEventFields } from "../../../services/pantallaDj";
import { fetchGifs, createGif, deleteGif, setGifActivo } from "../../../services/pantallaConfig";
import { uploadMediaAsset } from "../../../services/mediaAssets";
import { P } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";
import { BotonGuardar, useBorrador, useGuardado } from "../panelControls";

/**
 * Transición entre canciones del DJ. Todo lo de esta sección lo lee /tv
 * (PantallaTV → TvTransicion y el motor useContinuousTvPlayers):
 *
 *   transition_enabled            → hay transición con GIF. Apagada (o sin
 *                                   GIF en uso): corte directo entre temas.
 *   transition_audio_fade         → el tema actual baja a silencio durante el
 *                                   fade in y el nuevo sube durante el fade out
 *   transition_gif_url            → el GIF en uso (se elige en la galería)
 *   transition_fade_in_seconds    → el GIF aparece
 *   transition_hold_seconds       → el GIF se mantiene; el cambio ocurre debajo
 *   transition_fade_out_seconds   → el GIF se desvanece y revela el tema nuevo
 *
 * Dónde se ve: el bloque «Transición entre canciones» del Diseñador DJ
 * Democracy si está visible; si no, el área del video. Los juegos nunca la
 * usan. `rain_anticipation_seconds` y `rain_tail_seconds` ya no se usan.
 */

const NARANJA = "#FF6A00";

const TIEMPOS = [
  { campo: "transition_fade_in_seconds",  label: "Fade in (seg)",  def: 2 },
  { campo: "transition_hold_seconds",     label: "Hold (seg)",     def: 1 },
  { campo: "transition_fade_out_seconds", label: "Fade out (seg)", def: 2 },
];

const CAMPOS = ["transition_enabled", "transition_audio_fade", ...TIEMPOS.map((t) => t.campo)];

const numero = (v, def) => {
  const n = v === null || v === undefined || v === "" ? NaN : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : def;
};

const css = `
  .tr-check{display:flex;align-items:flex-start;gap:12px;cursor:pointer;}
  .tr-check input{appearance:none;flex-shrink:0;width:18px;height:18px;margin:2px 0 0;border-radius:4px;cursor:pointer;
    background:#fff;border:1px solid rgba(240,232,255,.3);display:grid;place-content:center;}
  .tr-check input:checked{background:${NARANJA};border-color:${NARANJA};}
  .tr-check input:checked::after{content:"✓";color:#fff;font-size:12px;font-weight:900;line-height:1;}
  .tr-check input:disabled{cursor:default;opacity:.5;}
  .tr-titulo{font-size:12.5px;font-weight:700;color:${P.texto};}
  .tr-desc{font-size:10.5px;line-height:1.5;color:rgba(240,232,255,.55);margin-top:2px;}
  .tr-sub{font-size:10px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:rgba(240,232,255,.6);}
  .tr-sep{border-top:1px solid rgba(240,232,255,.1);margin:16px 0 14px;}
  .tr-galeria{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,220px));gap:10px;margin-top:10px;}
  .tr-gif{position:relative;aspect-ratio:1;border-radius:12px;overflow:hidden;cursor:pointer;padding:0;
    background:rgba(240,232,255,.05);border:2px solid rgba(240,232,255,.12);}
  .tr-gif[aria-pressed="true"]{border-color:${NARANJA};cursor:default;}
  .tr-gif img{width:100%;height:100%;object-fit:cover;display:block;}
  .tr-badge{position:absolute;top:6px;left:6px;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;
    background:${NARANJA};color:#fff;font-size:12px;font-weight:900;pointer-events:none;}
  .tr-borrar{position:absolute;top:6px;right:6px;width:22px;height:22px;border-radius:50%;border:none;cursor:pointer;
    display:grid;place-items:center;font-size:11px;background:rgba(8,4,15,.75);color:#FF6B8B;}
  .tr-agregar{display:flex;gap:8px;align-items:center;margin-top:12px;}
  .tr-btn{flex-shrink:0;padding:9px 14px;border-radius:999px;font:inherit;font-size:11.5px;font-weight:800;cursor:pointer;
    border:1px solid rgba(240,232,255,.14);background:transparent;color:rgba(240,232,255,.75);}
  .tr-btn-p{background:${NARANJA};border-color:${NARANJA};color:#fff;}
  .tr-btn:disabled{opacity:.45;cursor:default;}
  .tr-tiempos{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:10px;}
  .tr-tiempos label{display:block;font-size:10.5px;color:rgba(240,232,255,.6);margin-bottom:5px;}
`;

export default function SeccionTransicion({ event, refresh, onError }) {
  const [gifs,     setGifs]     = useState([]);
  const [url,      setUrl]      = useState("");
  const [ocupado,  setOcupado]  = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const archivoRef = useRef(null);

  // Lo guardado, ya con los valores por defecto de la TV: es el punto de
  // partida del borrador y contra lo que se mide si hay cambios.
  const guardado = {
    transition_enabled:    !!event.transition_enabled,
    transition_audio_fade: !!event.transition_audio_fade,
    ...Object.fromEntries(TIEMPOS.map((t) => [t.campo, numero(event[t.campo], t.def)])),
  };
  const [b, set] = useBorrador(guardado, [event.id, ...CAMPOS.map((c) => event[c])]);

  const cargar = useCallback(async () => {
    try { setGifs((await fetchGifs(event.id)).filter((g) => g.kind === "transition")); }
    catch (err) { onError?.(err); }
  }, [event.id, onError]);

  useEffect(() => { cargar(); }, [cargar]);

  const { estado, mensaje, guardar } = useGuardado(async () => {
    await saveEventFields(event.id, {
      transition_enabled:    b.transition_enabled,
      transition_audio_fade: b.transition_audio_fade,
      ...Object.fromEntries(TIEMPOS.map((t) => [t.campo, numero(b[t.campo], t.def)])),
    });
    await refresh();
  });

  const cambiado = CAMPOS.some((c) => String(b[c] ?? "") !== String(guardado[c] ?? ""));

  const correr = async (fn) => {
    setOcupado(true); onError?.(null);
    try { await fn(); await cargar(); }
    catch (err) { onError?.(err); }
    finally { setOcupado(false); }
  };

  // Marcar un GIF lo deja activo en el acto: no rota, se usa siempre el elegido.
  const activar = async (id, gifUrl) => {
    await setGifActivo(event.id, "transition", id);
    await saveEventFields(event.id, { transition_gif_url: gifUrl });
    await refresh();
  };

  const nuevoGif = async (gifUrl) => {
    const [fila] = await createGif(event.id, { url: gifUrl, kind: "transition", position: gifs.length });
    // El primero de la galería queda activo solo: si no, no habría transición.
    if (!event.transition_gif_url) await activar(fila.id, gifUrl);
  };

  const agregarUrl = () => {
    const u = url.trim();
    if (!u) return;
    correr(async () => { await nuevoGif(u); setUrl(""); });
  };

  // Agregar GIF desde la PC: va a la Biblioteca de imágenes (bucket
  // bizarren-media, categoría «Transiciones») y entra a la galería.
  const subir = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "image/gif") { onError?.(new Error(`"${file.name}" no es un GIF.`)); return; }
    setSubiendo(true);
    correr(async () => {
      const asset = await uploadMediaAsset(file, { category: "Transiciones" });
      await nuevoGif(asset.file_url);
    }).finally(() => setSubiendo(false));
  };

  const borrar = (g) => {
    if (!window.confirm("¿Eliminar este GIF de la galería?")) return;
    correr(async () => {
      await deleteGif(g.id);
      // Si era el activo, la TV se queda sin GIF: corte directo entre temas.
      if (g.url === event.transition_gif_url) {
        await saveEventFields(event.id, { transition_gif_url: null });
        await refresh();
      }
    });
  };

  const sinGif = !event.transition_gif_url;

  return (
    <PanelSection id="transicion" title="Transición entre canciones" icon="🎞">
      <style>{css}</style>

      <div style={{ display: "grid", gap: 14 }}>
        <label className="tr-check">
          <input type="checkbox" checked={b.transition_enabled}
            onChange={(e) => set("transition_enabled", e.target.checked)}/>
          <span>
            <div className="tr-titulo">Habilitar transición entre canciones</div>
            <div className="tr-desc">
              Un GIF sin audio se superpone sobre el área de video al cambiar de canción: aparece, se mantiene
              y se desvanece. El audio nunca se corta.
            </div>
          </span>
        </label>

        <label className="tr-check">
          <input type="checkbox" checked={b.transition_audio_fade} disabled={!b.transition_enabled}
            onChange={(e) => set("transition_audio_fade", e.target.checked)}/>
          <span>
            <div className="tr-titulo">Fundido de audio</div>
            <div className="tr-desc">
              El tema actual baja a silencio mientras aparece el GIF y el tema nuevo sube al revelarse. Usa los
              mismos tiempos configurados abajo. Solo funciona si la transición con GIF está activada.
            </div>
          </span>
        </label>
      </div>

      <div className="tr-sep"/>

      <div className="tr-sub">Galería de GIFs de transición</div>
      <div className="tr-desc" style={{ marginTop: 6 }}>
        Cargá varios GIFs y marcá cuál está activo. No rota automáticamente: se usa siempre el que elijas.
        {b.transition_enabled && sinGif && (
          <strong style={{ color: P.amarillo }}> Todavía no hay un GIF activo: sin él, el cambio es directo.</strong>
        )}
      </div>

      {gifs.length > 0 && (
        <div className="tr-galeria">
          {gifs.map((g) => {
            const activo = g.url === event.transition_gif_url;
            return (
              <div key={g.id} style={{ position: "relative" }}>
                <button type="button" className="tr-gif" aria-pressed={activo} disabled={ocupado}
                  title={activo ? "GIF activo" : "Usar este GIF"} style={{ width: "100%" }}
                  onClick={() => !activo && correr(() => activar(g.id, g.url))}>
                  <img src={g.url} alt="" loading="lazy"/>
                </button>
                {activo && <span className="tr-badge" aria-hidden="true">✓</span>}
                <button type="button" className="tr-borrar" disabled={ocupado}
                  title="Eliminar de la galería" aria-label="Eliminar GIF" onClick={() => borrar(g)}>🗑</button>
              </div>
            );
          })}
        </div>
      )}

      <input ref={archivoRef} type="file" accept="image/gif" onChange={subir} style={{ display: "none" }}/>
      <div className="tr-agregar">
        <button type="button" className="tr-btn tr-btn-p" disabled={ocupado}
          onClick={() => archivoRef.current?.click()}>
          {subiendo ? "Subiendo…" : "Agregar GIF"}
        </button>
        <input className="pdj-input" value={url} placeholder="…o pegá una URL de GIF"
          aria-label="URL del GIF" disabled={ocupado}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarUrl(); } }}
          style={{ flex: 1, minWidth: 0, fontSize: 12 }}/>
        <button type="button" className="tr-btn" disabled={ocupado || !url.trim()} onClick={agregarUrl}>
          Agregar URL
        </button>
      </div>

      <div className="tr-sep"/>

      <div className="tr-sub">Tiempos de la coreografía</div>
      <div className="tr-tiempos">
        {TIEMPOS.map((t) => (
          <div key={t.campo}>
            <label htmlFor={t.campo}>{t.label}</label>
            <input id={t.campo} className="pdj-input" type="number" min={0} max={15} step={0.5}
              value={b[t.campo]} onChange={(e) => set(t.campo, e.target.value)}
              style={{ fontSize: 12 }}/>
          </div>
        ))}
      </div>
      <div className="tr-desc" style={{ marginTop: 10 }}>
        La transición arranca {numero(b.transition_fade_in_seconds, 2) + numero(b.transition_hold_seconds, 1)} s
        antes del final del tema (fade in + hold), el cambio ocurre debajo del GIF y después se desvanece.
        Posicioná el bloque «Transición entre canciones» en el Diseñador DJ Democracy para que cubra el área
        del video; si no está visible, el GIF cubre el área del video.
      </div>

      <BotonGuardar estado={estado} mensaje={mensaje} disabled={!cambiado} onClick={guardar} />
    </PanelSection>
  );
}
