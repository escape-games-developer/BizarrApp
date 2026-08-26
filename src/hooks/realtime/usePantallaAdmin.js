import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { fetchAllVotes, fetchParticipants, fetchHistory } from "../../services/pantallaDj";

/**
 * Datos de administración del evento: participantes, votos e historial.
 *
 * Un solo canal Realtime para todo el módulo. Antes la consola del DJ, la
 * pestaña de participantes y la de historial abrían cada una el suyo sobre las
 * mismas tablas; ahora el panel lo abre una vez y reparte.
 *
 * Sólo lee. Todas las acciones siguen pasando por las RPC de pantallaDj.js.
 */
export function usePantallaAdmin(eventId, currentItemId) {
  const [participants, setParticipants] = useState([]);
  const [votes,        setVotes]        = useState([]);
  const [history,      setHistory]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  // Sufijo propio de esta instancia: dos componentes con el mismo nombre de
  // canal reusarian el de Supabase y el segundo .on() falla tras subscribe().
  const canalId = useRef(Math.random().toString(36).slice(2, 8));

  const cargar = useCallback(async () => {
    if (!eventId) {
      setParticipants([]); setVotes([]); setHistory([]); setLoading(false);
      return;
    }
    try {
      const [p, v, h] = await Promise.all([
        fetchParticipants(eventId), fetchAllVotes(eventId), fetchHistory(eventId),
      ]);
      setParticipants(p); setVotes(v); setHistory(h);
    } catch (err) {
      console.error("[usePantallaAdmin] carga:", err);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { setLoading(true); cargar(); }, [cargar]);

  // Al cambiar la canción se reescribe el historial y se limpian los votos.
  useEffect(() => { if (eventId) cargar(); }, [currentItemId, eventId, cargar]);

  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel(`pantalla-admin-${eventId}-${canalId.current}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "pantalla_votes", filter: `event_id=eq.${eventId}` }, cargar)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "pantalla_participants", filter: `event_id=eq.${eventId}` }, cargar)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId, cargar]);

  return { participants, votes, history, loading, refresh: cargar };
}

/**
 * Estadísticas en vivo derivadas de los votos y participantes ya cargados.
 * No pega a la base: todo sale de lo que el hook de arriba tiene en memoria.
 */
export function usePantallaStats({ participants, votes, candidates, event }) {
  return useMemo(() => {
    const cuenta = (tipos) => votes.filter((v) => tipos.includes(v.vote_type)).length;

    const ventana = (event?.kick_activity_minutes ?? 45) * 60_000;
    const corte   = Date.now() - ventana;
    const activos = participants.filter((p) => new Date(p.last_seen_at).getTime() > corte);

    const porUsuario = new Map();
    votes.forEach((v) => porUsuario.set(v.user_id, (porUsuario.get(v.user_id) || 0) + 1));
    const topUsuario = [...porUsuario.entries()].sort((a, b) => b[1] - a[1])[0] || null;

    const ordenadas   = [...(candidates || [])].sort((a, b) => b.score - a.score);
    const masVotada   = ordenadas[0]?.score > 0 ? ordenadas[0] : null;
    const masRechazada = [...(candidates || [])]
      .filter((c) => c.neg_votes > 0)
      .sort((a, b) => b.neg_votes - a.neg_votes)[0] || null;

    return {
      activos:      activos.length,
      participantes: participants.length,
      staff:        participants.filter((p) => p.role === "staff").length,
      vips:         participants.filter((p) => p.role === "vip" || p.role === "birthday").length,
      positivos:    cuenta(["up"]),
      negativos:    cuenta(["down"]),
      supers:       cuenta(["super_up"]),
      superOdios:   cuenta(["super_down"]),
      masActivoVotos: topUsuario ? topUsuario[1] : 0,
      masActivoId:    topUsuario ? topUsuario[0] : null,
      masVotada,
      masRechazada,
    };
  }, [participants, votes, candidates, event?.kick_activity_minutes]);
}
