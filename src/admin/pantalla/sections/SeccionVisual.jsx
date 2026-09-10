import { useRef, useState } from "react";
import { saveEventFields } from "../../../services/pantallaDj";
import { uploadMediaAsset } from "../../../services/mediaAssets";
import { P } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";
import { BotonGuardar, useBorrador, useGuardado } from "../panelControls";

const CAMPOS = ["accent_color", "text_color", "background_color", "logo_url", "background_image_url"];
const DEFECTOS = { accent_color: "#f5ce42", text_color: "#ffe6cc", background_color: "#000000" };
const esHex = (v) => /^#[0-9a-fA-F]{6}$/.test(v || "");

function ColorOriginal({ label, campo, valor, defecto, onChange }) {
  const efectivo = esHex(valor) ? valor : defecto;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
        <span className="pdj-campo-lbl">{label}</span>
        <button type="button" onClick={() => onChange(campo, "")}
          style={{ border: 0, background: "transparent", color: P.tenue2, cursor: "pointer", fontSize: 9.5 }}>
          Restablecer
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="color" value={efectivo} onChange={(e) => onChange(campo, e.target.value)}
          style={{ width: 45, height: 34, padding: 2, borderRadius: 4, background: "#09090c", border: "1px solid rgba(240,232,255,.25)" }} />
        <input className="pdj-input" value={valor || ""} placeholder={defecto}
          onChange={(e) => onChange(campo, e.target.value)} style={{ flex: 1, fontFamily: "monospace" }} />
      </div>
    </div>
  );
}

function ImagenOriginal({ label, valor, emptyIcon = "×", uploadText, onSubido, onQuitar, onError }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const subir = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const asset = await uploadMediaAsset(file, { category: "dj-branding" });
      if (asset?.file_url) onSubido(asset.file_url);
    } catch (err) { onError?.(err); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
        <span className="pdj-campo-lbl">{label}</span>
        {valor && <button type="button" onClick={onQuitar}
          style={{ border: 0, background: "transparent", color: P.tenue2, cursor: "pointer", fontSize: 9.5 }}>Quitar</button>}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ width: 48, height: 48, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(240,232,255,.13)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {valor ? <img src={valor} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <span style={{ color: P.tenue2 }}>{emptyIcon}</span>}
        </div>
        <button type="button" className="pdj-mini" disabled={busy} onClick={() => ref.current?.click()}>
          {busy ? "Subiendo…" : uploadText}
        </button>
        <input ref={ref} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={subir} />
      </div>
    </div>
  );
}

export default function SeccionVisual({ event, refresh, onError }) {
  const [b, set] = useBorrador(
    Object.fromEntries(CAMPOS.map((c) => [c, event[c] ?? ""])),
    [event.id, ...CAMPOS.map((c) => event[c])],
  );

  const { estado, mensaje, guardar } = useGuardado(async () => {
    await saveEventFields(event.id, Object.fromEntries(CAMPOS.map((c) => [c, String(b[c] || "").trim() || null])));
    await refresh();
  });

  const cambiado = CAMPOS.some((c) => String(b[c] || "") !== String(event[c] || ""));
  const hexMalo = ["accent_color", "text_color", "background_color"].some((c) => b[c] && !esHex(b[c]));
  const acento = esHex(b.accent_color) ? b.accent_color : DEFECTOS.accent_color;
  const texto = esHex(b.text_color) ? b.text_color : DEFECTOS.text_color;
  const fondo = esHex(b.background_color) ? b.background_color : DEFECTOS.background_color;

  return (
    <PanelSection id="visual" title="Personalización visual"
      status="pendiente"
      aviso="La edición y persistencia ya están disponibles; falta que TV y cliente consuman estos valores en todos sus layouts.">
      <div style={{ padding: 10, borderRadius: 14, background: "rgba(240,232,255,.02)", border: "1px solid rgba(240,232,255,.08)" }}>
        <div className="pdj-overview-label" style={{ textAlign: "left", marginBottom: 4 }}>PERSONALIZACIÓN VISUAL</div>
        <div className="pdj-campo-hint" style={{ marginTop: 0, marginBottom: 15 }}>Dejá cualquier campo vacío para usar el estilo por defecto.</div>

        <ColorOriginal label="COLOR DE ACENTO" campo="accent_color" valor={b.accent_color} defecto={DEFECTOS.accent_color} onChange={set} />
        <ColorOriginal label="COLOR DE TEXTO" campo="text_color" valor={b.text_color} defecto={DEFECTOS.text_color} onChange={set} />
        <ColorOriginal label="COLOR DE FONDO" campo="background_color" valor={b.background_color} defecto={DEFECTOS.background_color} onChange={set} />

        <ImagenOriginal label="LOGO" valor={b.logo_url} uploadText={b.logo_url ? "↥ Reemplazar" : "↥ Subir"}
          onSubido={(url) => set("logo_url", url)} onQuitar={() => set("logo_url", "")} onError={onError} />
        <ImagenOriginal label="IMAGEN DE FONDO" valor={b.background_image_url} uploadText="↥ Subir"
          onSubido={(url) => set("background_image_url", url)} onQuitar={() => set("background_image_url", "")} onError={onError} />

        <div className="pdj-campo-lbl" style={{ marginBottom: 6 }}>VISTA PREVIA</div>
        <div style={{ position: "relative", overflow: "hidden", borderRadius: 14, padding: 14, background: fondo, border: "1px solid rgba(240,232,255,.12)" }}>
          {b.background_image_url && <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${b.background_image_url})`, backgroundSize: "cover", backgroundPosition: "center", opacity: .28 }} />}
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10 }}>
            {b.logo_url && <img src={b.logo_url} alt="" style={{ width: 48, height: 48, objectFit: "contain" }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: acento, fontSize: 9.5, fontWeight: 800 }}>MI EVENTO</div>
              <div style={{ color: texto, fontSize: 13, fontWeight: 900, marginTop: 2 }}>Título de canción</div>
              <div style={{ height: 6, borderRadius: 999, background: "rgba(240,232,255,.15)", marginTop: 7, overflow: "hidden" }}>
                <div style={{ width: "50%", height: "100%", background: acento }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {hexMalo && <div className="pdj-campo-hint" style={{ color: P.amarillo }}>Los colores deben ser hexadecimales de 6 dígitos, por ejemplo #f5ce42.</div>}
      <BotonGuardar estado={estado} mensaje={mensaje} disabled={!cambiado || hexMalo} onClick={guardar} />
    </PanelSection>
  );
}
