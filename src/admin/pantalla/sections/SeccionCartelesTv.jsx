import { useCallback, useEffect, useState } from "react";
import { saveEventFields } from "../../../services/pantallaDj";
import { fetchGifs, createGif, deleteGif } from "../../../services/pantallaConfig";
import { P } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";
import { BotonGuardar, CampoNumero, useBorrador, useGuardado } from "../panelControls";

/**
 * Cómo se ven las recompensas en la pantalla grande.
 *
 * `tv_texts` es un jsonb con una clave por tipo de cartel. Acá se edita clave
 * por clave y se guarda el objeto entero: no se inventan claves nuevas, se
 * respetan las que la columna trae por defecto, que son las que el motor busca.
 *
 * Los `{marcadores}` los reemplaza la TV al mostrar el cartel.
 */

const CARTELES = [
  { key: "birthday",                 label: "Cumpleañero",          vars: "{nombre}" },
  { key: "emoji_fan",                label: "Fan de un emoji",      vars: "{nombre} {emoji}" },
  { key: "night_owl",                label: "Trasnochador",         vars: "{nombre}" },
  { key: "sharp_eye",                label: "Ojo clínico",          vars: "{nombre}" },
  { key: "team_king",                label: "Rey del equipo",       vars: "{nombre}" },
  { key: "good_vibes",               label: "Buena onda",           vars: "{nombre}" },
  { key: "most_interactive",         label: "Más interactivo",      vars: "{nombre}" },
  { key: "manual_raffle",            label: "Sorteo manual",        vars: "{nombre}" },
  { key: "physical_prize_delivered", label: "Premio real entregado", vars: "{nombre} {premio}" },
];

const CAMPOS = [
  "screen_message_duration_seconds", "gif_screen_duration_seconds",
  "giant_reaction_count", "giant_reaction_scale",
];

