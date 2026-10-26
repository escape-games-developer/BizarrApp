import { useEffect, useState } from "react";
import MediaLibraryModal from "../../../components/media/MediaLibraryModal";
import { useDueloPantallaAdmin, TEXTO_MAX, ZOOM_MIN, ZOOM_MAX, RANGOS, POSICIONES_LOGO } from "../../../hooks/useDueloPantalla";
import VistasJuego from "../VistasJuego";
import Toggle from "../../juegos/Toggle";
import SliderPantalla from "../../juegos/SliderPantalla";
import SelectorEfecto from "../../juegos/SelectorEfecto";
import { SeccionConfig, AvisoGuardado } from "../../juegos/SeccionConfig";
import { ErrorCarga } from "../../juegos/AjustesDelJuego";
import EditorLienzo from "../../../lienzo/editor/EditorLienzo";
import { DUELO_POR_DEFECTO, PANTALLAS_DUELO, PANTALLAS_DUELO_CEL, separarColumnas } from "../../../lienzo/juegos/duelo";
import { useDueloPantalla } from "../../../hooks/useDueloPantalla";
import { usePantallaVisibilidadAdmin } from "../../../hooks/usePantallaQr";

/**
 * Diseño de la pantalla del Duelo (`admin_ui_config` 'duelo_pantalla').
 *
 * La votación es FONDO + MÁSCARA. Fondo: el video de la ronda a pantalla
 * completa, o la imagen de fondo, o negro. Máscara (siempre encima): paneles
 * laterales, barómetros, avatares, logo de BizarrApp y logo de duelo (texto o
 * imagen PNG/WEBP, con posición, tamaño y efecto). También 👍 + % por duelista.
 * La TV lo toma en ≤ 3 s, también con una ronda en curso.
 *
 * Una sola instancia de `useDueloPantallaAdmin` para todas las secciones: dos
 * guardando por separado chocarían en el control de `updated_at`.
 */

const COL = "#FF2D78";
const nota = { fontSize: 10, color: "rgba(240,232,255,.42)", lineHeight: 1.5 };
const sub = { fontSize: 11, fontWeight: 700, marginTop: 12, marginBottom: 2, color: "rgba(240,232,255,.8)" };

