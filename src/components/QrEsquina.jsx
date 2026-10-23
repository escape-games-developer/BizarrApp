import QRCode from "react-qr-code";

/**
 * QR de la TV en la esquina inferior izquierda, con la leyenda arriba.
 * Mismo bloque en todas las pantallas de juego (convocatorias de Escenario y
 * juegos de la sección Juegos), así se ve igual en todas.
 */
export default function QrEsquina({ url, texto = "Escaneá para participar" }) {
  return (
    <div style={{
      position: "absolute", left: "2.2vw", bottom: "3vh", zIndex: 60,
      display: "flex", flexDirection: "column", alignItems: "center", gap: "1vh",
      pointerEvents: "none",
    }}>
      <div style={{
        fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700,
        fontSize: "clamp(12px, 1.2vw, 22px)", color: "#F0E8FF",
        letterSpacing: ".03em", textAlign: "center", textShadow: "0 2px 10px rgba(0,0,0,.8)",
      }}>{texto}</div>
      <div style={{ background: "#fff", padding: "1.4vh", borderRadius: "1.2vh", display: "flex",
        boxShadow: "0 6px 24px rgba(0,0,0,.5)" }}>
        <QRCode value={url} style={{ width: "17vh", height: "17vh" }}/>
      </div>
    </div>
  );
}

