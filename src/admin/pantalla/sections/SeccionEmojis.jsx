import { useCallback, useEffect, useState } from "react";
import { fetchEmojiPacks, saveEmojiPacks } from "../../../services/pantallaConfig";
import { P } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";
import { BotonGuardar, useGuardado } from "../panelControls";

/**
 * Qué emojis puede tirar cada rol a la pantalla.
 *
 * Una fila por (evento, rol) en `pantalla_emoji_packs`, con la lista en un
 * `text[]`. Se escriben pegados o separados por espacios; el parseo usa
 * `Intl.Segmenter` cuando está, que es lo único que agrupa bien un emoji
 * compuesto (bandera, familia, tono de piel) en vez de partirlo por code unit.
 */

const ROLES = [
  { id: "guest",    label: "Invitado",    color: P.tenue,    ico: "👤", sugeridos: "🔥 👏 ❤️ 😂 🤘" },
  { id: "vip",      label: "VIP",         color: P.amarillo, ico: "👑", sugeridos: "👑 💎 🥂 🔥 ✨" },
  { id: "birthday", label: "Cumpleañero", color: P.fucsia,   ico: "🎂", sugeridos: "🎂 🎉 🎈 🥳 🎁" },
  { id: "staff",    label: "Staff",       color: P.cyan,     ico: "🛠", sugeridos: "🛠 🎧 📢 ⚡" },
];

/** Corta una cadena en emojis enteros, sin romper los compuestos. */
function aEmojis(texto) {
  const limpio = String(texto || "").replace(/[\s,]+/g, "");
  if (!limpio) return [];
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const seg = new Intl.Segmenter("es", { granularity: "grapheme" });
    return [...seg.segment(limpio)].map((s) => s.segment).filter(Boolean);
  }
  return [...limpio];
}

export default function SeccionEmojis({ event, onError }) {
  const [base, setBase] = useState({});
  const [borr, setBorr] = useState({});

  const cargar = useCallback(async () => {
    try {
      const filas = await fetchEmojiPacks(event.id);
      const mapa = Object.fromEntries(ROLES.map((r) => {
        const f = filas.find((x) => x.role === r.id);
        return [r.id, (f?.emojis || []).join(" ")];
      }));
      setBase(mapa); setBorr(mapa);
    } catch (err) { onError?.(err); }
  }, [event.id, onError]);

  useEffect(() => { cargar(); }, [cargar]);

  const cambiados = ROLES.filter((r) => aEmojis(borr[r.id]).join("") !== aEmojis(base[r.id]).join(""));

  const { estado, mensaje, guardar } = useGuardado(async () => {
    await saveEmojiPacks(event.id,
      cambiados.map((r) => ({ role: r.id, emojis: aEmojis(borr[r.id]) })));
    await cargar();
  });

  return (
    <PanelSection id="packs-emojis" title="Paquetes de emojis por rol" icon="😀">
      <div className="pdj-sub">
        Los emojis que cada rol puede mandar a la pantalla. Se pueden pegar seguidos o separados
        por espacios; los compuestos (banderas, familias, tonos de piel) se respetan enteros.
      </div>

      {ROLES.map((r) => {
        const lista = aEmojis(borr[r.id]);
        return (
          <div key={r.id} style={{ marginBottom: 11 }}>
            <div style={{
              fontSize: 11, fontWeight: 800, color: r.color, marginBottom: 5,
              display: "flex", alignItems: "center", gap: 5,
            }}>
              <span>{r.ico}</span>{r.label}
              <span style={{ marginLeft: "auto", fontSize: 9, color: P.tenue2, fontWeight: 600 }}>
                {lista.length} emoji{lista.length === 1 ? "" : "s"}
              </span>
            </div>
            <input className="pdj-input" value={borr[r.id] ?? ""} placeholder={r.sugeridos}
              aria-label={`Emojis de ${r.label}`} style={{ fontSize: 16, letterSpacing: 2 }}
              onChange={(e) => setBorr((b) => ({ ...b, [r.id]: e.target.value }))} />
            {lista.length > 0 && (
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 5 }}>
                {lista.map((em, i) => (
                  <span key={`${em}-${i}`} style={{
                    fontSize: 15, lineHeight: 1, padding: "4px 6px", borderRadius: 8,
                    background: "rgba(240,232,255,.05)", border: "1px solid rgba(240,232,255,.09)",
                  }}>{em}</span>
                ))}
              </div>
            )}
            {lista.length === 0 && (
              <div className="pdj-campo-hint">
                Sin emojis propios: este rol no puede reaccionar. Sugerencia: {r.sugeridos}
              </div>
            )}
          </div>
        );
      })}

      <BotonGuardar estado={estado} mensaje={mensaje}
        disabled={cambiados.length === 0} onClick={guardar} />
    </PanelSection>
  );
}
