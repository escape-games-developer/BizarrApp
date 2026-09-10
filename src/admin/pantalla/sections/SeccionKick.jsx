import { useRef, useState } from "react";
import { saveEventFields } from "../../../services/pantallaDj";
import { P } from "../../../components/pantalla/pantallaUi";
import { uploadMediaAsset } from "../../../services/mediaAssets";
import PanelSection from "../PanelSection";
import {
  BotonGuardar, CampoNumero, CampoSwitch, CampoTexto, useBorrador, useGuardado,
} from "../panelControls";

/**
 * Sacar Tema — la votación para voltear la canción que está sonando.
 *
 * El porcentaje se mide sobre los participantes activos, sin contar al Staff, y
 * la ventana de actividad define quién cuenta como activo. Al alcanzarse el
 * umbral el servidor saltea la canción solo: el panel sólo fija las reglas.
 *
 * ── Estilo visual ──────────────────────────────────────────────────────────
 * La original ofrece dos presentaciones del mismo mecanismo: 👎 Clásico y 🍅
 * Tomatazo. El Tomatazo suma tres imágenes (tomate volando, reventado y la
 * mancha que queda) porque cada voto tira un tomate a la pantalla.
 *
 * Esas cuatro columnas todavía no están en la base. En vez de esconder los
 * controles o ponerlos como adorno, la sección DETECTA si la columna existe
 * —`event.kick_style` viene `undefined` mientras no esté— y en ese caso los
 * muestra deshabilitados con el nombre exacto de la migración que los prende.
 * Cuando esa migración se aplique, estos controles se activan solos: no hay que
 * volver a tocar este archivo.
 */

const CAMPOS_BASE = [
  "kick_enabled", "kick_button_text", "kick_threshold_pct", "kick_activity_minutes", "kick_tv_text",
];

const CAMPOS_TOMATE = [
  "kick_tomato_flying_url", "kick_tomato_exploded_url", "kick_tomato_splat_url",
];

const MIGRACION = "20260909120000_pantalla_kick_style_y_rol_dj.sql";

const ESTILOS = [
  { id: "classic", ico: "👎", label: "Clásico",  desc: "Un pulgar abajo y una barra de progreso." },
  { id: "tomato",  ico: "🍅", label: "Tomatazo", desc: "Cada voto revolea un tomate a la pantalla." },
];

/** Subida directa como en la original, reutilizando la biblioteca central del bar. */
function CampoAsset({ label, valor, disabled, onSubido, onError }) {
  const inputRef = useRef(null);
  const [subiendo, setSubiendo] = useState(false);

  const elegir = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSubiendo(true);
    try {
      const asset = await uploadMediaAsset(file, { category: "dj-tomatazo" });
      if (asset?.file_url) onSubido(asset.file_url);
    } catch (err) { onError?.(err); }
    finally { setSubiendo(false); }
  };

  return (
    <div style={{ minWidth: 0 }}>
      <div className="pdj-campo-lbl" style={{ marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 10, overflow: "hidden", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(240,232,255,.04)", border: "1px solid rgba(240,232,255,.12)",
        }}>
          {valor ? <img src={valor} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <span>🍅</span>}
        </div>
        <button type="button" className="pdj-mini" disabled={disabled || subiendo}
          onClick={() => inputRef.current?.click()}>
          {subiendo ? "Subiendo…" : "Subir"}
        </button>
        <input ref={inputRef} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={elegir} />
      </div>
    </div>
  );
}

