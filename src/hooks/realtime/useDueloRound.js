import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  APLAUSOS_MAX_POR_ENVIO, enviarAplausos, finalizarRondaDuelo,
} from "../../services/duelo";

function makeInstanceId() {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * useDueloRound — la última ronda de Duelo de la sesión y sus totales.
 *
 * Realtime es REFLEJO, no autoridad: ante cualquier cambio en
 * `applause_sessions` se relee la ronda más reciente de tipo 'duelo' en vez de
 * quedarse con la fila que llegó. Así una fila vieja tocada por un cierre
 * tardío nunca desplaza a la ronda vigente.
 *
 * @param {string|null} sessionId
 * @param {{ autoFinish?: boolean }} opts  autoFinish: el llamador está
 *   autenticado y puede pedir el cierre por tiempo (Admin y Cliente; la TV
 *   corre como anon y no tiene EXECUTE).
 */
export function useDueloRound(sessionId, { autoFinish = false } = {}) {
  const [round, setRound]   = useState(null);
  const [counts, setCounts] = useState({ p1: 0, p2: 0 });
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const instanceIdRef = useRef(makeInstanceId());

  // ── Ronda ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) { setRound(null); setLoading(false); return; }
    let cancelled = false;

    async function fetchRound() {
      const { data, error } = await supabase
        .from("applause_sessions")
        .select("*")
        .eq("session_id", sessionId)
        .eq("game_type", "duelo")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (error) console.error("[useDueloRound] fetch:", error);
      else setRound(data || null);
      setLoading(false);
    }
    fetchRound();

    const channel = supabase
      .channel(`duelo:round:${sessionId}:${instanceIdRef.current}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "applause_sessions",
        filter: `session_id=eq.${sessionId}`,
      }, fetchRound)
      .subscribe((status) => {
        // Al (re)conectar se relee: un cambio pudo pasar con el canal caído.
        if (status === "SUBSCRIBED") fetchRound();
      });

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [sessionId]);

  // ── Totales de la ronda ──────────────────────────────────────────────────
  const roundId = round?.id || null;
  useEffect(() => {
    if (!roundId) { setCounts({ p1: 0, p2: 0 }); return; }
    let cancelled = false;

    async function fetchCounts() {
      const { data, error } = await supabase
        .from("applause_counts").select("slot,total").eq("round_id", roundId);
      if (cancelled || error || !data) return;
      const c = { p1: 0, p2: 0 };
      data.forEach((r) => {
        if (r.slot === 1) c.p1 = Number(r.total) || 0;
        if (r.slot === 2) c.p2 = Number(r.total) || 0;
      });
      setCounts(c);
    }
    fetchCounts();

    const channel = supabase
      .channel(`duelo:counts:${roundId}:${instanceIdRef.current}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "applause_counts",
        filter: `round_id=eq.${roundId}`,
      }, (payload) => {
        const row = payload.new;
        if (!row || (row.slot !== 1 && row.slot !== 2)) return;
        // Los totales sólo crecen: un evento viejo que llega tarde no los baja.
        const key = row.slot === 1 ? "p1" : "p2";
        const total = Number(row.total) || 0;
        setCounts((prev) => (total > prev[key] ? { ...prev, [key]: total } : prev));
      })
      .subscribe((status) => { if (status === "SUBSCRIBED") fetchCounts(); });

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [roundId]);

  // ── Reloj: sólo corre con una ronda votando CON temporizador ─────────────
  const votando = round?.status === "voting";
  const endsAt  = round?.voting_ends_at || null;
  useEffect(() => {
    if (!votando || !endsAt) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [votando, endsAt]);

  // ── Cierre por tiempo ────────────────────────────────────────────────────
  // Idempotente en el servidor (ALREADY_FINISHED / VOTING_STILL_OPEN). Se
  // pide una vez vencido el plazo y se reintenta cada 4 s mientras la ronda
  // siga en 'voting' (p. ej. si el reloj del teléfono iba adelantado).
  const vencida = votando && !!endsAt && now >= new Date(endsAt).getTime();
  useEffect(() => {
    if (!autoFinish || !vencida || !roundId) return;
    let alive = true;
    const pedir = () => { if (alive) finalizarRondaDuelo(roundId, false); };
    pedir();
    const id = setInterval(pedir, 4000);
    return () => { alive = false; clearInterval(id); };
  }, [autoFinish, vencida, roundId]);

  return { round, counts, loading, now, vencida };
}

