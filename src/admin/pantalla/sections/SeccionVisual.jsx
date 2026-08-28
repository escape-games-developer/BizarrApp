import { useState } from "react";
import { saveEventFields } from "../../../services/pantallaDj";
import MediaLibraryModal from "../../../components/media/MediaLibraryModal";
import { P } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";
import { BotonGuardar, Campo, useBorrador, useGuardado } from "../panelControls";

/**
 * Personalización visual del evento.
 *
 * Los colores viven en `pantalla_events` como texto hexadecimal; en NULL, cada
 * superficie usa su color por defecto de BizarrApp — por eso «Quitar» guarda
 * NULL y no un negro cualquiera.
 *
 * El logo y el fondo se eligen de la biblioteca de imágenes que el bar ya
 * tiene (`media_assets` + bucket `bizarren-media`). No hay subida propia acá:
 * sería una segunda biblioteca para mantener.
 */

const CAMPOS = ["accent_color", "text_color", "background_color", "logo_url", "background_image_url"];

const DEFECTOS = {
  accent_color:     P.violeta,
  text_color:       P.texto,
  background_color: P.bg,
};

const esHex = (v) => /^#[0-9a-fA-F]{6}$/.test(v || "");

function CampoColor({ label, valor, defecto, hint, onChange }) {
  const efectivo = esHex(valor) ? valor : defecto;
  return (
    <Campo label={label} hint={hint}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input type="color" value={efectivo} aria-label={label}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: 40, height: 34, padding: 2, borderRadius: 9, cursor: "pointer",
            background: "rgba(240,232,255,.05)", border: "1px solid rgba(240,232,255,.12)",
          }} />
        <input className="pdj-input" value={valor ?? ""} placeholder={`${defecto} (por defecto)`}
          maxLength={7} aria-label={`${label} en hexadecimal`}
          onChange={(e) => onChange(e.target.value)}
          style={{ flex: 1, minWidth: 0, fontFamily: "monospace", fontSize: 11.5 }} />
        {valor && (
          <button type="button" className="pdj-mini" onClick={() => onChange("")}>Quitar</button>
        )}
      </div>
    </Campo>
  );
}

function CampoImagen({ label, valor, hint, onElegir, onQuitar }) {
  return (
    <Campo label={label} hint={hint}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {valor ? (
          <img src={valor} alt="" style={{
            width: 44, height: 44, borderRadius: 9, objectFit: "cover", flexShrink: 0,
            border: "1px solid rgba(240,232,255,.12)",
          }} />
        ) : (
          <div style={{
            width: 44, height: 44, borderRadius: 9, flexShrink: 0, fontSize: 17,
            display: "flex", alignItems: "center", justifyContent: "center", opacity: .3,
            background: "rgba(240,232,255,.05)", border: "1px dashed rgba(240,232,255,.14)",
          }}>🖼</div>
        )}
        <button type="button" className="pdj-mini" onClick={onElegir} style={{ flex: 1 }}>
          {valor ? "Cambiar" : "Elegir de la biblioteca"}
        </button>
        {valor && <button type="button" className="pdj-mini" onClick={onQuitar}>Quitar</button>}
      </div>
    </Campo>
  );
}

export default function SeccionVisual({ event, refresh }) {
  const [b, set] = useBorrador(
    Object.fromEntries(CAMPOS.map((c) => [c, event[c] ?? ""])),
    [event.id, ...CAMPOS.map((c) => event[c])],
  );
  const [biblioteca, setBiblioteca] = useState(null); // 'logo_url' | 'background_image_url'

  const { estado, mensaje, guardar } = useGuardado(async () => {
    await saveEventFields(event.id,
      Object.fromEntries(CAMPOS.map((c) => [c, String(b[c] || "").trim() || null])));
    await refresh();
  });

  const cambiado = CAMPOS.some((c) => String(b[c] || "") !== String(event[c] || ""));
  const hexMalo = ["accent_color", "text_color", "background_color"]
    .some((c) => b[c] && !esHex(b[c]));

  const acento = esHex(b.accent_color)     ? b.accent_color     : DEFECTOS.accent_color;
  const texto  = esHex(b.text_color)       ? b.text_color       : DEFECTOS.text_color;
  const fondo  = esHex(b.background_color) ? b.background_color : DEFECTOS.background_color;

  return (
    <PanelSection id="visual" title="Personalización visual" icon="🎨">
      <CampoColor label="Color de acento" valor={b.accent_color} defecto={DEFECTOS.accent_color}
        onChange={(v) => set("accent_color", v)}
        hint="Botones, resaltados y el marcador de la canción que va ganando." />

      <CampoColor label="Color de texto" valor={b.text_color} defecto={DEFECTOS.text_color}
        onChange={(v) => set("text_color", v)} />

      <CampoColor label="Color de fondo" valor={b.background_color} defecto={DEFECTOS.background_color}
        onChange={(v) => set("background_color", v)} />

      <CampoImagen label="Logo" valor={b.logo_url}
        hint="Se muestra en la TV y en la pantalla del invitado."
        onElegir={() => setBiblioteca("logo_url")}
        onQuitar={() => set("logo_url", "")} />

      <CampoImagen label="Imagen de fondo" valor={b.background_image_url}
        hint="Va detrás del color de fondo. Si no hay, queda el color solo."
        onElegir={() => setBiblioteca("background_image_url")}
        onQuitar={() => set("background_image_url", "")} />

      {/* ── Vista previa ────────────────────────────────────────────── */}
      <div style={{ marginTop: 4, marginBottom: 10 }}>
        <span className="pdj-campo-lbl">Vista previa</span>
        <div style={{
          borderRadius: 13, padding: "16px 14px", overflow: "hidden", position: "relative",
          background: fondo, border: "1px solid rgba(240,232,255,.12)",
        }}>
          {b.background_image_url && (
            <div style={{
              position: "absolute", inset: 0, opacity: .3,
              backgroundImage: `url(${b.background_image_url})`,
              backgroundSize: "cover", backgroundPosition: "center",
            }} />
          )}
          <div style={{ position: "relative" }}>
            {b.logo_url && (
              <img src={b.logo_url} alt="" style={{
                height: 26, objectFit: "contain", display: "block", marginBottom: 9,
              }} />
            )}
            <div style={{
              fontFamily: "'Syne',sans-serif", fontWeight: 900, fontSize: 15, color: texto,
            }}>{event.name}</div>
            <div style={{ fontSize: 11, color: texto, opacity: .6, marginTop: 2 }}>
              Así se ve el título y el texto del evento.
            </div>
            <div style={{
              display: "inline-block", marginTop: 10, padding: "6px 14px", borderRadius: 20,
              background: acento, color: fondo,
              fontFamily: "'Syne',sans-serif", fontWeight: 900, fontSize: 11,
            }}>👍 Votar</div>
          </div>
        </div>
      </div>

      {hexMalo && (
        <div className="pdj-campo-hint" style={{ color: P.amarillo, marginTop: -4 }}>
          Los colores van en hexadecimal de 6 dígitos, con numeral. Ej: #9B2FFF
        </div>
      )}

      <BotonGuardar estado={estado} mensaje={mensaje}
        disabled={!cambiado || hexMalo} onClick={guardar} />

      <MediaLibraryModal
        open={biblioteca !== null}
        title={biblioteca === "logo_url" ? "Elegir logo" : "Elegir imagen de fondo"}
        onClose={() => setBiblioteca(null)}
        onSelect={(asset) => {
          if (biblioteca && asset?.file_url) set(biblioteca, asset.file_url);
          setBiblioteca(null);
        }} />
    </PanelSection>
  );
}
