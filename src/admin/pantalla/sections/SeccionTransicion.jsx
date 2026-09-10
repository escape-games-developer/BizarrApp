import { useCallback, useEffect, useState } from "react";
import { saveEventFields } from "../../../services/pantallaDj";
import { fetchGifs, createGif, deleteGif, setGifActivo } from "../../../services/pantallaConfig";
import { P } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";
import { BotonGuardar, Campo, CampoSwitch, useBorrador, useGuardado } from "../panelControls";

/**
 * Transición entre canciones. La sección tiene DOS mitades y sólo una anda.
 *
 * ── ⛈ Lluvia (FUNCIONAL) ────────────────────────────────────────────────────
 * `rain_anticipation_seconds` y `rain_tail_seconds` son los únicos dos campos
 * que `/tv` lee de verdad (`PantallaTV.jsx`, al construir el motor A/B). La
 * anticipación además define la ventana real del crossfade de audio: no es sólo
 * "cuánto dura la lluvia", es cuándo empieza el cruce.
 *
 * ── 🎞 GIF y fades (PENDIENTE) ──────────────────────────────────────────────
 * `transition_enabled`, `transition_gif_url` y los tres `transition_fade/hold`
 * se guardan bien y NO los lee nadie. Buscar cualquiera de esos cinco nombres en
 * `src/tv/` no devuelve una sola coincidencia. Apagar la transición no apaga
 * nada, y el GIF elegido no se muestra jamás.
 *
 * Por eso los campos siguen acá y se siguen pudiendo editar —el motor los va a
 * necesitar tal cual están, y dejar pre-configurada la noche no molesta a
 * nadie— pero bajo un encabezado que dice qué gobierna la TV y qué no.
 */

function Bloque({ ico, titulo }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
      <span className="pdj-campo-lbl" style={{ margin: 0 }}>{ico} {titulo}</span>
    </div>
  );
}

const TIEMPOS = [
  { campo: "transition_fade_in_seconds",  label: "Fade in (s)" },
  { campo: "transition_hold_seconds",     label: "Hold (s)" },
  { campo: "transition_fade_out_seconds", label: "Fade out (s)" },
];

const CAMPOS = ["transition_enabled", "transition_gif_url", ...TIEMPOS.map((t) => t.campo), "rain_anticipation_seconds", "rain_tail_seconds"];

