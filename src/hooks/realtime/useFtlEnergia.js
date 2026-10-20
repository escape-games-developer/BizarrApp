import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, supabaseAnon } from "../../lib/supabase";

/**
 * Barómetro de energía de Follow the Leader (migración 20261019150000).
 *
 * El % lo calcula la base (`ftl_energia_pct`) con el decaimiento aplicado al
 * instante de la consulta: como baja solo aunque nadie toque, no alcanza con
 * escuchar cambios por Realtime — se consulta cada `cadaMs`. La TV, el Admin y
 * el celular leen la misma función, así que muestran el mismo número.
 *
 * @param {string|null} turnId  escenario_queue.id del turno en curso
 * @param {object}  [opts]
 * @param {boolean} [opts.anonimo]  true en /tv: entra por token, sin sesión
 * @param {number}  [opts.cadaMs]
 */
export function useFtlEnergia(turnId, { anonimo = false, cadaMs = 700 } = {}) {
  const [pct, setPct] = useState(0);
  const cliente = anonimo ? supabaseAnon : supabase;

  useEffect(() => {
    if (!turnId) { setPct(0); return; }
    let vivo = true;
    const leer = async () => {
      const { data, error } = await cliente.rpc("ftl_energia_pct", { p_turn_id: turnId });
      if (vivo && !error && typeof data === "number") setPct(data);
    };
    leer();
    const id = setInterval(leer, cadaMs);
    return () => { vivo = false; clearInterval(id); };
  }, [turnId, cliente, cadaMs]);

  return pct;
}

const MENSAJES_RPC = {
  "performance not live": "Esperá a que arranque el video para tocar.",
  "voting mode disabled": "Este modo de votación no está activo en este juego.",
  "turn not open for voting": "La performance ya terminó.",
  "protagonist cannot vote on their own turn": "No podés sumarte energía a vos mismo.",
  "turn not found": "Este turno ya no está disponible.",
  "not authenticated": "Necesitás iniciar sesión para participar.",
};

function traducir(mensaje) {
  const texto = String(mensaje || "");
  for (const [clave, legible] of Object.entries(MENSAJES_RPC)) {
    if (texto.includes(clave)) return legible;
  }
  return "No se pudieron enviar tus toques.";
}

/**
 * Toques del cliente. `tocar()` sólo suma a un contador local; cada 500 ms se
 * manda la tanda acumulada en un único RPC (la base acepta una tanda cada
 * 400 ms por persona y hasta 12 toques por tanda).
 */
export function useFtlToques(turnId) {
  const pendientesRef = useRef(0);
  const [misToques, setMisToques] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => { pendientesRef.current = 0; setMisToques(0); setError(null); }, [turnId]);

  useEffect(() => {
    if (!turnId) return;
    const id = setInterval(async () => {
      const n = Math.min(pendientesRef.current, 12);
      if (!n) return;
      pendientesRef.current -= n;
      const { error: e } = await supabase.rpc("ftl_tocar", { p_turn_id: turnId, p_toques: n });
      setError(e ? traducir(e.message) : null);
    }, 500);
    return () => clearInterval(id);
  }, [turnId]);

  const tocar = useCallback(() => {
    // Tope local para no acumular una cola infinita si la red está lenta.
    pendientesRef.current = Math.min(pendientesRef.current + 1, 24);
    setMisToques((n) => n + 1);
  }, []);

  return { tocar, misToques, error };
}

// ─── Mod 3 «pelea»: 👍/👎 con toques múltiples (migración 20261019190000) ────

const PELEA_INICIAL = Object.freeze({ pct: 50, positivos: 0, negativos: 0 });

/**
 * Estado de la pelea del turno: `pct` es la posición de la barra (50 = empate,
 * no se descarga sola) y los totales de toques 👍/👎. Se consulta cada
 * `cadaMs`, igual que la energía.
 */
export function useFtlPelea(turnId, { anonimo = false, cadaMs = 700 } = {}) {
  const [estado, setEstado] = useState(PELEA_INICIAL);
  const cliente = anonimo ? supabaseAnon : supabase;

  useEffect(() => {
    if (!turnId) { setEstado(PELEA_INICIAL); return; }
    let vivo = true;
    const leer = async () => {
      const { data, error } = await cliente.rpc("ftl_pelea_estado", { p_turn_id: turnId });
      if (vivo && !error && data) setEstado({ ...PELEA_INICIAL, ...data });
    };
    leer();
    const id = setInterval(leer, cadaMs);
    return () => { vivo = false; clearInterval(id); };
  }, [turnId, cliente, cadaMs]);

  return estado;
}

/**
 * Toques 👍/👎 del cliente en Mod 3. Igual que `useFtlToques`: se acumulan y
 * cada 500 ms se manda una tanda (la base acepta una cada 400 ms por persona y
 * hasta 12 toques entre los dos botones).
 */
export function useFtlPeleaToques(turnId) {
  const pendRef = useRef({ pos: 0, neg: 0 });
  const [mios, setMios] = useState({ pos: 0, neg: 0 });
  const [error, setError] = useState(null);

  useEffect(() => { pendRef.current = { pos: 0, neg: 0 }; setMios({ pos: 0, neg: 0 }); setError(null); }, [turnId]);

  useEffect(() => {
    if (!turnId) return;
    const id = setInterval(async () => {
      const p = pendRef.current;
      const total = p.pos + p.neg;
      if (!total) return;
      const pos = total > 12 ? Math.round(p.pos * 12 / total) : p.pos;
      const neg = total > 12 ? 12 - pos : p.neg;
      pendRef.current = { pos: p.pos - pos, neg: p.neg - neg };
      const { error: e } = await supabase.rpc("ftl_pelear",
        { p_turn_id: turnId, p_positivos: pos, p_negativos: neg });
      setError(e ? traducir(e.message) : null);
    }, 500);
    return () => clearInterval(id);
  }, [turnId]);

  const tocar = useCallback((lado) => {
    const p = pendRef.current;
    if (p.pos + p.neg >= 24) return;   // red lenta: no acumular sin fin
    if (lado === "pos") p.pos += 1; else p.neg += 1;
    setMios((m) => lado === "pos" ? { ...m, pos: m.pos + 1 } : { ...m, neg: m.neg + 1 });
  }, []);

  return { tocar, mios, error };
}