// ════════════════════════════════════════════════════════════════════════
// Aplausos del espectador
// ════════════════════════════════════════════════════════════════════════
const FLUSH_MS = 300;

/** Códigos que cierran la votación para este usuario en esta ronda. */
const CODIGOS_CIERRE = new Set([
  "VOTING_CLOSED", "ROUND_FINISHED", "ROUND_CANCELLED", "ROUND_EXPIRED",
  "ROUND_NOT_FOUND", "ROUND_NOT_VOTING",
]);

const hintKey = (roundId, userId) => `duelo_aplausos:${roundId}:${userId}`;
function leerHint(roundId, userId) {
  try {
    const raw = localStorage.getItem(hintKey(roundId, userId));
    if (raw == null) return null;          // sin pista: el saldo es desconocido
    const v = Number(raw);
    return Number.isFinite(v) && v >= 0 ? v : null;
  } catch { return null; }
}
function guardarHint(roundId, userId, used) {
  try { localStorage.setItem(hintKey(roundId, userId), String(used)); } catch { /* noop */ }
}

/**
 * useAplausos — taps del espectador agrupados en lotes para `applause_add`.
 *
 * · Cada tap suma a un buffer por slot. Cada 300 ms sale UN lote (1..50) del
 *   slot con más taps pendientes; nunca hay dos llamadas en vuelo a la vez.
 * · El cupo es por usuario y por ronda, SUMANDO los dos duelistas. El saldo
 *   confiable es el que devuelve el backend (`used` / `remaining`). Tras un F5
 *   se arranca del último `used` que devolvió el backend en este dispositivo
 *   (localStorage, sólo como pista: la próxima respuesta lo corrige).
 * · Aceptación parcial: si el backend acepta menos que el lote, lo que sobró
 *   se descarta — ya no hay saldo que lo pueda contener.
 * · Un código de cierre (cancelada, terminada, tiempo) vacía el buffer y
 *   bloquea nuevos taps.
 */