export default function SeccionTransicion({ event, refresh, onError }) {
  const [gifs,    setGifs]    = useState([]);
  const [url,     setUrl]     = useState("");
  const [ocupado, setOcupado] = useState(false);

  const [b, set] = useBorrador(
    {
      transition_enabled:          !!event.transition_enabled,
      transition_gif_url:          event.transition_gif_url || "",
      transition_fade_in_seconds:  event.transition_fade_in_seconds,
      transition_hold_seconds:     event.transition_hold_seconds,
      transition_fade_out_seconds: event.transition_fade_out_seconds,
      rain_anticipation_seconds:   event.rain_anticipation_seconds ?? 6,
      rain_tail_seconds:           event.rain_tail_seconds ?? 0,
    },
    [event.id, ...CAMPOS.map((c) => event[c])],
  );

  const cargar = useCallback(async () => {
    try { setGifs((await fetchGifs(event.id)).filter((g) => g.kind === "transition")); }
    catch (err) { onError?.(err); }
  }, [event.id, onError]);

  useEffect(() => { cargar(); }, [cargar]);

  const { estado, mensaje, guardar } = useGuardado(async () => {
    await saveEventFields(event.id, {
      transition_enabled:          b.transition_enabled,
      transition_gif_url:          String(b.transition_gif_url || "").trim() || null,
      transition_fade_in_seconds:  Number(b.transition_fade_in_seconds) || 0,
      transition_hold_seconds:     Number(b.transition_hold_seconds) || 0,
      transition_fade_out_seconds: Number(b.transition_fade_out_seconds) || 0,
      rain_anticipation_seconds:   Number(b.rain_anticipation_seconds) || 6,
      rain_tail_seconds:           Number(b.rain_tail_seconds) || 0,
    });
    await refresh();
  });

  const cambiado = CAMPOS.some((c) => String(b[c] ?? "") !== String(event[c] ?? ""));

  const correr = async (fn) => {
    setOcupado(true); onError?.(null);
    try { await fn(); await cargar(); }
    catch (err) { onError?.(err); }
    finally { setOcupado(false); }
  };

  const agregar = () => {
    const u = url.trim();
    if (!u) return;
    correr(async () => {
      await createGif(event.id, { url: u, kind: "transition", position: gifs.length });
      setUrl("");
    });
  };

  const elegir = (g) => correr(async () => {
    await setGifActivo(event.id, "transition", g.id);
    await saveEventFields(event.id, { transition_gif_url: g.url });
    await refresh();
  });

  const off = !b.transition_enabled;
  const total = TIEMPOS.reduce((s, t) => s + (Number(b[t.campo]) || 0), 0);

  // Los inputs devuelven texto, así que se convierte acá y no en el render.
  const lluviaAntes = Number(b.rain_anticipation_seconds) || 0;
  const lluviaCola  = Number(b.rain_tail_seconds) || 0;

  return (
    <PanelSection id="transicion" title="Transición entre canciones" icon="🎞">
      {/* ── Mitad que SÍ gobierna la TV ──────────────────────────────────── */}
      <Bloque ico="⛈" titulo="Lluvia entre canciones" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <div>
          <label htmlFor="rain_anticipation_seconds" style={{ fontSize: 9, fontWeight: 700, letterSpacing: .4, textTransform: "uppercase", color: P.tenue2, display: "block", marginBottom: 3 }}>
            Segundos antes del fin
          </label>
          <input id="rain_anticipation_seconds" className="pdj-input" type="number" min={1} max={30} step={1}
            value={b.rain_anticipation_seconds}
            onChange={(e) => set("rain_anticipation_seconds", e.target.value)}
            style={{ padding: "6px 8px", fontSize: 11 }} />
        </div>
        <div>
          <label htmlFor="rain_tail_seconds" style={{ fontSize: 9, fontWeight: 700, letterSpacing: .4, textTransform: "uppercase", color: P.tenue2, display: "block", marginBottom: 3 }}>
            Segundos del tema nuevo
          </label>
          <input id="rain_tail_seconds" className="pdj-input" type="number" min={0} max={15} step={1}
            value={b.rain_tail_seconds}
            onChange={(e) => set("rain_tail_seconds", e.target.value)}
            style={{ padding: "6px 8px", fontSize: 11 }} />
        </div>
      </div>
      <div className="pdj-campo-hint">
        La lluvia arranca N segundos antes del fin del video y se mantiene M segundos del tema
        nuevo. <strong>«Segundos antes del fin» es además la ventana del cruce de audio</strong>:
        el tema saliente baja y el entrante sube durante exactamente ese tiempo.
      </div>
      <div className="pdj-campo-hint">
        {lluviaCola > 0
          ? `Lluvia total por transición: ${lluviaAntes + lluviaCola} s (${lluviaAntes} s antes del corte + ${lluviaCola} s del tema nuevo)`
          : `Lluvia total por transición: ${lluviaAntes} s`}
      </div>

      {/* ── Mitad que todavía no gobierna nada ───────────────────────────── */}
      <div style={{ marginTop: 16, borderTop: "1px solid rgba(240,232,255,.1)", paddingTop: 13 }}>
        <Bloque ico="🎞" titulo="GIF / fade de transición" />

        <CampoSwitch label="Transición habilitada" checked={b.transition_enabled}
          onChange={(v) => set("transition_enabled", v)} />

      {/* El atenuado por `off` es la semántica original del switch y se conserva
          tal cual para cuando el motor lo use. */}
      <div style={{ marginTop: 12, opacity: off ? .5 : 1 }}>
        <span className="pdj-campo-lbl">Galería de GIFs</span>

        {gifs.length === 0 && (
          <div className="pdj-campo-hint" style={{ marginTop: 0, marginBottom: 8 }}>
            Sin GIFs cargados. Pegá la URL de uno abajo.
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(78px,1fr))", gap: 6 }}>
          {gifs.map((g) => {
            const activo = g.is_active || g.url === b.transition_gif_url;
            return (
              <div key={g.id} style={{ position: "relative" }}>
                <button type="button" disabled={ocupado || off} onClick={() => elegir(g)}
                  title={activo ? "GIF activo" : "Usar este GIF"}
                  style={{
                    display: "block", width: "100%", aspectRatio: "1", padding: 0, cursor: "pointer",
                    borderRadius: 10, overflow: "hidden", background: "rgba(240,232,255,.05)",
                    border: `2px solid ${activo ? P.amarillo : "rgba(240,232,255,.1)"}`,
                  }}>
                  <img src={g.url} alt="" loading="lazy"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </button>
                {activo && (
                  <span style={{
                    position: "absolute", top: 3, left: 3, fontSize: 9, fontWeight: 800,
                    padding: "1px 5px", borderRadius: 6, background: P.amarillo, color: P.bg,
                  }}>EN USO</span>
                )}
                <button type="button" className="pdj-ico pdj-ico-peligro" disabled={ocupado}
                  title="Eliminar de la galería" aria-label="Eliminar GIF"
                  onClick={() => {
                    if (window.confirm("¿Eliminar este GIF de la galería?")) {
                      correr(() => deleteGif(g.id));
                    }
                  }}
                  style={{ position: "absolute", top: 2, right: 2, width: 20, height: 20, fontSize: 9 }}>
                  ✕
                </button>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 5, marginTop: 8 }}>
          <input className="pdj-input" value={url} placeholder="URL del GIF"
            aria-label="URL del GIF" disabled={ocupado || off}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregar(); } }}
            style={{ flex: 1, minWidth: 0, fontSize: 11.5 }} />
          <button type="button" className="pdj-mini pdj-mini-p" disabled={ocupado || off || !url.trim()}
            onClick={agregar}>+ Agregar</button>
        </div>

        <Campo label="GIF en uso"
          hint="Es lo que lee la TV. Se llena solo al elegir uno de la galería, pero se puede pegar una URL a mano.">
          <input className="pdj-input" value={b.transition_gif_url} disabled={off}
            placeholder="Ningún GIF elegido" style={{ fontSize: 10.5 }}
            onChange={(e) => set("transition_gif_url", e.target.value)} />
        </Campo>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          {TIEMPOS.map((t) => (
            <div key={t.campo}>
              <label htmlFor={t.campo} style={{
                fontSize: 9, fontWeight: 700, letterSpacing: .4, textTransform: "uppercase",
                color: P.tenue2, display: "block", marginBottom: 3,
              }}>{t.label}</label>
              <input id={t.campo} className="pdj-input" type="number" min={0} max={15} step={0.5}
                value={b[t.campo]} disabled={off}
                onChange={(e) => set(t.campo, e.target.value)}
                style={{ padding: "6px 8px", fontSize: 11 }} />
            </div>
          ))}
        </div>

        <div className="pdj-campo-hint">
          Transición total configurada: <strong style={{ color: P.amarillo }}>{total.toFixed(1)}s</strong>.
        </div>
      </div>{/* /galería atenuada */}
      </div>{/* /mitad pendiente */}

      <BotonGuardar estado={estado} mensaje={mensaje} disabled={!cambiado} onClick={guardar} />
    </PanelSection>
  );
}
