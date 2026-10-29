import { useEffect, useState } from "react";
import { usePantallaEvent } from "../../hooks/realtime/usePantallaEvent";
import { usePantallaClient } from "../../hooks/realtime/usePantallaClient";
import { useClientDesign } from "../../hooks/realtime/useClientDesign";
import { resolvePantallaTheme } from "./themes/registry";
import DjVotingView from "./DjVotingView";
import { pantallaSnapshot, guardarPantallaSnapshot } from "./pantallaPrefetch";

/**
 * Cliente — Pantalla › 🎧 Música: contenedor con los datos reales.
 *
 * Conecta el evento en vivo, las acciones del invitado y el diseño activo de
 * la sección (Diseñador Cliente → client_design_active) con DjVotingView, que
 * sólo dibuja. El preview del Diseñador usa la misma vista con datos de prueba.
 */
export default function DjVotingTab({ user, isRestricted = false, isGuest = false, onGoProfile }) {
  // Arranca con lo precargado (si hay) y se refresca solo: no tapa la vista.
  const [inicial] = useState(pantallaSnapshot);
  // Los temas se releen cada 3 s (y al votar) en vez de escucharse en vivo: así
  // los votos de todos no se multiplican por cada celular en Realtime.
  const { event, items, candidates, current, loading, refresh, refreshItems } =
    usePantallaEvent({ discoverLive: true, initial: inicial, itemsCadaMs: 3000 });

  // La vista queda montada toda la sesión (App): si el evento deja de estar en
  // vivo, se vuelve a buscar el evento en vivo. Así cae a "sin evento" (y su
  // canal de descubrimiento queda escuchando) o pasa directo al evento nuevo,
  // en vez de quedarse con el terminado hasta un F5.
  const status = event?.status;
  useEffect(() => { if (status && status !== "live") refresh(); }, [status, refresh]);

  // Lo último que se vio reemplaza al snapshot precargado: si la vista se
  // vuelve a montar (cambio de sesión) arranca con el evento actual, no con
  // uno viejo. Sólo datos públicos del evento: nada propio del usuario.
  useEffect(() => { if (!loading) guardarPantallaSnapshot({ event, items }); }, [loading, event, items]);

  const base = usePantallaClient(event, user);
  // El voto propio se ve al instante: después de votar se releen los temas.
  const cli = {
    ...base,
    vote:      async (...a) => { await base.vote(...a); refreshItems(); },
    superVote: async (...a) => { await base.superVote(...a); refreshItems(); },
  };
  const theme = resolvePantallaTheme(useClientDesign("pantalla"));
  return (
    <DjVotingView event={event} candidates={candidates} current={current} loading={loading} cli={cli}
      user={user} isRestricted={isRestricted} isGuest={isGuest} onGoProfile={onGoProfile} theme={theme} />
  );
}
