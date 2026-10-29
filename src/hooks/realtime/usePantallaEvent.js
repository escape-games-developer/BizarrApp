import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { fetchEvent, fetchItems, fetchLiveEvent } from "../../services/pantallaDj";

/**
 * Estado compartido del evento de Pantalla/Escenario.
 *
 * Lo usan las cuatro superficies (cliente, admin, DJ y TV): todas leen lo mismo
 * y se sincronizan por `postgres_changes`, sin mensajería directa entre vistas.
 * En vivo, los UPDATE de `pantalla_playlist_items` traen la fila entera, así
 * que el ranking se aplica en memoria. El celular, en cambio, relee los temas
 * cada tanto (`itemsCadaMs`, ver abajo).
 *
 * @param {string}  eventId       evento fijo (admin, DJ, TV)
 * @param {boolean} discoverLive  buscar solo el evento en vivo (cliente)
 * @param {object}  client        supabase (con sesión) o supabaseAnon (TV)
 * @param {object}  initial       { event, items } ya leídos (precarga del
 *                                cliente): se muestran de entrada y la carga
 *                                normal los refresca. Sin él, igual que siempre.
 * @param {number}  itemsCadaMs   celulares: los temas se releen cada tanto en vez
 *                                de escucharlos. Cada voto actualiza filas de
 *                                `pantalla_playlist_items` y, en vivo, ese cambio
 *                                le llegaba a cada celular: con 50 votando se
 *                                pasaba el tope de mensajes por segundo de
 *                                Realtime del proyecto y se perdían también los
 *                                cambios de los juegos (prueba de carga
 *                                2026-10-29). TV y Admin siguen en vivo.
 */
export function usePantallaEvent({ eventId = null, discoverLive = false, client = supabase, initial = null, itemsCadaMs = null } = {}) {
  const [event,   setEvent]   = useState(() => initial?.event ?? null);
  const [items,   setItems]   = useState(() => initial?.items ?? []);
  const [loading, setLoading] = useState(!initial);
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

  // Con datos iniciales no se vuelve a tapar la vista: se refresca por detrás.
  const conInicial = useRef(!!initial);
  useEffect(() => { if (!conInicial.current) setLoading(true); conInicial.current = false; load(); }, [load]);

  // Suscripción al evento y a su playlist.
  const activeId = event?.id ?? null;
  useEffect(() => {
    if (!activeId) return;

    let channel = client
      .channel(`pantalla-ev-${activeId}-${canalId.current}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "pantalla_events", filter: `id=eq.${activeId}` },
        (payload) => {
          if (payload.eventType === "DELETE") { setEvent(null); setItems([]); return; }
          setEvent((prev) => ({ ...prev, ...payload.new }));
        });
    if (!itemsCadaMs) channel = channel
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
        });
    channel.subscribe((status) => {
      // Al reconectar se re-lee el snapshot: no hay replay de eventos perdidos.
      if (status === "SUBSCRIBED") load();
    });

    return () => { client.removeChannel(channel); };
  }, [activeId, client, load, itemsCadaMs]);

  // Temas releídos cada tanto (celulares) y en el acto cuando cambia la canción.
  const releerItems = useCallback(async () => {
    if (!activeId) return;
    try {
      const lista = await fetchItems(activeId, client);
      if (mounted.current) setItems(lista);
    } catch (err) { console.warn("[usePantallaEvent] items:", err.message); }
  }, [activeId, client]);
  useEffect(() => {
    if (!itemsCadaMs || !activeId) return undefined;
    const id = setInterval(() => { if (document.visibilityState !== "hidden") releerItems(); }, itemsCadaMs);
    return () => clearInterval(id);
  }, [itemsCadaMs, activeId, releerItems]);
  const cancionActual = event?.current_item_id ?? null;
  useEffect(() => { if (itemsCadaMs && cancionActual) releerItems(); }, [itemsCadaMs, cancionActual, releerItems]);

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

  return { event, items, candidates, current, loading, error, refresh: load, refreshItems: releerItems, setItems };
}
