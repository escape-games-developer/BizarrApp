import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, supabaseAnon } from "../../lib/supabase";

/**
 * Votación del público en Follow the Leader.
 *
 * La identidad del turno es `escenario_queue.id` — una fila por participante,
 * no por jornada. Al llamar al siguiente cambia el turn_id y los contadores
 * arrancan solos en cero, sin borrar los votos del anterior.
 *
 * Privacidad: acá se leen DOS cosas distintas y nunca se mezclan.
 *   `follow_leader_vote_totals` → público, es lo único suscripto por Realtime.
 *   `follow_leader_votes`       → sólo la fila propia, por RLS y por consulta.
 * Suscribirse a la tabla de votos crudos filtraría quién votó qué a todo el
 * bar; por eso ni siquiera está en la publicación de Realtime.
 *
 * Los porcentajes NO se calculan acá: `up_pct` y `down_pct` son columnas
 * generadas de la base. Recalcularlos en el front sería otra fuente de verdad
 * y bastaría un redondeo distinto para que la TV y el celular no coincidan.
 */

const TOTALES_VACIOS = Object.freeze({ up: 0, down: 0, total: 0, up_pct: 0, down_pct: 0 });

// Mensajes del RPC que no son fallas de la app sino reglas del juego.
const MENSAJES_RPC = {
  "turn not open for voting": "La votación ya finalizó.",
  "protagonist cannot vote on their own turn": "No podés votar tu propia performance.",
  "turn not found": "Este turno ya no está disponible.",
  "not a follow the leader turn": "Este turno no admite votación.",
  "not authenticated": "Necesitás iniciar sesión para votar.",
};

function traducirError(mensaje) {
  const texto = String(mensaje || "");
  for (const [clave, legible] of Object.entries(MENSAJES_RPC)) {
    if (texto.includes(clave)) return legible;
  }
  return texto || "No se pudo registrar el voto.";
}

/**
 * @param {string|null} turnId  escenario_queue.id del turno en curso
 * @param {string|null} userId  para recuperar el voto propio tras un F5
 * @param {object}  [opts]
 * @param {boolean} [opts.soloTotales]  true en /tv: entra sin sesión, no vota
 *                                      y no debe pedir la fila de nadie.
 */
export function useFollowLeaderVotes(turnId, userId = null, { soloTotales = false } = {}) {
  const [totals,  setTotals]  = useState(TOTALES_VACIOS);
  const [myVote,  setMyVote]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const montadoRef = useRef(true);

  // /tv resuelve el acceso por token y no tiene sesión de auth: pedir los
  // totales con el cliente autenticado dispararía un refresh de token que no
  // existe. Los totales tienen SELECT público, así que el anónimo alcanza.
  const lector = soloTotales ? supabaseAnon : supabase;

  const leerTotales = useCallback(async () => {
    if (!turnId) return;
    const { data, error: eTot } = await lector
      .from("follow_leader_vote_totals")
      .select("up, down, total, up_pct, down_pct")
      .eq("turn_id", turnId)
      .maybeSingle();
    if (!montadoRef.current) return;
    if (eTot) { setError(eTot.message); return; }
    // Sin fila todavía = nadie votó. No es un error ni un estado intermedio.
    setTotals(data || TOTALES_VACIOS);
  }, [turnId, lector]);

  const leerMiVoto = useCallback(async () => {
    if (!turnId || !userId || soloTotales) return;
    const { data, error: eVoto } = await supabase
      .from("follow_leader_votes")
      .select("vote")
      .eq("turn_id", turnId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!montadoRef.current) return;
    if (eVoto) { setError(eVoto.message); return; }
    setMyVote(data?.vote ?? null);
  }, [turnId, userId, soloTotales]);

  useEffect(() => {
    montadoRef.current = true;
    // Turno nuevo: se limpia todo ANTES de leer, para que no se vea un instante
    // con los números y el voto del participante anterior.
    setTotals(TOTALES_VACIOS);
    setMyVote(null);
    setError(null);

    if (!turnId) { setLoading(false); return () => { montadoRef.current = false; }; }

    setLoading(true);
    Promise.all([leerTotales(), leerMiVoto()]).finally(() => {
      if (montadoRef.current) setLoading(false);
    });

    // Sólo los totales viajan por Realtime, filtrados por este turno.
    const canal = lector
      .channel(`fl-votes-${turnId}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "follow_leader_vote_totals",
        filter: `turn_id=eq.${turnId}`,
      }, (payload) => {
        if (!montadoRef.current) return;
        // El DELETE no trae los valores nuevos: se vuelve a cero, que es lo que
        // queda cuando se borra la fila de totales.
        if (payload.eventType === "DELETE") { setTotals(TOTALES_VACIOS); return; }
        const fila = payload.new;
        if (!fila) return;
        setTotals({
          up:       fila.up       ?? 0,
          down:     fila.down     ?? 0,
          total:    fila.total    ?? 0,
          up_pct:   fila.up_pct   ?? 0,
          down_pct: fila.down_pct ?? 0,
        });
      })
      .subscribe((status) => {
        // Al (re)conectar se relee: pudo entrar un voto con el canal caído.
        if (status === "SUBSCRIBED") leerTotales();
      });

    return () => {
      montadoRef.current = false;
      lector.removeChannel(canal);
    };
  }, [turnId, lector, leerTotales, leerMiVoto]);

  /**
   * Emite el voto. Nunca escribe la tabla: el RPC es el único camino, y es
   * quien valida que el turno esté abierto y que no sea el protagonista.
   *
   * La concurrencia la resuelve el backend (PK (turn_id,user_id) + ON CONFLICT
   * DO UPDATE). Acá no hay nada que reintentar ni que serializar.
   */
  const castVote = useCallback(async (vote) => {
    if (!turnId) return { error: "No hay un turno abierto." };
    if (vote !== "up" && vote !== "down") return { error: "Voto inválido." };
    setError(null);

    const previo = myVote;
    setMyVote(vote);                       // eco optimista, sólo del voto propio

    const { error: eRpc } = await supabase.rpc("cast_follow_leader_vote", {
      p_turn_id: turnId, p_vote: vote,
    });

    if (eRpc) {
      if (montadoRef.current) {
        setMyVote(previo);                 // el servidor mandó: se revierte
        setError(traducirError(eRpc.message));
      }
      return { error: traducirError(eRpc.message) };
    }

    // Confirmación contra la base: el eco optimista no alcanza como verdad.
    // Los totales llegan por Realtime, pero se releen igual por si el canal
    // todavía no estaba arriba.
    await Promise.all([leerMiVoto(), leerTotales()]);
    return { error: null };
  }, [turnId, myVote, leerMiVoto, leerTotales]);

  return { totals, myVote, castVote, loading, error, refresh: leerTotales };
}
