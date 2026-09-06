import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

const FLUSH_MS = 500;              // throttle de taps del cliente

/**
 * Resultado de una ronda, derivado SIEMPRE de los mismos dos datos persistidos:
 * `applause_sessions.winner_slot` (lo escribe el RPC applause_finish) y los
 * totales de `applause_counts`. Admin y TV llaman a esta función para que no
 * puedan cantar ganadores distintos.
 *
 * El RPC ya modela el empate (migración 20260906195717): winner_slot = 1 si
 * total1 > total2, 2 si total2 > total1, y NULL cuando empatan. Acá el empate
 * se deriva de los totales, que es la misma condición, así que Admin, /tv y
 * cliente coinciden con lo que quedó persistido. El `??` sobre winner_slot es
 * un fallback para rondas cerradas antes de esa migración.
 */
export function resolveDueloWinner(round, counts) {
  const p1 = Number(counts?.p1) || 0;
  const p2 = Number(counts?.p2) || 0;
  if (!round || round.status !== 'finished') return { slot: null, tie: false, p1, p2 };
  if (p1 === p2) return { slot: null, tie: true, p1, p2 };
  return { slot: round.winner_slot ?? (p1 > p2 ? 1 : 2), tie: false, p1, p2 };
}

// Instance id único por montaje: previene colisión de channels cuando varias
// vistas del mismo hook conviven (PantallaPreview + PantallaGigante).
function makeInstanceId() {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * @param {string|null} sessionId
 * @param {string|null} gameType  Si se pasa ('duelo' | 'personal_trainer' | ...),
 *   el hook sólo mira rondas de ese tipo. Sin él (default) se queda con la
 *   última ronda de la sesión sea del juego que sea, que es como lo usaban
 *   PT/FTL. El Duelo SÍ lo pasa: con dos juegos de aplausómetro en la misma
 *   noche, la ronda más reciente podía ser de otro juego y los contadores del
 *   duelo mostraban los aplausos equivocados.
 */
export function useApplauseRound(sessionId, gameType = null) {
  const [round, setRound] = useState(null);
  const [counts, setCounts] = useState({ p1: 0, p2: 0 });
  const [now, setNow] = useState(() => Date.now());

  // buffer local de taps por slot (throttle)
  const bufferRef = useRef({ 1: 0, 2: 0 });
  const flushTimerRef = useRef(null);

  // historial corto de counts para calcular intensidad (delta/seg)
  const historyRef = useRef([]); // [{ ts, p1, p2 }]

  // instance id fijo por vida del hook
  const instanceIdRef = useRef(makeInstanceId());

  // ---------- descubrir ronda activa por session ----------
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    async function fetchActive() {
      let q = supabase
        .from('applause_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .in('status', ['idle','countdown','voting','finished']);
      if (gameType) q = q.eq('game_type', gameType);
      const { data, error } = await q
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      // `data` null también es información: la ronda fue borrada (reset del
      // admin) y hay que soltarla, si no el panel seguía en "duelo en curso".
      if (!error) setRound(data || null);
    }
    fetchActive();

    const channel = supabase
      .channel(`applause:session:${sessionId}:${instanceIdRef.current}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'applause_sessions',
        filter: `session_id=eq.${sessionId}`
      }, (payload) => {
        // DELETE: con REPLICA IDENTITY default, `old` sólo trae la PK — no hay
        // game_type para filtrar, así que releemos. Es lo que deja el panel en
        // "En reposo" cuando el admin borra la ronda para abrir la siguiente.
        if (payload.eventType === 'DELETE') { fetchActive(); return; }
        const row = payload.new;
        if (!row) return;
        // Con filtro de tipo, ignoramos por completo las rondas de otros juegos.
        if (gameType && row.game_type !== gameType) return;
        // Nos quedamos con la última fila tocada (asumimos 1 ronda activa por vez)
        setRound(row);
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [sessionId, gameType]);

  // ---------- suscripción a counts de la ronda activa ----------
  const roundId = round?.id || null;
  useEffect(() => {
    if (!roundId) { setCounts({ p1: 0, p2: 0 }); historyRef.current = []; return; }

    let cancelled = false;
    async function fetchCounts() {
      const { data } = await supabase
        .from('applause_counts')
        .select('slot,total')
        .eq('round_id', roundId);
      if (cancelled || !data) return;
      const c = { p1: 0, p2: 0 };
      data.forEach(r => {
        if (r.slot === 1) c.p1 = Number(r.total) || 0;
        if (r.slot === 2) c.p2 = Number(r.total) || 0;
      });
      setCounts(c);
    }
    fetchCounts();

    const channel = supabase
      .channel(`applause:counts:${roundId}:${instanceIdRef.current}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'applause_counts',
        filter: `round_id=eq.${roundId}`
      }, (payload) => {
        const row = payload.new;
        if (!row) return;
        setCounts(prev => ({
          ...prev,
          [row.slot === 1 ? 'p1' : 'p2']: Number(row.total) || 0
        }));
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roundId]);

  // ---------- historial + tick para intensidad y countdown ----------
  useEffect(() => {
    const id = setInterval(() => {
      const ts = Date.now();
      setNow(ts);
      historyRef.current.push({ ts, p1: counts.p1, p2: counts.p2 });
      // mantener solo los últimos ~3s
      const cutoff = ts - 3000;
      historyRef.current = historyRef.current.filter(h => h.ts >= cutoff);
    }, 250);
    return () => clearInterval(id);
  }, [counts.p1, counts.p2]);

  // ---------- intensidad = delta por segundo en ventana móvil ----------
  // Deps intencionales: now y counts.p1/p2 son el TRIGGER de recálculo.
  // El body lee historyRef.current (ref vivo), que el linter no rastrea. No cambiar.
  const intensity = useMemo(() => {
    const h = historyRef.current;
    if (h.length < 2) return { p1: 0, p2: 0 };
    const oldest = h[0];
    const newest = h[h.length - 1];
    const dt = Math.max(1, newest.ts - oldest.ts) / 1000;
    return {
      p1: Math.max(0, (newest.p1 - oldest.p1) / dt),
      p2: Math.max(0, (newest.p2 - oldest.p2) / dt),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, counts.p1, counts.p2]);

  // ---------- countdown derivado de voting_ends_at ----------
  const secondsLeft = useMemo(() => {
    if (!round?.voting_ends_at) return 0;
    const ends = new Date(round.voting_ends_at).getTime();
    return Math.max(0, Math.ceil((ends - now) / 1000));
  }, [round?.voting_ends_at, now]);

  // ---------- flush del buffer via RPC ----------
  const flush = useCallback(async () => {
    const buf = bufferRef.current;
    const d1 = buf[1] | 0, d2 = buf[2] | 0;
    if (!roundId || (d1 === 0 && d2 === 0)) return;
    bufferRef.current = { 1: 0, 2: 0 };
    // dos llamadas paralelas si ambos slots recibieron taps
    const calls = [];
    if (d1 > 0) calls.push(supabase.rpc('applause_add', { p_round: roundId, p_slot: 1, p_delta: d1 }));
    if (d2 > 0) calls.push(supabase.rpc('applause_add', { p_round: roundId, p_slot: 2, p_delta: d2 }));
    try { await Promise.all(calls); } catch { /* silencio */ }
  }, [roundId]);

  // flush periódico mientras la ronda esté en voting
  useEffect(() => {
    if (round?.status !== 'voting') return;
    flushTimerRef.current = setInterval(flush, FLUSH_MS);
    return () => {
      clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
      // último flush al salir de voting o al desmontar
      flush();
    };
  }, [round?.status, flush]);

  // ---------- auto-cierre por timeout (idempotente en el RPC) ----------
  useEffect(() => {
    if (round?.status === 'voting' && secondsLeft === 0) {
      supabase.rpc('applause_finish', { p_round: round.id, p_force: false });
    }
  }, [round?.status, round?.id, secondsLeft]);

  // ---------- API cliente ----------
  const sendTap = useCallback((slot) => {
    if (slot !== 1 && slot !== 2) return;
    if (round?.status !== 'voting') return;
    bufferRef.current[slot] = (bufferRef.current[slot] | 0) + 1;
  }, [round?.status]);

  // ---------- API admin (RLS blindea, si no es admin la DB rechaza) ----------
  const createRound = useCallback(async ({ gameType, p1, p2 }) => {
    // p1/p2: { user_id, name, avatar }  — snapshot denormalizado al momento
    const payload = {
      session_id: sessionId,
      game_type: gameType,           // 'personal_trainer' | 'follow_leader'
      status: 'idle',
      p1_user_id: p1?.user_id || null,
      p1_name: p1?.name || null,
      p1_avatar: p1?.avatar || null,
      p2_user_id: p2?.user_id || null,
      p2_name: p2?.name || null,
      p2_avatar: p2?.avatar || null,
    };
    const { data, error } = await supabase
      .from('applause_sessions')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  }, [sessionId]);

  const startCountdown = useCallback(async (id) => {
    const { error } = await supabase
      .from('applause_sessions')
      .update({ status: 'countdown' })
      .eq('id', id);
    if (error) throw error;
  }, []);

  const startVoting = useCallback(async (id, durationSecs = 20) => {
    const endsAt = new Date(Date.now() + durationSecs * 1000).toISOString();
    const { error } = await supabase
      .from('applause_sessions')
      .update({ status: 'voting', voting_ends_at: endsAt })
      .eq('id', id);
    if (error) throw error;
  }, []);

  const finishRound = useCallback(async (id, force = false) => {
    const { error } = await supabase.rpc('applause_finish', { p_round: id, p_force: force });
    if (error) throw error;
  }, []);

  return {
    round,               // fila de applause_sessions o null
    counts,              // { p1, p2 }
    intensity,           // { p1, p2 } en aplausos/segundo (para la barra)
    secondsLeft,         // segundos hasta voting_ends_at
    // cliente
    sendTap,
    // admin
    createRound,
    startCountdown,
    startVoting,
    finishRound,
  };
}
