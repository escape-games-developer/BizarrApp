import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  finalizarRondaDuelo, modoDeRonda, tocarDuelo, votarDuelo, miVotoDuelo,
} from "../../services/duelo";

/** Toques (Mod 1): la base acepta una tanda cada 400 ms de hasta 12. */
const TOQUES_MAX_POR_ENVIO = 12;
const TOQUES_FLUSH_MS = 500;

function makeInstanceId() {
  return Math.random().toString(36).slice(2, 8);
}

const COUNTS_VACIOS = Object.freeze({ p1: 0, p2: 0 });

/**
 * useDueloRound — la última ronda de Duelo de la sesión y sus totales.
 *
 * Realtime es REFLEJO, no autoridad: ante cualquier cambio en
 * `applause_sessions` se relee la ronda más reciente de tipo 'duelo' en vez de
 * quedarse con la fila que llegó. Así una fila vieja tocada por un cierre
 * tardío nunca desplaza a la ronda vigente.
 *
 * `counts`: { p1, p2 } toques o votos de cada lado.
 *
 * @param {string|null} sessionId
 * @param {{ autoFinish?: boolean }} opts  autoFinish: el llamador está
 *   autenticado y puede pedir el cierre por tiempo (Admin y Cliente; la TV
 *   corre como anon y no tiene EXECUTE).
 */
