import { useRef, useState } from "react";
import { saveEventFields } from "../../../services/pantallaDj";
import { uploadMediaAsset } from "../../../services/mediaAssets";
import { P } from "../../../components/pantalla/pantallaUi";
import { esKickDual } from "../../../constants/kickModos";
import { useBorrador, useGuardado } from "../panelControls";
import { textoGuardar } from "./SeccionReglas";

/**
 * Reglas de votación → Sacar Tema 👎 / Tomatazo 🍅 / Amor y Odio 🌹🍅 /
 * Guns & Roses 🔫🌹 (como en el original).
 *
 * Clásico y Tomatazo: los invitados votan para cortar la canción que suena; el
 * servidor (`pantalla_toggle_kick_vote`) la saltea al llegar al porcentaje de
 * invitados activos (sin Staff), nunca con menos que el mínimo de votos reales.
 *
 * Amor y Odio y Guns & Roses: cada invitado vota UNA vez, flor (+1) o tomate /
 * bala (−1) (`pantalla_kick_voto_fijo`). El medidor es positivos − negativos:
 * en el umbral positivo la canción queda a salvo, en el negativo se corta.
 *
 * En todos, con menos conectados que el mínimo la opción no aparece en el
 * celular y el servidor no acepta votos.
 */

const NARANJA = "#FF6A00";

const ESTILOS = [
  { id: "classic",    ico: "👎",   label: "Clásico" },
  { id: "tomato",     ico: "🍅",   label: "Tomatazo" },
  { id: "love_hate",  ico: "🌹🍅", label: "Amor y Odio" },
  { id: "guns_roses", ico: "🔫🌹", label: "Guns & Roses" },
];

const TEXTOS = [
  "kick_button_text", "kick_tv_text", "kick_meter_title", "kick_shoot_text", "kick_flower_text",
  "kick_tomato_flying_url", "kick_tomato_exploded_url", "kick_tomato_splat_url",
  "kick_flower_flying_url", "kick_flower_stuck_url", "kick_flower_icon_url",
  "kick_bullet_flying_url", "kick_shoot_icon_url",
];

const NUMEROS = {
  kick_threshold_pct:      { min: 1, max: 100,   def: 51 },
  kick_activity_minutes:   { min: 1, max: 600,   def: 45 },
  kick_min_votes:          { min: 1, max: 1000,  def: 1 },
  kick_min_connected:      { min: 0, max: 1000,  def: 0 },
  kick_positive_threshold: { min: 1, max: 1000,  def: 10 },
  kick_negative_threshold: { min: -1000, max: -1, def: -10 },
};

// Los que se ven (y se validan) en cada familia de modos.
const NUMEROS_PORCENTAJE = ["kick_threshold_pct", "kick_activity_minutes", "kick_min_votes", "kick_min_connected"];
const NUMEROS_DUAL       = ["kick_positive_threshold", "kick_negative_threshold", "kick_min_connected"];

const CAMPOS = ["kick_enabled", "kick_style", ...TEXTOS, ...Object.keys(NUMEROS), "kick_bullet_holes"];

const CSS = `
  .kr-hab{display:flex;align-items:center;gap:10px;margin-top:14px;padding:12px 14px;border-radius:14px;
    background:rgba(240,232,255,.03);border:1px solid rgba(240,232,255,.1);font-size:12.5px;font-weight:700;color:#F0E8FF;cursor:pointer;}
  .kr-estilos{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;}
  .kr-estilo{display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:999px;font:inherit;font-size:12px;
    font-weight:700;cursor:pointer;background:rgba(0,0,0,.25);color:rgba(240,232,255,.75);border:1px solid rgba(240,232,255,.14);}
  .kr-estilo[aria-pressed="true"]{color:${NARANJA};border-color:${NARANJA};background:rgba(255,106,0,.1);}
  .kr-estilo:disabled{opacity:.45;cursor:default;}
  .kr-caja{margin-top:14px;padding:14px;border-radius:14px;background:rgba(0,0,0,.2);border:1px solid rgba(240,232,255,.1);}
  .kr-dos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;}
  .kr-imgs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px;}
  @media (max-width:520px){ .kr-dos,.kr-imgs{grid-template-columns:1fr;} }
  .kr-num{width:100%;}
  .kr-huecos{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;}
  .kr-hueco{position:relative;width:52px;height:52px;border-radius:10px;overflow:hidden;
    background:rgba(240,232,255,.04);border:1px solid rgba(240,232,255,.12);}
  .kr-hueco img{width:100%;height:100%;object-fit:contain;}
  .kr-hueco button{position:absolute;top:2px;right:2px;width:18px;height:18px;border-radius:50%;border:none;cursor:pointer;
    font-size:10px;line-height:18px;padding:0;background:rgba(8,4,15,.8);color:#FF6B8B;}
`;