function ControlesDuelo({ onGuardado }) {
  const { config, error, guardar } = useDueloPantallaAdmin();
  const [texto, setTexto] = useState("");
  const [libOpen, setLibOpen] = useState(null); // null | "logo" | "fondo"
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null); // {ok, text}

  useEffect(() => { if (config) setTexto(config.texto); }, [config?.texto]); // eslint-disable-line react-hooks/exhaustive-deps

  const aplicar = async (patch, okText) => {
    if (guardando || !config) return;
    setGuardando(true); setAviso(null);
    try { await guardar({ ...config, ...patch }); setAviso({ ok: true, text: okText }); onGuardado?.(); }
    catch (e) { setAviso({ ok: false, text: e?.message || String(e) }); }
    finally { setGuardando(false); }
  };

  if (error) return <div className="card"><ErrorCarga error={error}/></div>;
  if (!config) return <div className="card"><div style={nota}>Cargando…</div></div>;

  const textoLimpio = texto.trim();
  const textoSucio = textoLimpio !== config.texto;
  const elegirImagen = (asset) => {
    const para = libOpen;
    setLibOpen(null);
    if (!asset?.file_url) return;
    if (para === "fondo") {
      aplicar({ fondo: asset.file_url }, "Imagen de fondo puesta (se ve cuando la ronda no tiene video).");
      return;
    }
    if (!["image/png", "image/webp"].includes(asset.mime_type)) {
      setAviso({ ok: false, text: "Para el logo elegí un PNG o WEBP (con fondo transparente)." }); return;
    }
    aplicar({ centro: "imagen", imagen: asset.file_url }, "Imagen puesta como logo de duelo.");
  };
  const panelSlider = (lado, nombre) => (
    <>
      <div style={sub}>{nombre}</div>
      <SliderPantalla label="Ancho (% de la pantalla)" valor={config[lado].ancho} sufijo="%" col={COL}
        min={RANGOS.panelAncho[0]} max={RANGOS.panelAncho[1]} disabled={guardando}
        onGuardar={(n) => aplicar({ [lado]: { ...config[lado], ancho: n } }, `${nombre}: ancho ${n}%.`)}/>
      <SliderPantalla label="Alto (% de la pantalla)" valor={config[lado].alto} sufijo="%" col={COL}
        min={RANGOS.panelAlto[0]} max={RANGOS.panelAlto[1]} disabled={guardando}
        onGuardar={(n) => aplicar({ [lado]: { ...config[lado], alto: n } }, `${nombre}: alto ${n}%.`)}/>
    </>
  );
  const tab = (activo) => ({ flex: 1, padding: "7px 8px", fontSize: 11, fontWeight: 700, borderRadius: 9, cursor: "pointer",
    background: activo ? `${COL}26` : "rgba(240,232,255,.04)", color: activo ? COL : "rgba(240,232,255,.5)",
    border: `1px solid ${activo ? COL : "rgba(240,232,255,.12)"}` });

  return (
    <>
      <div className="card" style={{ marginBottom: 10 }}>
        <div style={nota}>
          Durante la votación, el fondo es el video de la ronda a pantalla completa (o la imagen de fondo, si no hay
          video) y encima va siempre la máscara: paneles, barómetros, avatares, logo de BizarrApp y logo de duelo.
          Votación, Ganador y Empate se editan en las solapas del editor.
        </div>
        <AvisoGuardado aviso={aviso}/>
      </div>

      <SeccionConfig icon="🏷️" titulo="Logo de duelo" cuando="tv">
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <button type="button" style={tab(config.centro === "texto")} disabled={guardando}
            onClick={() => config.centro !== "texto" && aplicar({ centro: "texto" }, "Ahora se muestra el texto.")}>Aa Texto</button>
          <button type="button" style={tab(config.centro === "imagen")} disabled={guardando}
            onClick={() => config.imagen ? (config.centro !== "imagen" && aplicar({ centro: "imagen" }, "Ahora se muestra la imagen.")) : setLibOpen("logo")}>🖼️ Imagen</button>
        </div>

        {config.centro === "texto" ? (
          <div style={{ display: "flex", gap: 6 }}>
            <input value={texto} maxLength={TEXTO_MAX} onChange={(e) => setTexto(e.target.value)} placeholder="DUELO"
              aria-label="Texto del logo de duelo"
              style={{ flex: 1, minWidth: 0, padding: "8px 10px", borderRadius: 9, fontSize: 13, fontWeight: 700,
                background: "rgba(240,232,255,.05)", border: "1px solid rgba(240,232,255,.14)", color: "#F0E8FF", outline: "none" }}/>
            <button type="button" className="btn btn-g" style={{ padding: "7px 12px", fontSize: 11 }}
              disabled={guardando || !textoLimpio || !textoSucio}
              onClick={() => aplicar({ texto: textoLimpio }, `Texto guardado: «${textoLimpio}».`)}>
              {guardando ? "…" : "Guardar"}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 96, height: 60, borderRadius: 9, background: "rgba(240,232,255,.05)",
              border: "1px solid rgba(240,232,255,.12)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {config.imagen && <img src={config.imagen} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}/>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <button type="button" className="btn btn-g" style={{ padding: "7px 12px", fontSize: 11 }} disabled={guardando}
                onClick={() => setLibOpen("logo")}>Cambiar imagen</button>
              <button type="button" className="btn" style={{ padding: "7px 12px", fontSize: 11, background: "rgba(255,45,120,.08)",
                border: "1px solid rgba(255,45,120,.3)", color: "#FF8FB8" }} disabled={guardando}
                onClick={() => aplicar({ centro: "texto", imagen: null }, "Imagen quitada: vuelve a mostrarse el texto.")}>
                🗑 Quitar imagen
              </button>
            </div>
          </div>
        )}

        <SliderPantalla label="🔍 Tamaño (zoom)" valor={config.zoom} signo col={COL}
          min={ZOOM_MIN} max={ZOOM_MAX} disabled={guardando}
          onGuardar={(n) => aplicar({ zoom: n }, `Tamaño del logo: ${n > 0 ? `+${n}` : n}.`)}/>

        <div style={sub}>Posición</div>
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          {POSICIONES_LOGO.map((p) => (
            <button key={p.id} type="button" style={tab(config.logoPos === p.id)} disabled={guardando}
              onClick={() => config.logoPos !== p.id && aplicar({ logoPos: p.id }, `Logo de duelo: ${p.nombre.toLowerCase()}.`)}>
              {p.nombre}
            </button>
          ))}
        </div>

        <div style={{ ...sub, marginBottom: 6 }}>✨ Efecto</div>
        <SelectorEfecto valor={config.efecto} col={COL} disabled={guardando}
          onElegir={(e) => aplicar({ efecto: e.id }, `Efecto: ${e.nombre}.`)}/>
      </SeccionConfig>

      <SeccionConfig icon="🌄" titulo="Fondo y porcentajes" cuando="tv">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700 }}>👍 Porcentajes de cada duelista</div>
          <Toggle on={config.porcentajes} color={COL} disabled={guardando} etiqueta="Porcentajes de cada duelista"
            label={config.porcentajes ? "Visibles" : "Ocultos"}
            onToggle={() => aplicar({ porcentajes: !config.porcentajes },
              config.porcentajes ? "Porcentajes ocultos en la pantalla." : "Porcentajes visibles en la pantalla.")}/>
        </div>

        <div style={sub}>Imagen de fondo</div>
        <div style={nota}>
          Se ve cuando la ronda no tiene video (con video, el video cubre toda la pantalla).
          Tamaño recomendado: <b>1920 × 1080 px</b> (16:9, Full HD), JPG/PNG/WEBP de hasta 2 MB.
          Se ajusta para cubrir la pantalla: lo importante, dejalo en el centro.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
          <div style={{ width: 96, height: 54, borderRadius: 8, flexShrink: 0, background: "#050308 center / cover no-repeat",
            backgroundImage: config.fondo ? `url("${config.fondo}")` : "none", border: "1px solid rgba(240,232,255,.12)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, color: "rgba(240,232,255,.35)" }}>
            {!config.fondo && "Negro"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <button type="button" className="btn btn-g" style={{ padding: "6px 12px", fontSize: 11 }} disabled={guardando}
              onClick={() => setLibOpen("fondo")}>{config.fondo ? "Cambiar fondo" : "Elegir fondo"}</button>
            {config.fondo && (
              <button type="button" className="btn" style={{ padding: "6px 12px", fontSize: 11, background: "rgba(255,45,120,.08)",
                border: "1px solid rgba(255,45,120,.3)", color: "#FF8FB8" }} disabled={guardando}
                onClick={() => aplicar({ fondo: null }, "Fondo quitado: vuelve el negro.")}>🗑 Quitar fondo</button>
            )}
          </div>
        </div>
      </SeccionConfig>

      <SeccionConfig icon="▮▮" titulo="Paneles y barómetros" cuando="tv">
        <div style={nota}>Cada panel por separado. Si el alto es menor a 100 %, el panel queda centrado.</div>
        {panelSlider("panelIzq", "Panel izquierdo (participante 1)")}
        {panelSlider("panelDer", "Panel derecho (participante 2)")}

        <div style={sub}>📊 Barómetros</div>
        <div style={nota}>Iguales en los dos paneles; la ubicación horizontal se espeja para que queden simétricos.</div>
        <SliderPantalla label="Ancho (% del tamaño base)" valor={config.barometro.ancho} sufijo="%" col={COL}
          min={RANGOS.baroAncho[0]} max={RANGOS.baroAncho[1]} disabled={guardando}
          onGuardar={(n) => aplicar({ barometro: { ...config.barometro, ancho: n } }, `Barómetros: ancho ${n}%.`)}/>
        <SliderPantalla label="Alto (% del panel)" valor={config.barometro.alto} sufijo="%" col={COL}
          min={RANGOS.baroAlto[0]} max={RANGOS.baroAlto[1]} disabled={guardando}
          onGuardar={(n) => aplicar({ barometro: { ...config.barometro, alto: n } }, `Barómetros: alto ${n}%.`)}/>
        <SliderPantalla label="Ubicación vertical (0 % arriba · 100 % abajo)" valor={config.barometro.y} sufijo="%" col={COL}
          min={RANGOS.baroY[0]} max={RANGOS.baroY[1]} disabled={guardando}
          onGuardar={(n) => aplicar({ barometro: { ...config.barometro, y: n } }, `Barómetros: ubicación ${n}%.`)}/>
        <SliderPantalla label="Ubicación horizontal (0 % borde de la pantalla · 100 % hacia el centro)"
          valor={config.barometro.x} sufijo="%" col={COL}
          min={RANGOS.baroX[0]} max={RANGOS.baroX[1]} disabled={guardando}
          onGuardar={(n) => aplicar({ barometro: { ...config.barometro, x: n } }, `Barómetros: horizontal ${n}%.`)}/>
        <button type="button" className="btn btn-g" style={{ padding: "5px 12px", fontSize: 10.5, marginTop: 8 }}
          disabled={guardando || config.barometro.x === 50}
          onClick={() => aplicar({ barometro: { ...config.barometro, x: 50 } }, "Barómetros centrados en su panel.")}>
          ⇔ Centrar en el panel
        </button>
      </SeccionConfig>

      <MediaLibraryModal open={!!libOpen}
        title={libOpen === "fondo" ? "Imagen de fondo (1920 × 1080)" : "Logo de duelo (PNG o WEBP)"}
        onClose={() => setLibOpen(null)} onSelect={elegirImagen}/>
    </>
  );
}

/** Duelo de Talentos en sus cuatro vistas; el diseño de la pantalla, en Performance. */
/**
 * Las vistas del Duelo en el editor libre de pantallas (fila `lienzo_duelo`).
 * Arriba de la Performance siguen los ajustes de «Pantalla del duelo» (fondo,
 * logo del centro, paneles, barómetro, porcentajes): el logo del centro y el
 * fondo del editor salen de ahí.
 */
export default function DisenoDuelo({ nav }) {
  const pantalla = useDueloPantalla();
  const qr = usePantallaVisibilidadAdmin("qr");
  const datos = { centro: pantalla, qrUrl: `${window.location.origin}/?view=games&game=duelo` };
  const avisos = qr.config && qr.config.duelo === false ? { qr: "el QR del Duelo está apagado en «QR y logo» (arriba)." } : null;
  const editor = (vista) => {
    const pantallas = vista === "celular" ? PANTALLAS_DUELO_CEL : PANTALLAS_DUELO.filter((x) => x.vista === vista);
    if (!pantallas.length) return null;
    return <EditorLienzo key={vista} juego="duelo" formato={vista === "celular" ? "celular" : "tv"} pantallas={pantallas}
      porDefecto={DUELO_POR_DEFECTO} datos={datos} avisos={avisos}
      migrar={(id, p) => (id === "votacion" ? separarColumnas(p, pantalla) : p)}/>;
  };
  return (
    <VistasJuego juego="duelo" col={COL} nav={nav} editor={editor}
      controles={(vista, { guardado }) => (vista === "performance" ? <ControlesDuelo onGuardado={guardado}/> : null)}/>
  );
}
