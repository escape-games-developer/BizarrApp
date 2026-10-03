import DjVotingTab from "./DjVotingTab";

// Pantalla es la votación musical en vivo (DJ Democracy). El bloqueo por
// registro/ubicación y el caso invitado los resuelve DjVotingTab.
export default function PantallaView({ user, isRestricted, isGuest = false, onGoProfile }) {
  return <DjVotingTab user={user} isRestricted={isRestricted} isGuest={isGuest} onGoProfile={onGoProfile}/>;
}
