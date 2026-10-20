/**
 * Logo de BizarrApp en la esquina superior izquierda, con balanceo de campana:
 * pivota desde arriba, va y viene de izquierda a derecha, se frena y hace una
 * pausa antes de volver a empezar.
 *
 * Lo usan las placas de anuncio de juegos (PlacaScreen) y las pantallas de
 * convocatoria (FtlStandby): el mismo logo, el mismo lugar, el mismo movimiento.
 */
const KEYFRAMES = `@keyframes campana{
  0%{transform:rotate(0)}
  10%{transform:rotate(16deg)}
  22%{transform:rotate(-13deg)}
  34%{transform:rotate(9deg)}
  46%{transform:rotate(-6deg)}
  58%{transform:rotate(3deg)}
  70%{transform:rotate(-1deg)}
  80%,100%{transform:rotate(0)}
}`;

export default function LogoCampana({ src = "/logo.png" }) {
  return (
    <>
      <style>{KEYFRAMES}</style>
      <img src={src} alt="BizarrApp"
        onError={(e) => { e.currentTarget.style.display = "none"; }}
        style={{
          position: "absolute", top: "clamp(32px,4vw,64px)", left: "clamp(32px,4vw,64px)",
          height: "clamp(56px,8vw,130px)", objectFit: "contain", zIndex: 2, pointerEvents: "none",
          transformOrigin: "50% 0", animation: "campana 2.4s ease-in-out infinite",
        }}/>
    </>
  );
}
