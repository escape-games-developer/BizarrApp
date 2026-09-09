import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

/**
 * Sumate que Sumamos — ronda + números.
 *
 * Todo sale de la base, nunca de estado local: `sumate_rounds` (objetivo,
 * estado, grupo ganador) y `sumate_assignments` (el número de cada persona).
 * Por eso un F5 en cualquier momento devuelve exactamente la misma pantalla,
 * con el mismo número.
 *
 * RLS parte las dos caras del juego sin que el frontend tenga que portarse
 * bien: el cliente sólo puede LEER su propia fila de assignments, y el admin
 * las lee todas. El celular no puede armar la lista de números ajenos aunque
 * quiera — que es lo que haría que el juego se resuelva desde la mesa en vez
 * de buscándose en el bar.
 *
 * @param {string|null} sessionId
 * @param {object}  opts
 * @param {boolean} opts.admin   true en el panel: trae TODOS los assignments.
 * @param {string|null} opts.userId  con ronda abierta, se le pide su número.
 */
export function useSumateRound(sessionId, { admin = false, userId = null } = {}) {
  const [round,       setRound]       = useState(null);
  const [assignments, setAssignments] = useState([]); // sólo admin
  const [miNumero,    setMiNumero]    = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const instanceRef = useRef(Math.random().toString(36).slice(2, 8));
  const montadoRef  = useRef(true);

  useEffect(() => { montadoRef.current = true; return () => { montadoRef.current = false; }; }, []);

  // ── Última ronda de la sesión ─────────────────────────────────────────────
  const leerRonda = useCallback(async () => {
    if (!sessionId) { setRound(null); setLoading(false); return null; }
    const { data, error: e } = await supabase
      .from("sumate_rounds")
      .select("id,target_number,status,winner_group,created_at,finished_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!montadoRef.current) return null;
    if (e) { setError(e.message); setLoading(false); return null; }
    setRound(data || null);
    setLoading(false);
    return data || null;
  }, [sessionId]);

  useEffect(() => { leerRonda(); }, [leerRonda]);

  // Realtime de la ronda: el objetivo y el ganador llegan solos a TV, admin
  // y celulares sin que nadie tenga que refrescar.
  useEffect(() => {
    if (!sessionId) return undefined;
    const ch = supabase
      .channel(`sumate:round:${sessionId}:${instanceRef.current}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "sumate_rounds",
        filter: `session_id=eq.${sessionId}`,
      }, () => { leerRonda(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, leerRonda]);

  // ── Assignments (sólo admin; al cliente RLS le devuelve nada más el suyo) ──
  const roundId = round?.id || null;

  const leerAssignments = useCallback(async () => {
    if (!admin || !roundId) { setAssignments([]); return; }
    const { data, error: e } = await supabase
      .from("sumate_assignments")
      .select("user_id,assigned_number")
      .eq("round_id", roundId);
    if (!montadoRef.current || e) return;

    // Nombre y avatar salen de connected_users: los assignments guardan sólo
    // el user_id (no se denormaliza lo que ya vive al lado).
    const { data: gente } = await supabase
      .from("connected_users")
      .select("user_id,name,avatar_emoji")
      .eq("session_id", sessionId);
    const porId = new Map((gente || []).map((g) => [g.user_id, g]));
    if (!montadoRef.current) return;
    setAssignments((data || []).map((a) => ({
      ...a,
      name:         porId.get(a.user_id)?.name || "Jugador",
      avatar_emoji: porId.get(a.user_id)?.avatar_emoji || null,
    })).sort((x, y) => x.name.localeCompare(y.name, "es")));
  }, [admin, roundId, sessionId]);

  useEffect(() => { leerAssignments(); }, [leerAssignments]);

  useEffect(() => {
    if (!admin || !roundId) return undefined;
    const ch = supabase
      .channel(`sumate:assign:${roundId}:${instanceRef.current}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "sumate_assignments",
        filter: `round_id=eq.${roundId}`,
      }, () => { leerAssignments(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [admin, roundId, leerAssignments]);

  // ── Mi número ─────────────────────────────────────────────────────────────
  // Automático: nadie toca ningún botón. Si ya tengo número me lo devuelve, y
  // si entré con la ronda empezada me crea uno. El RPC es idempotente por el
  // UNIQUE(round_id,user_id), así que dos pestañas dan el mismo número.
  useEffect(() => {
    if (admin || !roundId || !userId) { setMiNumero(null); return; }
    let cancelado = false;
    (async () => {
      // Primero leer: con la ronda cerrada el RPC tira, pero mi número tiene
      // que seguir viéndose en la pantalla de resultado.
      const { data } = await supabase
        .from("sumate_assignments")
        .select("assigned_number")
        .eq("round_id", roundId)
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelado) return;
      if (data?.assigned_number) { setMiNumero(data.assigned_number); return; }
      if (round?.status !== "playing") return;

      const { data: num, error: e } = await supabase
        .rpc("sumate_ensure_assignment", { p_round: roundId });
      if (cancelado) return;
      if (e) { setError(e.message); return; }
      setMiNumero(num ?? null);
    })();
    return () => { cancelado = true; };
  }, [admin, roundId, userId, round?.status]);

  // ── Acciones de admin ─────────────────────────────────────────────────────
  const lanzarRonda = useCallback(async () => {
    if (!sessionId) throw new Error("Sin sesión activa");
    const { data, error: e } = await supabase
      .rpc("sumate_launch_round", { p_session: sessionId });
    if (e) throw new Error(e.message);
    await leerRonda();
    return data;
  }, [sessionId, leerRonda]);

  // El admin manda USUARIOS, no números: el servidor lee los assignments
  // reales, suma él y decide. Devuelve { ok, sum, target }.
  const validarGrupo = useCallback(async (userIds) => {
    if (!roundId) throw new Error("No hay ronda abierta");
    const { data, error: e } = await supabase
      .rpc("validate_sumate_group", { p_round_id: roundId, p_user_ids: userIds });
    if (e) throw new Error(e.message);
    await leerRonda();
    return data;
  }, [roundId, leerRonda]);

  const cancelarRonda = useCallback(async () => {
    if (!roundId) return;
    const { error: e } = await supabase.rpc("sumate_cancel_round", { p_round_id: roundId });
    if (e) throw new Error(e.message);
    await leerRonda();
  }, [roundId, leerRonda]);

  return {
    round, assignments, miNumero, loading, error,
    lanzarRonda, validarGrupo, cancelarRonda, refresh: leerRonda,
  };
}
