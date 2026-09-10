import { useCallback, useEffect, useState } from "react";
import { saveEventFields } from "../../../services/pantallaDj";
import {
  fetchAchievements, saveAchievements, fetchPrizes, savePrizes,
  fetchPhysicalPrizes, createPhysicalPrize, updatePhysicalPrize, deletePhysicalPrize,
  CLAVES_PREMIO,
} from "../../../services/pantallaConfig";
import { P } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";
import SeccionCodigoCanje from "./SeccionCodigoCanje";
import SeccionCartelesTv from "./SeccionCartelesTv";
import SeccionFiltro from "./SeccionFiltro";
import SeccionRevoleo from "./SeccionRevoleo";
import {
  BotonGuardar, CampoSwitch, CampoTexto, useBorrador, useGuardado,
} from "../panelControls";

/**
 * Recompensas: logros, catálogo de premios y premios reales del local.
 *
 * Tres tablas distintas, tres guardados distintos:
 *  - `pantalla_events` para los interruptores del sistema;
 *  - `pantalla_achievements` (PK evento+clave) para los logros y sus niveles;
 *  - `pantalla_prizes` (PK evento+clave, con CHECK de ocho claves) para qué
 *    premios están disponibles, y `pantalla_physical_prizes` para los del local.
 *
 * Sobre el «código de entrega»: no es configuración. Se emite por premio
 * otorgado, en `pantalla_granted_rewards`, cuando el motor efectivamente le da
 * el premio a alguien. Acá se define el lugar de retiro, que sí es fijo.
 */

const LOGROS = [
  { key: "first_vote", code: "FIRST_VOTE", ico: "🗳", titulo: "Primer Voto de la Noche", desc: "Emití tu primer voto de la noche" },
  { key: "frequent_voter", code: "VOTANTE_FRECUENTE", ico: "🔁", titulo: "Votante Frecuente", desc: "Emití votos de cualquier tipo" },
  { key: "marathoner", code: "PRESENCE_60MIN", ico: "🏃", titulo: "El Maratonista", desc: "60 minutos conectado a la fiesta" },
  { key: "interactive", code: "INTERACTIVO", ico: "⚡", titulo: "El Interactivo", desc: "Participá con votos y reacciones" },
  { key: "good_vibes", code: "BUENA_ONDA", ico: "💚", titulo: "El Buena Onda", desc: "Votá varias veces sin negativos ni Súper Hate" },
  { key: "eternal", code: "ETERNO", ico: "♾", titulo: "El Eterno", desc: "Permanecé conectado durante la noche" },
];

const PREMIOS = {
  extra_super_vote:     { ico: "🔥", label: "Súper voto extra" },
  giant_reaction:       { ico: "💥", label: "Reacción gigante" },
  highlighted_nickname: { ico: "✨", label: "Apodo Destacado en TV" },
  physical_prize:       { ico: "🎁", label: "Premio real del local" },
  vip_upgrade:          { ico: "👑", label: "Ascenso a VIP" },
  throw_screen:         { ico: "🪽", label: "Revoleo a Pantalla" },
  gif_screen:           { ico: "🎞", label: "GIF a Pantalla" },
  screen_message:       { ico: "💬", label: "Mensaje en pantalla" },
  vip_badge:            { ico: "🏅", label: "Badge VIP" },
};

const aNiveles = (levels) => {
  const l = Array.isArray(levels) ? levels : [];
  if (!l.length) return [{ threshold: 0, prize_key: "" }];
  return l.map((n) => ({
    threshold: Number(n?.threshold) || 0,
    prize_key: n?.prize_key || "",
  }));
};

const repiteUltimo = (levels) => {
  const l = Array.isArray(levels) ? levels : [];
  return !!l[l.length - 1]?.repeat_last;
};

const deNiveles = (niveles, repetir) => {
  const validos = niveles
    .filter((n) => n.threshold > 0 && n.prize_key)
    .map((n) => ({ threshold: Number(n.threshold), prize_key: n.prize_key }))
    .sort((a, b) => a.threshold - b.threshold);
  if (repetir && validos.length) validos[validos.length - 1].repeat_last = true;
  return validos;
};

