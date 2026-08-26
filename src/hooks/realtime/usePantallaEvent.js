import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { fetchEvent, fetchItems, fetchLiveEvent } from "../../services/pantallaDj";

/**
 * Estado compartido del evento de Pantalla/Escenario.
 *
 * Lo usan las cuatro superficies (cliente, admin, DJ y TV): todas leen lo mismo
 * y se sincronizan por `postgres_changes`, sin mensajería directa entre vistas.
 * No hay polling: los UPDATE de `pantalla_playlist_items` traen la fila entera,
 * así que el ranking se aplica en memoria en vez de re-consultar en cada voto.
 *
 * @param {string}  eventId       evento fijo (admin, DJ, TV)
 * @param {boolean} discoverLive  buscar solo el evento en vivo (cliente)
 * @param {object}  client        supabase (con sesión) o supabaseAnon (TV)
 */
export function usePantallaEvent({ eventId = null, discoverLive = false, client = supabase } = {}) {
  const [event,   setEvent]   = useState(null);
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const mounted = useRef(true);
  // Sufijo propio de esta instancia: dos componentes con el mismo nombre de
  // canal reusarian el de Supabase y el segundo .on() falla tras subscribe().
  const canalId = useRef(Math.random().toString(36).slice(2, 8));

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const ev = eventId
        ? await fetchEvent(eventId, client)
        : discoverLive ? await fetchLiveEvent(client) : null;

      if (!mounted.current) return;
      setEvent(ev);
      setItems(ev ? await fetchItems(ev.id, client) : []);
    } catch (err) {
      console.error("[usePantallaEvent] load:", err);
      if (mounted.current) { setError(err.message); setEvent(null); setItems([]); }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [eventId, discoverLive, client]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  // Suscripción al evento y a su playlist.
  const activeId = event?.id ?? null;
  useEffect(() => {
    if (!activeId) return;

    const channel = client
      .channel(`pantalla-ev-${activeId}-${canalId.current}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "pantalla_events", filter: `id=eq.${activeId}` },
        (payload) => {
          if (payload.eventType === "DELETE") { setEvent(null); setItems([]); return; }
          setEvent((prev) => ({ ...prev, ...payload.new }));
        })
      .on("postgres_changes",
        { event: "*", schema: "public", table: "pantalla_playlist_items", filter: `event_id=eq.${activeId}` },
        (payload) => {
          setItems((prev) => {
            if (payload.eventType === "DELETE") return prev.filter((i) => i.id !== payload.old?.id);
            if (payload.eventType === "INSERT") {
              return prev.some((i) => i.id === payload.new.id) ? prev : [...prev, payload.new];
            }
            return prev.map((i) => (i.id === payload.new.id ? { ...i, ...payload.new } : i));
          });
        })
      .subscribe((status) => {
        // Al reconectar se re-lee el snapshot: no hay replay de eventos perdidos.
        if (status === "SUBSCRIBED") load();
      });

    return () => { client.removeChannel(channel); };
  }, [activeId, client, load]);

  // Cuando todavía no hay evento en vivo, escucha por si el staff arranca uno.
  useEffect(() => {
    if (!discoverLive || activeId) return;
    const channel = client
      .channel(`pantalla-live-watch-${canalId.current}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pantalla_events" }, load)
      .subscribe();
    return () => { client.removeChannel(channel); };
  }, [discoverLive, activeId, client, load]);

  // Ranking de candidatos: lo que el cliente puede votar, mejor puntuado primero.
  const candidates = useMemo(() => {
    const list = items.filter(
      (i) => i.is_active_candidate && i.enabled && i.id !== event?.current_item_id,
    );
    // Con la votación congelada se respeta el orden del snapshot, igual que el
    // original: el score sigue moviéndose por detrás pero el orden no salta.
    const frozen = event?.voting_frozen ? event?.frozen_ranking : null;
    if (Array.isArray(frozen) && frozen.length) {
      const rank = new Map(frozen.map((id, idx) => [id, idx]));
      return [...list].sort((a, b) =>
        (rank.get(a.id) ?? 9999) - (rank.get(b.id) ?? 9999));
    }
    return [...list].sort((a, b) =>
      b.score - a.score || b.pos_votes - a.pos_votes || a.position - b.position);
  }, [items, event?.current_item_id, event?.voting_frozen, event?.frozen_ranking]);

  const current = useMemo(
    () => items.find((i) => i.id === event?.current_item_id) || null,
    [items, event?.current_item_id],
  );

  return { event, items, candidates, current, loading, error, refresh: load, setItems };
}