export function useDueloRound(sessionId, { autoFinish = false } = {}) {
  const [round, setRound]   = useState(null);
  const [counts, setCounts] = useState(COUNTS_VACIOS);
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
  // Con el voto único un total BAJA cuando alguien cambia su voto: se toma
  // siempre la fila que llega. Al reconectar se relee todo.
  const roundId = round?.id || null;
  useEffect(() => {
    if (!roundId) { setCounts(COUNTS_VACIOS); return; }
    let cancelled = false;

    async function fetchCounts() {
      const { data, error } = await supabase
        .from("applause_counts").select("slot,total").eq("round_id", roundId);
      if (cancelled || error || !data) return;
      const c = { ...COUNTS_VACIOS };
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
        setCounts((prev) => ({ ...prev, [`p${row.slot}`]: Number(row.total) || 0 }));
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
// Votos del espectador
// ════════════════════════════════════════════════════════════════════════

/** Códigos que cierran la votación para este usuario en esta ronda. */
const CODIGOS_CIERRE = new Set([
  "VOTING_CLOSED", "ROUND_FINISHED", "ROUND_CANCELLED", "ROUND_EXPIRED",
  "ROUND_NOT_FOUND", "ROUND_NOT_VOTING", "WRONG_MODE",
]);

/**
 * Código de rechazo → bloqueo de la UI. null = reintentar (red caída o ritmo
 * de toques). Un RPC_ERROR (p. ej. la función no existe en la base) se
 * muestra como error en vez de reintentarse en silencio.
 */
function bloqueoDe(code) {
  if (code === "DUELIST_CANNOT_VOTE" || code === "NOT_PRESENT" || code === "LIMIT_REACHED") return code;
  if (CODIGOS_CIERRE.has(code)) return "CLOSED";
  if (code === "NETWORK_ERROR" || code === "TOO_FAST") return null;
  return "ERROR";
}

/** NOT_PRESENT no es definitivo: la presencia se renueva con el heartbeat. */
function useLiberarPresencia(bloqueo, setBloqueo) {
  useEffect(() => {
    if (bloqueo !== "NOT_PRESENT") return;
    const id = setTimeout(() => setBloqueo(null), 8000);
    return () => clearTimeout(id);
  }, [bloqueo, setBloqueo]);
}

/**
 * useToquesDuelo — Mod 1: el espectador toca a uno de los dos participantes.
 * Los toques se acumulan por participante y cada 500 ms sale una tanda de
 * hasta 12 (`applause_add`); la base frena el ritmo (TOO_FAST → se reintenta).
 *
 * Tope por persona: el de la ronda (`tap_limit`, regla «Límite de toques por
 * persona»). null = toques continuos e indefinidos. El saldo confiable es el
 * `used` que devuelve la base; tras un F5 el primer envío lo corrige.
 */
export function useToquesDuelo(round) {
  const roundId = round?.id || null;
  const activo  = round?.status === "voting" && modoDeRonda(round) === "toques";
  const limite  = round?.tap_limit ?? null;

  const bufRef      = useRef({ 1: 0, 2: 0 });
  const inflightRef = useRef(0);
  const usadosRef   = useRef(0);   // confirmados por la base
  const [mios, setMios]       = useState(0);
  const [bloqueo, setBloqueo] = useState(null);

  useEffect(() => {
    bufRef.current = { 1: 0, 2: 0 };
    inflightRef.current = 0; usadosRef.current = 0;
    setMios(0); setBloqueo(null);
  }, [roundId]);
  useLiberarPresencia(bloqueo, setBloqueo);

  const pendientes = () => bufRef.current[1] + bufRef.current[2] + inflightRef.current;

  const flush = useCallback(async () => {
    if (!roundId || inflightRef.current) return;
    const b = bufRef.current;
    const slot = b[1] >= b[2] ? 1 : 2;
    const n = Math.min(b[slot], TOQUES_MAX_POR_ENVIO);
    if (!n) return;
    b[slot] -= n;
    inflightRef.current = n;
    const r = await tocarDuelo(roundId, slot, n);
    inflightRef.current = 0;
    if (typeof r?.used === "number") usadosRef.current = r.used;
    if (r?.ok) {
      // Con tope, lo que la base no aceptó ya no entra: se descarta.
      if (r.remaining === 0 || (Number(r.accepted) || n) < n) {
        bufRef.current = { 1: 0, 2: 0 };
        if (r.remaining === 0) setBloqueo("LIMIT_REACHED");
      }
      setMios(usadosRef.current + pendientes());
      return;
    }
    const bloq = bloqueoDe(r?.code);
    if (bloq) { bufRef.current = { 1: 0, 2: 0 }; setBloqueo(bloq); }
    else bufRef.current[slot] += n;                 // red o ritmo: se reintenta
  }, [roundId]);

  useEffect(() => {
    if (!activo) return;
    const id = setInterval(flush, TOQUES_FLUSH_MS);
    return () => { clearInterval(id); flush(); };
  }, [activo, flush]);

  const tap = useCallback((slot) => {
    if (!activo || bloqueo || (slot !== 1 && slot !== 2)) return false;
    if (limite != null && usadosRef.current + pendientes() >= limite) return false;
    if (bufRef.current[slot] >= 2 * TOQUES_MAX_POR_ENVIO) return false;   // red lenta
    bufRef.current[slot] += 1;
    setMios(usadosRef.current + pendientes());
    return true;
  }, [activo, bloqueo, limite]);

  const restante = limite == null ? null : Math.max(0, limite - mios);
  return { tap, mios, limite, restante, bloqueo };
}

/**
 * useVotoDuelo — Mod 2: el voto único a uno de los dos (`duelo_votar`), que se
 * puede cambiar. `miVoto` arranca de la base (`duelo_mi_voto`), así un F5 lo
 * conserva.
 */
export function useVotoDuelo(round, userId) {
  const roundId = round?.id || null;
  const activo  = modoDeRonda(round) === "votos";
  const [miVoto, setMiVoto]     = useState(null);   // 1 | 2 | null
  const [enviando, setEnviando] = useState(false);
  const [bloqueo, setBloqueo]   = useState(null);

  useEffect(() => {
    setMiVoto(null); setBloqueo(null);
    if (!activo || !roundId || !userId) return;
    let vivo = true;
    miVotoDuelo(roundId).then((v) => { if (vivo) setMiVoto(v); });
    return () => { vivo = false; };
  }, [activo, roundId, userId]);
  useLiberarPresencia(bloqueo, setBloqueo);

  const votar = useCallback(async (slot) => {
    if (!activo || !roundId || enviando || bloqueo || miVoto === slot) return;
    setEnviando(true);
    const r = await votarDuelo(roundId, slot);
    setEnviando(false);
    if (r?.ok) { setMiVoto(r.slot ?? slot); return; }
    const bloq = bloqueoDe(r?.code);
    if (bloq) setBloqueo(bloq);
  }, [activo, roundId, enviando, bloqueo, miVoto]);

  return { votar, miVoto, enviando, bloqueo };
}