export function useAplausos(round, userId) {
  const roundId = round?.id || null;
  const limit   = Number(round?.tap_limit) || 0;
  const votando = round?.status === "voting";

  const bufRef      = useRef({ 1: 0, 2: 0 });
  const inflightRef = useRef(0);
  const usedRef     = useRef(0);
  const backoffRef  = useRef(0);
  const [, setTick] = useState(0);
  const [bloqueo, setBloqueo] = useState(null); // null | LIMIT_REACHED | DUELIST_CANNOT_VOTE | NOT_PRESENT | CLOSED | ERROR
  const [confirmado, setConfirmado] = useState(false); // ¿el saldo ya vino del backend?
  const rerender = () => setTick((t) => t + 1);

  // Nueva ronda → todo de cero (con la pista de este dispositivo si la hay).
  useEffect(() => {
    bufRef.current = { 1: 0, 2: 0 };
    inflightRef.current = 0;
    backoffRef.current = 0;
    const hint = roundId && userId ? leerHint(roundId, userId) : null;
    usedRef.current = hint ?? 0;
    setConfirmado(hint != null);
    setBloqueo(hint != null && limit > 0 && hint >= limit ? "LIMIT_REACHED" : null);
    rerender();
  }, [roundId, userId, limit]);

  const pendientes = () => bufRef.current[1] + bufRef.current[2] + inflightRef.current;
  const restante = Math.max(0, limit - usedRef.current - pendientes());

  const aplicarRespuesta = useCallback((r, slot, delta) => {
    if (r?.ok && r.code === "ACCEPTED") {
      usedRef.current = Number(r.used) || usedRef.current + (Number(r.accepted) || 0);
      guardarHint(roundId, userId, usedRef.current);
      setConfirmado(true);
      const sobrante = delta - (Number(r.accepted) || 0);
      if (Number(r.remaining) <= 0 || sobrante > 0) {
        bufRef.current = { 1: 0, 2: 0 };
        setBloqueo("LIMIT_REACHED");
      }
      return;
    }
    const code = r?.code;
    if (code === "LIMIT_REACHED") {
      if (typeof r.used === "number") { usedRef.current = r.used; guardarHint(roundId, userId, r.used); }
      else usedRef.current = limit;
      setConfirmado(true);
      bufRef.current = { 1: 0, 2: 0 };
      setBloqueo("LIMIT_REACHED");
    } else if (code === "DUELIST_CANNOT_VOTE") {
      bufRef.current = { 1: 0, 2: 0 };
      setBloqueo("DUELIST_CANNOT_VOTE");
    } else if (code === "NOT_PRESENT") {
      bufRef.current = { 1: 0, 2: 0 };
      setBloqueo("NOT_PRESENT");
    } else if (CODIGOS_CIERRE.has(code)) {
      bufRef.current = { 1: 0, 2: 0 };
      setBloqueo("CLOSED");
    } else if (code === "NETWORK_ERROR" || code === "RPC_ERROR") {
      // Falla de transporte: el lote vuelve al buffer y se reintenta.
      bufRef.current[slot] += delta;
      backoffRef.current = 5;
    } else {
      // INVALID_SLOT / INVALID_DELTA / UNAUTHORIZED: no tiene sentido reintentar.
      console.warn("[useAplausos] rechazo:", code, r?.error);
      bufRef.current = { 1: 0, 2: 0 };
      setBloqueo("ERROR");
    }
  }, [roundId, userId, limit]);

  const flush = useCallback(async () => {
    if (!roundId || inflightRef.current) return;
    if (backoffRef.current > 0) { backoffRef.current -= 1; return; }
    const b = bufRef.current;
    const slot = b[1] >= b[2] ? 1 : 2;
    const delta = Math.min(b[slot], APLAUSOS_MAX_POR_ENVIO);
    if (delta < 1) return;
    b[slot] -= delta;
    inflightRef.current = delta;
    const r = await enviarAplausos(roundId, slot, delta);
    inflightRef.current = 0;
    aplicarRespuesta(r, slot, delta);
    rerender();
  }, [roundId, aplicarRespuesta]);

  useEffect(() => {
    if (!votando || !roundId) return;
    const id = setInterval(flush, FLUSH_MS);
    return () => {
      clearInterval(id);
      // Salir de la vista con taps sin enviar: último intento.
      flush();
    };
  }, [votando, roundId, flush]);

  // La ronda dejó de votar (cierre, cancelación): lo pendiente ya no vale.
  useEffect(() => {
    if (!votando) { bufRef.current = { 1: 0, 2: 0 }; rerender(); }
  }, [votando]);

  // NOT_PRESENT no es definitivo: la presencia se renueva con el heartbeat de
  // usePresence. Pasados unos segundos se deja volver a intentar.
  useEffect(() => {
    if (bloqueo !== "NOT_PRESENT") return;
    const id = setTimeout(() => setBloqueo(null), 8000);
    return () => clearTimeout(id);
  }, [bloqueo]);

  const tap = useCallback((slot) => {
    if (slot !== 1 && slot !== 2) return false;
    if (!votando || bloqueo) return false;
    if (limit - usedRef.current - pendientes() <= 0) return false;
    bufRef.current[slot] += 1;
    rerender();
    return true;
  }, [votando, bloqueo, limit]);

  return {
    tap,
    restante,             // saldo mostrado (confirmado - pendiente)
    limite: limit,
    usados: usedRef.current + pendientes(),
    confirmado,           // false = todavía no habló el backend en este dispositivo
    bloqueo,
  };
}
