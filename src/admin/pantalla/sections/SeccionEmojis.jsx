import { useCallback, useEffect, useState } from "react";
import { fetchEmojiPacks, saveEmojiPacks } from "../../../services/pantallaConfig";
import { P } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";

const ROLES = [
  { id: "guest", label: "Invitado", ico: "☺" },
  { id: "vip", label: "VIP", ico: "☺" },
  { id: "birthday", label: "Cumpleañero/a", ico: "☺" },
];

const DEFAULTS = ["❤️", "🔥", "🤘", "😂", "💃", "🕺"];

function separarEmojis(texto) {
  const limpio = String(texto || "").trim();
  if (!limpio) return [];
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    return [...new Intl.Segmenter("es", { granularity: "grapheme" }).segment(limpio)]
      .map((s) => s.segment).filter((s) => s.trim());
  }
  return [...limpio].filter((s) => s.trim());
}

export default function SeccionEmojis({ event, onError }) {
  const [packs, setPacks] = useState({});
  const [inputs, setInputs] = useState({});
  const [ocupado, setOcupado] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const filas = await fetchEmojiPacks(event.id);
      const mapa = {};
      for (const r of ROLES) {
        const fila = filas.find((x) => x.role === r.id);
        mapa[r.id] = fila ? [...(fila.emojis || [])] : [...DEFAULTS];
      }
      setPacks(mapa);
    } catch (err) { onError?.(err); }
  }, [event.id, onError]);

  useEffect(() => { cargar(); }, [cargar]);

  const persistir = async (role, emojis) => {
    setOcupado(role);
    try {
      await saveEmojiPacks(event.id, [{ role, emojis }]);
      setPacks((p) => ({ ...p, [role]: emojis }));
    } catch (err) { onError?.(err); }
    finally { setOcupado(null); }
  };

  const agregar = async (role) => {
    const nuevos = separarEmojis(inputs[role]);
    if (!nuevos.length) return;
    const lista = [...(packs[role] || [])];
    for (const em of nuevos) if (!lista.includes(em)) lista.push(em);
    await persistir(role, lista);
    setInputs((i) => ({ ...i, [role]: "" }));
  };

  const quitar = (role, idx) => persistir(role, (packs[role] || []).filter((_, i) => i !== idx));

  return (
    <PanelSection id="packs-emojis" title="Paquetes de emojis">
      <div className="pdj-sub" style={{ marginBottom: 12 }}>
        Cada rol puede tener su propia barra de reacciones. Si no configurás un rol, usa el set por defecto ❤️ 🔥 🤘 😂 💃 🕺.
      </div>

      {ROLES.map((r) => (
        <div key={r.id} style={{
          padding: 12, borderRadius: 14, marginBottom: 10,
          background: "rgba(240,232,255,.025)", border: "1px solid rgba(240,232,255,.09)",
          opacity: ocupado === r.id ? .65 : 1,
        }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: P.texto, marginBottom: 9 }}>
            {r.ico} {r.label} <span style={{ color: P.tenue2, fontWeight: 500 }}>· set por defecto</span>
          </div>

          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 10 }}>
            {(packs[r.id] || []).map((em, idx) => (
              <div key={`${em}-${idx}`} style={{
                display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 9px",
                borderRadius: 999, background: "#08080b", border: "1px solid rgba(240,232,255,.12)",
              }}>
                <span style={{ fontSize: 18 }}>{em}</span>
                <button type="button" disabled={ocupado === r.id} onClick={() => quitar(r.id, idx)}
                  title={`Quitar ${em}`} aria-label={`Quitar ${em}`}
                  style={{ border: 0, background: "transparent", color: "#ff355d", padding: 0, cursor: "pointer" }}>🗑</button>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 7 }}>
            <input className="pdj-input" value={inputs[r.id] || ""} placeholder="Pegá un emoji…"
              disabled={ocupado === r.id} onChange={(e) => setInputs((i) => ({ ...i, [r.id]: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregar(r.id); } }}
              style={{ maxWidth: 190 }} />
            <button type="button" className="pdj-mini" disabled={ocupado === r.id || !(inputs[r.id] || "").trim()}
              onClick={() => agregar(r.id)}>+ Agregar</button>
          </div>
        </div>
      ))}
    </PanelSection>
  );
}