export default function SeccionRecompensas({ event, refresh, onError }) {
  const [logrosBase, setLogrosBase] = useState({});
  const [logros,     setLogros]     = useState({});
  const [premios,    setPremios]    = useState({});
  const [premiosBase, setPremiosBase] = useState({});
  const [fisicos,    setFisicos]    = useState([]);
  const [nuevoPremio, setNuevoPremio] = useState("");
  const [ocupado,    setOcupado]    = useState(false);

  const [b, set] = useBorrador(
    {
      rewards_enabled:             !!event.rewards_enabled,
      achievements_auto_enabled:   !!event.achievements_auto_enabled,
      physical_prize_pickup_place: event.physical_prize_pickup_place || "",
    },
    [event.id, event.rewards_enabled, event.achievements_auto_enabled, event.physical_prize_pickup_place],
  );

  const cargar = useCallback(async () => {
    try {
      const [ach, pr, fis] = await Promise.all([
        fetchAchievements(event.id), fetchPrizes(event.id), fetchPhysicalPrizes(event.id),
      ]);
      const mapaL = Object.fromEntries(LOGROS.map((l) => {
        const f = ach.find((x) => x.achievement_key === l.key);
        return [l.key, {
          enabled:     f ? !!f.enabled : false,
          title:       f?.title ?? l.titulo,
          description: f?.description ?? l.desc,
          niveles:     aNiveles(f?.levels),
          repetir:     repiteUltimo(f?.levels),
        }];
      }));
      const mapaP = Object.fromEntries(CLAVES_PREMIO.map((k) => {
        const f = pr.find((x) => x.prize_key === k);
        return [k, f ? !!f.enabled : false];
      }));
      setLogrosBase(mapaL); setLogros(mapaL);
      setPremiosBase(mapaP); setPremios(mapaP);
      setFisicos(fis);
    } catch (err) { onError?.(err); }
  }, [event.id, onError]);

  useEffect(() => { cargar(); }, [cargar]);

  const igual = (a, z) => JSON.stringify(a) === JSON.stringify(z);
  const logrosCambiados  = LOGROS.filter((l) => !igual(logrosBase[l.key], logros[l.key]));
  const premiosCambiados = CLAVES_PREMIO.filter((k) => premiosBase[k] !== premios[k]);
  const eventoCambiado = b.rewards_enabled !== !!event.rewards_enabled
    || b.achievements_auto_enabled !== !!event.achievements_auto_enabled
    || b.physical_prize_pickup_place !== (event.physical_prize_pickup_place || "");

  const { estado, mensaje, guardar } = useGuardado(async () => {
    if (eventoCambiado) {
      await saveEventFields(event.id, {
        rewards_enabled:             b.rewards_enabled,
        achievements_auto_enabled:   b.achievements_auto_enabled,
        physical_prize_pickup_place: b.physical_prize_pickup_place.trim() || null,
      });
      await refresh();
    }
    if (logrosCambiados.length) {
      await saveAchievements(event.id, logrosCambiados.map((l) => ({
        achievement_key: l.key,
        enabled:     logros[l.key].enabled,
        title:       logros[l.key].title,
        description: logros[l.key].description,
        levels:      deNiveles(logros[l.key].niveles, logros[l.key].repetir),
      })));
    }
    if (premiosCambiados.length) {
      await savePrizes(event.id, premiosCambiados.map((k) => ({ prize_key: k, enabled: premios[k] })));
    }
    await cargar();
  });

  const cambiado = eventoCambiado || logrosCambiados.length > 0 || premiosCambiados.length > 0;
  const off = !b.rewards_enabled;

  const correr = async (fn) => {
    setOcupado(true); onError?.(null);
    try { await fn(); await cargar(); }
    catch (err) { onError?.(err); }
    finally { setOcupado(false); }
  };

  const setLogro = (key, patch) =>
    setLogros((l) => ({ ...l, [key]: { ...l[key], ...patch } }));

  return (
    <PanelSection id="recompensas" title="Recompensas" icon="🏅"
      status="pendiente"
      aviso={"Los logros y el catálogo se guardan, pero no hay motor que los otorgue solo. Lo "
        + "único que funciona hoy es dar un premio a mano desde «Sorteos» en la consola en vivo."}>
      <CampoSwitch label="Sistema de recompensas habilitado" checked={b.rewards_enabled}
        onChange={(v) => set("rewards_enabled", v)} />

      <div style={{ marginTop: 9 }}>
        <CampoSwitch label="Logros automáticos" checked={b.achievements_auto_enabled}
          disabled={off} onChange={(v) => set("achievements_auto_enabled", v)} />
        <div className="pdj-campo-hint">
          Con esto prendido el motor otorga los logros solo, sin que el DJ tenga que hacer nada.
        </div>
      </div>

      {/* ── Logros ─────────────────────────────────────────────────── */}
      <div style={{ marginTop: 13, opacity: off ? .5 : 1 }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: P.tenue, marginBottom: 7 }}>
          LOGROS DEL EVENTO
        </div>

        {LOGROS.map((l) => {
          const v = logros[l.key];
          if (!v) return null;
          return (
            <div key={l.key} style={{
              borderRadius: 12, padding: "9px 10px", marginBottom: 7,
              background: v.enabled ? "rgba(155,47,255,.07)" : "rgba(240,232,255,.03)",
              border: `1px solid ${v.enabled ? "rgba(155,47,255,.26)" : "rgba(240,232,255,.08)"}`,
            }}>
              <div style={{
                fontSize: 8.5, letterSpacing: 1, color: P.tenue2, marginBottom: 6,
                fontFamily: "monospace",
              }}>{l.code}</div>
              <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
                <input type="checkbox" checked={v.enabled} disabled={off}
                  onChange={(e) => setLogro(l.key, { enabled: e.target.checked })}
                  style={{ accentColor: "#9B2FFF", cursor: "pointer", flexShrink: 0 }} />
                <span style={{ fontSize: 14 }}>{l.ico}</span>
                <input className="pdj-input" value={v.title} disabled={off || !v.enabled}
                  aria-label={`Título de ${l.titulo}`}
                  onChange={(e) => setLogro(l.key, { title: e.target.value })}
                  style={{ flex: 1, minWidth: 0, padding: "5px 7px", fontSize: 11.5 }} />
              </label>

              {v.enabled && (
                <div style={{ marginTop: 7 }}>
                  <input className="pdj-input" value={v.description || ""} disabled={off}
                    placeholder="Descripción" aria-label={`Descripción de ${l.titulo}`}
                    onChange={(e) => setLogro(l.key, { description: e.target.value })}
                    style={{ padding: "5px 7px", fontSize: 11, marginBottom: 6 }} />
                  {l.key === "first_vote" ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
                      <span style={{ fontSize: 10.5, color: P.tenue }}>Premio</span>
                      <select className="pdj-input"
                        value={v.niveles[0]?.prize_key || ""} disabled={off}
                        onChange={(e) => setLogro(l.key, {
                          niveles: [{ threshold: 1, prize_key: e.target.value }],
                        })}
                        style={{ maxWidth: 260, padding: "6px 8px", fontSize: 10.5 }}>
                        <option value="">Sin premio</option>
                        {CLAVES_PREMIO.map((k) => (
                          <option key={k} value={k}>{PREMIOS[k].label}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <>
                      <div style={{
                        fontSize: 9.5, fontWeight: 900, letterSpacing: .7,
                        color: P.tenue, margin: "8px 0 6px",
                      }}>NIVELES</div>
                      {v.niveles.map((n, i) => (
                        <div key={i} style={{
                          display: "grid", gridTemplateColumns: "42px 68px minmax(0,1fr) 28px",
                          gap: 5, alignItems: "center", marginBottom: 5,
                        }}>
                          <span style={{ fontSize: 9.5, color: P.tenue }}>Nv. {i + 1}</span>
                          <input className="pdj-input" type="number" min={1} value={n.threshold || ""}
                            disabled={off} placeholder="0"
                            aria-label={`Umbral del nivel ${i + 1} de ${l.titulo}`}
                            onChange={(e) => setLogro(l.key, {
                              niveles: v.niveles.map((x, j) =>
                                (j === i ? { ...x, threshold: Number(e.target.value) || 0 } : x)),
                            })}
                            style={{ padding: "5px 6px", fontSize: 10.5 }} />
                          <select className="pdj-input" value={n.prize_key} disabled={off}
                            aria-label={`Premio del nivel ${i + 1} de ${l.titulo}`}
                            onChange={(e) => setLogro(l.key, {
                              niveles: v.niveles.map((x, j) =>
                                (j === i ? { ...x, prize_key: e.target.value } : x)),
                            })}
                            style={{ padding: "5px 6px", fontSize: 10.5, minWidth: 0 }}>
                            <option value="">Sin premio</option>
                            {CLAVES_PREMIO.map((k) => (
                              <option key={k} value={k}>{PREMIOS[k].label}</option>
                            ))}
                          </select>
                          <button type="button" className="pdj-ico pdj-ico-peligro"
                            disabled={off || v.niveles.length <= 1}
                            title="Eliminar nivel" aria-label={`Eliminar nivel ${i + 1}`}
                            onClick={() => setLogro(l.key, {
                              niveles: v.niveles.filter((_, j) => j !== i),
                            })}>🗑</button>
                        </div>
                      ))}

                      <button type="button" className="pdj-mini" disabled={off}
                        onClick={() => setLogro(l.key, {
                          niveles: [...v.niveles, { threshold: 0, prize_key: "" }],
                        })}>+ Agregar nivel</button>

                      <label style={{
                        display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
                        fontSize: 10, color: "rgba(240,232,255,.72)", marginTop: 8,
                      }}>
                        <input type="checkbox" checked={!!v.repetir} disabled={off}
                          onChange={(e) => setLogro(l.key, { repetir: e.target.checked })}
                          style={{ accentColor: "#9B2FFF", cursor: "pointer", flexShrink: 0 }} />
                        Repetir el último nivel indefinidamente
                      </label>
                    </>
                  )}

                  <div className="pdj-campo-hint">
                    Un nivel se guarda sólo si tiene umbral y premio. Se ordenan por umbral
                    al guardar, así que no importa en qué fila los cargues.
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Premios reales del local ───────────────────────────────── */}
      <div style={{
        marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(240,232,255,.08)",
        opacity: off ? .5 : 1,
      }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: P.tenue, marginBottom: 7 }}>
          PREMIOS REALES DEL LOCAL
        </div>

        {fisicos.map((p) => (
          <div key={p.id} style={{
            display: "flex", alignItems: "center", gap: 6, marginBottom: 5,
            padding: "6px 8px", borderRadius: 10, opacity: p.enabled ? 1 : .5,
            background: "rgba(240,232,255,.035)", border: "1px solid rgba(240,232,255,.08)",
          }}>
            <input className="pdj-input" defaultValue={p.name} disabled={ocupado || off}
              aria-label={`Nombre de ${p.name}`}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== p.name) correr(() => updatePhysicalPrize(p.id, { name: v }));
              }}
              style={{ flex: 1, minWidth: 0, padding: "5px 8px", fontSize: 11.5 }} />
            <button type="button" className={`pdj-ico${p.enabled ? " pdj-ico-on" : ""}`}
              disabled={ocupado || off} title={p.enabled ? "Desactivar" : "Activar"}
              aria-label="Activar o desactivar el premio"
              onClick={() => correr(() => updatePhysicalPrize(p.id, { enabled: !p.enabled }))}>
              {p.enabled ? "👁" : "🚫"}
            </button>
            <button type="button" className="pdj-ico pdj-ico-peligro" disabled={ocupado || off}
              title="Eliminar" aria-label={`Eliminar ${p.name}`}
              onClick={() => {
                if (window.confirm(`¿Eliminar el premio "${p.name}"?`)) {
                  correr(() => deletePhysicalPrize(p.id));
                }
              }}>✕</button>
          </div>
        ))}

        <div style={{ display: "flex", gap: 5, marginTop: 7 }}>
          <input className="pdj-input" value={nuevoPremio} placeholder="Ej: Una pinta de la casa"
            aria-label="Premio nuevo" disabled={ocupado || off}
            onChange={(e) => setNuevoPremio(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || !nuevoPremio.trim()) return;
              e.preventDefault();
              correr(async () => {
                await createPhysicalPrize(event.id, { name: nuevoPremio.trim(), position: fisicos.length });
                setNuevoPremio("");
              });
            }}
            style={{ flex: 1, minWidth: 0, fontSize: 11.5 }} />
          <button type="button" className="pdj-mini pdj-mini-p"
            disabled={ocupado || off || !nuevoPremio.trim()}
            onClick={() => correr(async () => {
              await createPhysicalPrize(event.id, { name: nuevoPremio.trim(), position: fisicos.length });
              setNuevoPremio("");
            })}>+ Agregar</button>
        </div>

        <div style={{ marginTop: 9 }}>
          <CampoTexto label="Lugar de retiro" value={b.physical_prize_pickup_place}
            disabled={off} maxLength={60} placeholder="la barra"
            onChange={(v) => set("physical_prize_pickup_place", v)}
            hint="Dónde va la persona a buscar el premio. Se guarda con el botón de arriba." />
        </div>

        <div className="pdj-campo-hint">
          El código de entrega no se configura acá: se emite por premio otorgado, en
          <code style={{ margin: "0 3px" }}>pantalla_granted_rewards</code>, cuando el motor se lo
          da efectivamente a alguien.
        </div>
      </div>

      <SeccionCodigoCanje event={event} onError={onError} embedded />
      <SeccionCartelesTv event={event} refresh={refresh} onError={onError} embedded />
      <SeccionFiltro event={event} refresh={refresh} embedded />
      <SeccionRevoleo event={event} disabled={off} onError={onError} />

      {/* ── Catálogo de premios ────────────────────────────────────── */}
      <div style={{ marginTop: 13, opacity: off ? .5 : 1 }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: P.tenue, marginBottom: 7 }}>
          CATÁLOGO DE PREMIOS
        </div>
        <div style={{ display: "grid", gap: 7 }}>
          {CLAVES_PREMIO.map((k) => {
            const descripciones = {
              extra_super_vote: "Otorga un Super Vote positivo adicional",
              giant_reaction: "La próxima reacción aparece gigante en la pantalla",
              highlighted_nickname: "El apodo se muestra destacado en la TV",
              physical_prize: "Premio físico canjeable en el local",
              vip_upgrade: "Convierte al invitado en VIP por el resto del evento",
              throw_screen: "El invitado elige un objeto de la galería y lo revolea a la pantalla grande",
              gif_screen: "El GIF aparece en la pantalla grande",
              screen_message: "Permite escribir un mensaje corto que aparece en la TV",
              vip_badge: "Marca VIP en el perfil del invitado",
            };
            return (
              <label key={k} style={{
                display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                padding: "3px 0",
              }}>
                <span style={{ fontSize: 13 }}>{PREMIOS[k].ico}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: "block", fontSize: 10.5, color: P.texto }}>{PREMIOS[k].label}</strong>
                  <span style={{ display: "block", fontSize: 9.5, color: P.tenue2 }}>{descripciones[k]}</span>
                </span>
                <input type="checkbox" checked={!!premios[k]} disabled={off}
                  onChange={(e) => setPremios((p) => ({ ...p, [k]: e.target.checked }))}
                  style={{ accentColor: "#00E5FF", cursor: "pointer", flexShrink: 0 }} />
              </label>
            );
          })}
        </div>
      </div>

      <BotonGuardar estado={estado} mensaje={mensaje} disabled={!cambiado} onClick={guardar} />

    </PanelSection>
  );
}
