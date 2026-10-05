import { usePantallaEvent } from "../../hooks/realtime/usePantallaEvent";
import { usePantallaClient } from "../../hooks/realtime/usePantallaClient";
import { useClientDesign } from "../../hooks/realtime/useClientDesign";
import { resolvePantallaTheme } from "./themes/registry";
import DjVotingView from "./DjVotingView";

/**
 * Cliente — Pantalla › 🎧 Música: contenedor con los datos reales.
 *
 * Conecta el evento en vivo, las acciones del invitado y el diseño activo de
 * la sección (Diseñador Cliente → client_design_active) con DjVotingView, que
 * sólo dibuja. El preview del Diseñador usa la misma vista con datos de prueba.
 */
export default function DjVotingTab({ user, isRestricted = false, isGuest = false, onGoProfile }) {
  const { event, candidates, current, loading } = usePantallaEvent({ discoverLive: true });
  const cli = usePantallaClient(event, user);
  const theme = resolvePantallaTheme(useClientDesign("pantalla"));
  return (
    <DjVotingView event={event} candidates={candidates} current={current} loading={loading} cli={cli}
      user={user} isRestricted={isRestricted} isGuest={isGuest} onGoProfile={onGoProfile} theme={theme} />
  );
}