export default function SeccionKick({ event, refresh, onError }) {
  // La columna todavía puede no existir: `select("*")` simplemente no la trae.
  const soportaEstilo = event.kick_style !== undefined;

  const [b, set] = useBorrador(
    {
      kick_enabled:          event.kick_enabled,
      kick_button_text:      event.kick_button_text || "",
      kick_threshold_pct:    event.kick_threshold_pct,
      kick_activity_minutes: event.kick_activity_minutes,
      kick_tv_text:          event.kick_tv_text || "",
      kick_style:            event.kick_style || "classic",
      kick_tomato_flying_url:   event.kick_tomato_flying_url   || "",
      kick_tomato_exploded_url: event.kick_tomato_exploded_url || "",
      kick_tomato_splat_url:    event.kick_tomato_splat_url    || "",
    },
    [
      event.id, event.kick_enabled, event.kick_button_text, event.kick_threshold_pct,
      event.kick_activity_minutes, event.kick_tv_text, event.kick_style,
      event.kick_tomato_flying_url, event.kick_tomato_exploded_url, event.kick_tomato_splat_url,
    ],
  );

  const { estado, mensaje, guardar } = useGuardado(async () => {
    const patch = {
      kick_enabled:          b.kick_enabled,
      kick_button_text:      b.kick_button_text.trim() || "Voltear este tema",
      kick_threshold_pct:    b.kick_threshold_pct,
      kick_activity_minutes: b.kick_activity_minutes,
      kick_tv_text:          b.kick_tv_text.trim() || null,
    };
    // Las columnas del estilo sólo se mandan si existen: incluirlas antes haría
    // fallar el UPDATE entero y se perderían también los cinco campos que sí
    // funcionan hoy.
    if (soportaEstilo) {
      patch.kick_style = b.kick_style;
      for (const c of CAMPOS_TOMATE) patch[c] = String(b[c] || "").trim() || null;
    }
    await saveEventFields(event.id, patch);
    await refresh();
  });

  const cambiado =
    CAMPOS_BASE.some((c) => b[c] !== (event[c] ?? ""))
    || (soportaEstilo && (
      b.kick_style !== (event.kick_style || "classic")
      || CAMPOS_TOMATE.some((c) => String(b[c] || "") !== String(event[c] || ""))
    ));

  const off     = !b.kick_enabled;
  const tomate  = soportaEstilo && b.kick_style === "tomato";
  const bloqueo = off || !soportaEstilo;

  return (
    <PanelSection id="sacar-tema" title="Sacar Tema" icon={tomate ? "🍅" : "👎"}>
      <CampoSwitch label="Sacar Tema habilitado" checked={b.kick_enabled}
        onChange={(v) => set("kick_enabled", v)} />

      {/* ── Estilo visual ───────────────────────────────────────────── */}
      <div style={{ marginTop: 12, opacity: off ? .5 : 1 }}>
        <span className="pdj-campo-lbl">Estilo visual</span>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 4 }}>
          {ESTILOS.map((e) => {
            const activo = b.kick_style === e.id;
            return (
              <button key={e.id} type="button" disabled={bloqueo}
                aria-pressed={activo}
                onClick={() => set("kick_style", e.id)}
                style={{
                  textAlign: "left", padding: "9px 10px", borderRadius: 11, cursor: bloqueo ? "default" : "pointer",
                  background: activo ? "rgba(155,47,255,.14)" : "rgba(240,232,255,.035)",
                  border: `1px solid ${activo ? "rgba(155,47,255,.42)" : "rgba(240,232,255,.08)"}`,
                  color: P.texto, opacity: bloqueo ? .5 : 1,
                }}>
                <div style={{
                  fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", gap: 5,
                }}>
                  <span style={{ fontSize: 15 }}>{e.ico}</span>{e.label}
                </div>
                <div style={{ fontSize: 9.5, color: P.tenue2, marginTop: 3, lineHeight: 1.45 }}>
                  {e.desc}
                </div>
              </button>
            );
          })}
        </div>

        {!soportaEstilo && (
          <div className="pdj-campo-hint" style={{ color: P.amarillo }}>
            <strong>Falta la base</strong> — el selector y las imágenes del Tomatazo necesitan las
            columnas <code>kick_style</code> y <code>kick_tomato_*</code>. Están escritas en{" "}
            <code>{MIGRACION}</code>, sin aplicar. Apenas se aplique, estos controles se prenden
            solos. Mientras tanto el botón usa el estilo clásico.
          </div>
        )}
      </div>

      {/* ── Imágenes del Tomatazo ───────────────────────────────────── */}
      {tomate && (
        <div style={{
          marginTop: 12, padding: "10px 11px", borderRadius: 12,
          background: "rgba(255,45,120,.05)", border: "1px solid rgba(255,45,120,.2)",
          opacity: off ? .5 : 1,
        }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: P.fucsia, marginBottom: 7 }}>
            🍅 IMÁGENES DEL TOMATAZO
          </div>
          <div className="pdj-campo-hint" style={{ marginTop: 0, marginBottom: 8 }}>
            Si alguna queda vacía, la TV usa su dibujo por defecto para esa etapa.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 14 }}>
            <CampoAsset label="TOMATE VOLANDO" valor={b.kick_tomato_flying_url} disabled={off}
              onSubido={(url) => set("kick_tomato_flying_url", url)} onError={onError} />
            <CampoAsset label="TOMATE EXPLOTADO" valor={b.kick_tomato_exploded_url} disabled={off}
              onSubido={(url) => set("kick_tomato_exploded_url", url)} onError={onError} />
            <CampoAsset label="MANCHA / RASTRO" valor={b.kick_tomato_splat_url} disabled={off}
              onSubido={(url) => set("kick_tomato_splat_url", url)} onError={onError} />
          </div>


        </div>
      )}

      <div style={{ marginTop: 11, opacity: off ? .5 : 1 }}>
        <CampoTexto label="Texto del botón en el cliente" value={b.kick_button_text}
          disabled={off} maxLength={40}
          placeholder={tomate ? "Tirale un tomate" : "Voltear este tema"}
          onChange={(v) => set("kick_button_text", v)}
          hint="Lo que lee el invitado en su celular. Si queda vacío vuelve a «Voltear este tema»." />

        <CampoNumero label="Porcentaje necesario (%)" min={1} max={100} disabled={off}
          value={b.kick_threshold_pct} onChange={(v) => set("kick_threshold_pct", v)}
          hint="Se calcula sobre los participantes activos, sin contar al Staff." />

        <CampoNumero label="Ventana de actividad (minutos)" min={1} max={600} disabled={off}
          value={b.kick_activity_minutes} onChange={(v) => set("kick_activity_minutes", v)}
          hint="Alguien cuenta como activo si su último heartbeat entra en esta ventana." />

        {/* Único subcampo de la sección que todavía no llega a ningún lado: la
            TV no lee `kick_tv_text`. El resto (habilitar, %, ventana y texto del
            botón) sí gobierna el comportamiento real del kick. */}
        <CampoTexto label="Texto del cartel en la TV" value={b.kick_tv_text} disabled={off}
          maxLength={120} placeholder="El pueblo quitó este tema de forma democrática"
          onChange={(v) => set("kick_tv_text", v)} />

      </div>

      <BotonGuardar estado={estado} mensaje={mensaje} disabled={!cambiado} onClick={guardar} />


    </PanelSection>
  );
}