/** Sube una imagen a la biblioteca del bar y devuelve su URL. */
async function subirImagen(file, category) {
  const asset = await uploadMediaAsset(file, { category });
  return asset?.file_url || null;
}

/** Imagen de un modo: miniatura (o emoji) + «Subir». */
function Imagen({ label, valor, emoji, disabled, onSubido, onError }) {
  const ref = useRef(null);
  const [subiendo, setSubiendo] = useState(false);
  const elegir = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSubiendo(true);
    try { const url = await subirImagen(file, "dj-sacar-tema"); if (url) onSubido(url); }
    catch (err) { onError?.(err); }
    finally { setSubiendo(false); }
  };
  return (
    <div style={{ minWidth: 0 }}>
      <div className="rv-desc" style={{ fontWeight: 800, marginBottom: 6, textTransform: "uppercase", letterSpacing: .5 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, overflow: "hidden", flexShrink: 0, display: "grid",
          placeItems: "center", fontSize: 20, background: "rgba(240,232,255,.04)", border: "1px solid rgba(240,232,255,.12)" }}>
          {valor ? <img src={valor} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }}/> : emoji}
        </div>
        <button type="button" className="pdj-mini" disabled={disabled || subiendo} onClick={() => ref.current?.click()}>
          {subiendo ? "Subiendo…" : "Subir"}
        </button>
        {valor && (
          <button type="button" className="pdj-mini" disabled={disabled} onClick={() => onSubido("")}
            title="Volver al dibujo por defecto">✕</button>
        )}
        <input ref={ref} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif" onChange={elegir}/>
      </div>
    </div>
  );
}