export default function SeccionCartelesTv({ event, refresh, onError }) {
  const [gifs,    setGifs]    = useState([]);
  const [url,     setUrl]     = useState("");
  const [ocupado, setOcupado] = useState(false);

  const [b, set] = useBorrador(
    {
      ...Object.fromEntries(CAMPOS.map((c) => [c, event[c]])),
      textos: { ...(event.tv_texts || {}) },
    },
    // `tv_texts` va serializado a propósito: es un jsonb, y como dependencia por
    // identidad se rompería en cada UPDATE del evento — la TV reporta su tiempo
    // cada pocos segundos y el borrador se borraría mientras alguien escribe.
    [event.id, ...CAMPOS.map((c) => event[c]), JSON.stringify(event.tv_texts)],
  );

  const cargar = useCallback(async () => {
    try { setGifs((await fetchGifs(event.id)).filter((g) => g.kind === "prize")); }
    catch (err) { onError?.(err); }
  }, [event.id, onError]);

  useEffect(() => { cargar(); }, [cargar]);

  const { estado, mensaje, guardar } = useGuardado(async () => {
    await saveEventFields(event.id, {
      screen_message_duration_seconds: b.screen_message_duration_seconds,
      gif_screen_duration_seconds:     b.gif_screen_duration_seconds,
      giant_reaction_count:            b.giant_reaction_count,
      giant_reaction_scale:            b.giant_reaction_scale,
      tv_texts:                        b.textos,
    });
    await refresh();
  });

  const cambiado = CAMPOS.some((c) => String(b[c] ?? "") !== String(event[c] ?? ""))
    || JSON.stringify(b.textos) !== JSON.stringify(event.tv_texts || {});

  const correr = async (fn) => {
    setOcupado(true); onError?.(null);
    try { await fn(); await cargar(); }
    catch (err) { onError?.(err); }
    finally { setOcupado(false); }
  };

  const setTexto = (key, valor) =>
    set("textos", { ...b.textos, [key]: valor });

  return (
    <PanelSection id="carteles-tv" title="Carteles y efectos en la TV" icon="📢">
      {/* ── Textos ─────────────────────────────────────────────────── */}
      <div style={{ fontSize: 10.5, fontWeight: 800, color: P.tenue, marginBottom: 7 }}>
        TEXTOS DE CARTEL
      </div>

      {CARTELES.map((c) => (
        <div key={c.key} style={{ marginBottom: 9 }}>
          <label htmlFor={`txt-${c.key}`} style={{
            fontSize: 10, fontWeight: 700, color: "rgba(240,232,255,.55)",
            display: "flex", gap: 6, alignItems: "baseline", marginBottom: 3,
          }}>
            {c.label}
            <span style={{ fontSize: 8.5, color: P.tenue2, fontWeight: 600 }}>{c.vars}</span>
          </label>
          <input id={`txt-${c.key}`} className="pdj-input" value={b.textos?.[c.key] ?? ""}
            maxLength={160} onChange={(e) => setTexto(c.key, e.target.value)}
            style={{ fontSize: 11 }} />
        </div>
      ))}

      {/* ── Duraciones y efecto ────────────────────────────────────── */}
      <div style={{
        marginTop: 12, paddingTop: 11, borderTop: "1px solid rgba(240,232,255,.08)",
      }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: P.tenue, marginBottom: 7 }}>
          DURACIÓN Y REACCIÓN GIGANTE
        </div>

        <CampoNumero label="Duración del mensaje en pantalla (s)" min={3} max={30}
          value={b.screen_message_duration_seconds}
          onChange={(v) => set("screen_message_duration_seconds", v)} />

        <CampoNumero label="Duración del GIF en pantalla (s)" min={3} max={30}
          value={b.gif_screen_duration_seconds}
          onChange={(v) => set("gif_screen_duration_seconds", v)} />

        <CampoNumero label="Cantidad de emojis en la reacción gigante" min={1} max={200}
          value={b.giant_reaction_count} onChange={(v) => set("giant_reaction_count", v)}
          hint="Cuántas copias del emoji explotan sobre el video." />

        <CampoNumero label="Multiplicador de tamaño" min={1} max={10}
          value={b.giant_reaction_scale} onChange={(v) => set("giant_reaction_scale", v)}
          hint="1 es el tamaño normal de una reacción; 10 tapa media pantalla." />
      </div>

      <BotonGuardar estado={estado} mensaje={mensaje} disabled={!cambiado} onClick={guardar} />

      {/* ── Galería de GIFs de premio ──────────────────────────────── */}
      <div style={{
        marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(240,232,255,.08)",
      }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: P.tenue, marginBottom: 7 }}>
          GALERÍA DE GIFS DE PREMIO
        </div>
        <div className="pdj-campo-hint" style={{ marginTop: 0, marginBottom: 8 }}>
          Los GIFs que puede tirar a la pantalla quien gane el premio «GIF a pantalla».
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(78px,1fr))", gap: 6 }}>
          {gifs.map((g) => (
            <div key={g.id} style={{ position: "relative" }}>
              <img src={g.url} alt="" loading="lazy" style={{
                width: "100%", aspectRatio: "1", objectFit: "cover", display: "block",
                borderRadius: 10, border: "1px solid rgba(240,232,255,.1)",
              }} />
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
          ))}
        </div>

        {gifs.length === 0 && (
          <div className="pdj-campo-hint" style={{ marginTop: 0 }}>
            Sin GIFs cargados. Con la galería vacía, el premio «GIF a pantalla» no tiene nada que ofrecer.
          </div>
        )}

        <div style={{ display: "flex", gap: 5, marginTop: 8 }}>
          <input className="pdj-input" value={url} placeholder="URL del GIF"
            aria-label="URL del GIF de premio" disabled={ocupado}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || !url.trim()) return;
              e.preventDefault();
              correr(async () => {
                await createGif(event.id, { url: url.trim(), kind: "prize", position: gifs.length });
                setUrl("");
              });
            }}
            style={{ flex: 1, minWidth: 0, fontSize: 11.5 }} />
          <button type="button" className="pdj-mini pdj-mini-p" disabled={ocupado || !url.trim()}
            onClick={() => correr(async () => {
              await createGif(event.id, { url: url.trim(), kind: "prize", position: gifs.length });
              setUrl("");
            })}>+ Agregar</button>
        </div>
      </div>
    </PanelSection>
  );
}