export default function KickReglas({ event, refresh, onError }) {
  const inicial = {
    kick_enabled: !!event.kick_enabled,
    kick_style:   event.kick_style || "classic",
    ...Object.fromEntries(TEXTOS.map((c) => [c, event[c] || ""])),
    ...Object.fromEntries(Object.entries(NUMEROS).map(([c, r]) => [c, event[c] ?? r.def])),
    kick_bullet_holes: Array.isArray(event.kick_bullet_holes) ? event.kick_bullet_holes : [],
  };
  const [b, set] = useBorrador(inicial, [event.id, ...CAMPOS.map((c) => JSON.stringify(event[c] ?? null))]);
  const [subiendoHuecos, setSubiendoHuecos] = useState(false);
  const huecosRef = useRef(null);

  const dual  = esKickDual(b.kick_style);
  const guns  = b.kick_style === "guns_roses";
  const tomate = b.kick_style === "tomato";
  const off   = !b.kick_enabled;

  const { estado, mensaje, guardar } = useGuardado(async () => {
    const vacio = (v) => String(v || "").trim() || null;
    await saveEventFields(event.id, {
      kick_enabled: b.kick_enabled,
      kick_style:   b.kick_style,
      ...Object.fromEntries(TEXTOS.map((c) => [c, vacio(b[c])])),
      kick_button_text: vacio(b.kick_button_text) || "Sacar Tema",
      kick_shoot_text:  vacio(b.kick_shoot_text)  || "Matar el Tema",
      kick_flower_text: vacio(b.kick_flower_text) || "Salvar el Tema",
      ...Object.fromEntries(Object.keys(NUMEROS).map((c) => [c, Number(b[c])])),
      kick_bullet_holes: b.kick_bullet_holes,
    });
    await refresh();
  });

  const cambiado = CAMPOS.some((c) => JSON.stringify(b[c] ?? "") !== JSON.stringify(inicial[c] ?? ""));
  const fueraDeRango = (dual ? NUMEROS_DUAL : NUMEROS_PORCENTAJE).find((c) => {
    const n = Number(b[c]);
    return !Number.isInteger(n) || n < NUMEROS[c].min || n > NUMEROS[c].max;
  });

  const subirHuecos = async (e) => {
    const files = [...e.target.files];
    e.target.value = "";
    if (!files.length) return;
    setSubiendoHuecos(true);
    try {
      const urls = [];
      for (const f of files) { const u = await subirImagen(f, "dj-sacar-tema"); if (u) urls.push(u); }
      set("kick_bullet_holes", [...b.kick_bullet_holes, ...urls]);
    } catch (err) { onError?.(err); }
    finally { setSubiendoHuecos(false); }
  };

  const numero = (campo, label, hint, enLinea = true) => (
    <div className="rv-campo" style={{ opacity: off ? .5 : 1 }}>
      {enLinea ? (
        <label className="rv-inline">
          {label}
          <input className="pdj-input" type="number" min={NUMEROS[campo].min} max={NUMEROS[campo].max}
            value={b[campo]} disabled={off} onChange={(e) => set(campo, e.target.value)}/>
        </label>
      ) : (
        <>
          <label className="rv-lbl">{label}</label>
          <input className="pdj-input kr-num" type="number" min={NUMEROS[campo].min} max={NUMEROS[campo].max}
            value={b[campo]} disabled={off} onChange={(e) => set(campo, e.target.value)}/>
        </>
      )}
      <div className="rv-desc">{hint}</div>
    </div>
  );

  const texto = (campo, label, placeholder, hint, max = 120) => (
    <div className="rv-campo" style={{ opacity: off ? .5 : 1 }}>
      <label className="rv-lbl" htmlFor={campo}>{label}</label>
      <input id={campo} className="pdj-input" value={b[campo]} maxLength={max} disabled={off}
        placeholder={placeholder} onChange={(e) => set(campo, e.target.value)} style={{ width: "100%" }}/>
      {hint && <div className="rv-desc">{hint}</div>}
    </div>
  );

  return (
    <div className="rv-card">
      <style>{CSS}</style>
      <div className="rv-tit">Sacar Tema 👎 / Tomatazo 🍅 / Amor y Odio 🌹🍅 / Guns &amp; Roses 🔫🌹</div>
      <div className="rv-desc">
        Los invitados pueden votar en conjunto para sacar la canción que está sonando. En Clásico y Tomatazo se
        corta al cruzar el porcentaje configurado. En Amor y Odio cada invitado vota una sola vez: si el medidor
        llega al umbral negativo se corta el tema, y si llega al positivo la canción queda a salvo.
      </div>

      <label className="kr-hab">
        <span style={{ flex: 1 }}>Habilitar “Sacar Tema”</span>
        <input type="checkbox" className="rv-caja" checked={b.kick_enabled}
          onChange={(e) => set("kick_enabled", e.target.checked)}/>
      </label>

      <div className="rv-campo" style={{ opacity: off ? .5 : 1 }}>
        <span className="rv-lbl">Estilo visual</span>
        <div className="kr-estilos" role="radiogroup" aria-label="Estilo visual">
          {ESTILOS.map((e) => (
            <button key={e.id} type="button" className="kr-estilo" role="radio" aria-checked={b.kick_style === e.id}
              aria-pressed={b.kick_style === e.id} disabled={off} onClick={() => set("kick_style", e.id)}>
              <span>{e.ico}</span>{e.label}
            </button>
          ))}
        </div>
        <div className="rv-desc" style={{ marginTop: 8 }}>
          Sólo uno puede estar activo. En modo Tomatazo, cada voto nuevo lanza un tomate a la pantalla TV:
          mientras más cerca del umbral, más al centro impacta. En Amor y Odio el voto es único y definitivo, y se
          usan números fijos en vez de porcentaje.
        </div>
      </div>

      {/* ── Tomatazo ── */}
      {tomate && (
        <div className="kr-caja" style={{ opacity: off ? .5 : 1 }}>
          <div className="rv-desc">Si alguna queda vacía, la TV usa su dibujo por defecto para esa etapa.</div>
          <div className="kr-imgs">
            <Imagen label="Tomate volando" emoji="🍅" valor={b.kick_tomato_flying_url} disabled={off}
              onSubido={(u) => set("kick_tomato_flying_url", u)} onError={onError}/>
            <Imagen label="Tomate explotado" emoji="💥" valor={b.kick_tomato_exploded_url} disabled={off}
              onSubido={(u) => set("kick_tomato_exploded_url", u)} onError={onError}/>
            <Imagen label="Mancha / rastro" emoji="🩸" valor={b.kick_tomato_splat_url} disabled={off}
              onSubido={(u) => set("kick_tomato_splat_url", u)} onError={onError}/>
          </div>
        </div>
      )}

      {/* ── Amor y Odio / Guns & Roses ── */}
      {dual && (
        <div className="kr-caja" style={{ opacity: off ? .5 : 1 }}>
          {guns && (
            <div className="rv-desc" style={{ marginTop: 0, marginBottom: 6 }}>
              Mismo mecanismo que Amor y Odio (un voto por invitado, umbral positivo / negativo), con estética de
              Guns &amp; Roses: balas para cortar el tema y flores para salvarlo.
            </div>
          )}
          <div className="kr-dos">
            {numero("kick_positive_threshold", "Umbral positivo (flores para salvar)",
              "Al alcanzarlo, la canción queda a salvo y no se puede votar más.", false)}
            {numero("kick_negative_threshold", guns ? "Umbral negativo (balas para cortar)" : "Umbral negativo (tomates para cortar)",
              "Al llegar, se corta el tema, como en Sacar Tema.", false)}
          </div>

          <div className="kr-imgs">
            {guns && (
              <Imagen label="Bala volando" emoji="•" valor={b.kick_bullet_flying_url} disabled={off}
                onSubido={(u) => set("kick_bullet_flying_url", u)} onError={onError}/>
            )}
            <Imagen label="Flor volando" emoji="🌹" valor={b.kick_flower_flying_url} disabled={off}
              onSubido={(u) => set("kick_flower_flying_url", u)} onError={onError}/>
            <Imagen label="Flor pegada" emoji="🌹" valor={b.kick_flower_stuck_url} disabled={off}
              onSubido={(u) => set("kick_flower_stuck_url", u)} onError={onError}/>
            {guns && (
              <Imagen label="Ícono del botón de tiro (celular)" emoji="🔫" valor={b.kick_shoot_icon_url} disabled={off}
                onSubido={(u) => set("kick_shoot_icon_url", u)} onError={onError}/>
            )}
            <Imagen label={guns ? "Ícono del botón de flor (celular)" : "Ícono de flor (botón del celular y medidor TV)"}
              emoji="🌹" valor={b.kick_flower_icon_url} disabled={off}
              onSubido={(u) => set("kick_flower_icon_url", u)} onError={onError}/>
          </div>
          {!guns && (
            <div className="rv-desc" style={{ marginTop: 10 }}>
              Los tomates usan las imágenes del Tomatazo (o su dibujo por defecto).
            </div>
          )}

          {guns && (
            <>
              <div className="kr-dos">
                {texto("kick_shoot_text", "Texto del botón de tiro", "Matar el Tema", "Por defecto: «Matar el Tema»", 30)}
                {texto("kick_flower_text", "Texto del botón de flor", "Salvar el Tema", "Por defecto: «Salvar el Tema»", 30)}
              </div>

              <div className="kr-caja" style={{ marginTop: 14 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div className="rv-lbl" style={{ margin: 0 }}>Agujeros de bala</div>
                    <div className="rv-desc">
                      Podés cargar varias imágenes: en cada impacto se elige una al azar. Sin imágenes, la TV dibuja
                      un agujero por defecto.
                    </div>
                  </div>
                  <input ref={huecosRef} type="file" hidden multiple accept="image/png,image/webp,image/gif"
                    onChange={subirHuecos}/>
                  <button type="button" className="pdj-mini" disabled={off || subiendoHuecos}
                    onClick={() => huecosRef.current?.click()}>{subiendoHuecos ? "Subiendo…" : "Agregar"}</button>
                </div>
                {b.kick_bullet_holes.length === 0 ? (
                  <div className="rv-desc" style={{ marginTop: 8, color: P.tenue }}>Todavía no hay imágenes en la galería.</div>
                ) : (
                  <div className="kr-huecos">
                    {b.kick_bullet_holes.map((u, i) => (
                      <div key={`${u}-${i}`} className="kr-hueco">
                        <img src={u} alt=""/>
                        <button type="button" aria-label="Quitar" disabled={off}
                          onClick={() => set("kick_bullet_holes", b.kick_bullet_holes.filter((_, j) => j !== i))}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {!guns && texto("kick_button_text", "Texto del botón (pantalla del invitado)", "Sacar Tema",
        dual ? "En Amor y Odio es el botón del tomate; el de la flor dice «Salvar»." : null, 40)}

      {dual && texto("kick_meter_title", "Título del medidor en TV (opcional)",
        guns ? "🔫🌹 Guns & Roses" : "🌹🍅 Amor y Odio", "Se muestra arriba del medidor en la pantalla TV. Vacío = sin título.", 60)}

      {!dual && numero("kick_threshold_pct", "Porcentaje necesario (1–100%)",
        "Se calcula sobre los invitados activos (sin contar Staff).")}
      {!dual && numero("kick_activity_minutes", "Ventana de actividad (minutos)",
        "Un invitado cuenta como activo si estuvo presente en los últimos N minutos.")}
      {!dual && numero("kick_min_votes", "Mínimo de votos reales",
        "Nunca se corta un tema con menos votos que este número, aunque el porcentaje diera menos.")}
      {numero("kick_min_connected", "Mínimo de conectados para mostrar la opción",
        "Con menos invitados activos que este número, el botón no aparece en el celular ni el contador en la TV.")}

      {texto("kick_tv_text", "Texto del cartel en TV", "El pueblo quitó este tema de forma democrática",
        "Se proyecta cuando el tema se corta por votación.")}

      <button type="button" className="rv-btn" disabled={!cambiado || !!fueraDeRango || estado === "guardando"}
        onClick={guardar}>
        {textoGuardar(estado)}
      </button>
      {fueraDeRango && (
        <div className="rv-error">
          Revisá los números: {`entre ${NUMEROS[fueraDeRango].min} y ${NUMEROS[fueraDeRango].max}`}.
        </div>
      )}
      {estado === "error" && mensaje && <div className="rv-error">{mensaje}</div>}
    </div>
  );
}
