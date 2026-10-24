import Icono from "../../components/iconos/Icono";
import { CLIENT_LOGO_URL, clientNavItems } from "../../client/shell/clientShellData";

/**
 * Marco de la app del cliente alrededor del lienzo del celular: el encabezado
 * (logo + campana) y la barra de navegación (con Juegos activo), con las
 * mismas medidas que ClientShell. Es sólo para orientarse: no se edita ni
 * responde al mouse. `children` es el lienzo, dentro del área de contenido
 * (mismo padding que .app-content).
 */
export default function MarcoCelular({ children, activo = "games" }) {
  const nav = clientNavItems({ isLoggedIn: true, isRestricted: false });
  const fijo = { pointerEvents: "none", userSelect: "none" };
  return (
    <div style={{ width: "100%", background: "#000", borderRadius: 28, overflow: "hidden",
      border: "1px solid rgba(240,232,255,.16)", boxShadow: "0 12px 40px rgba(0,0,0,.45)" }}>
      <header title="Encabezado de la app (no se edita)" style={{ ...fijo, position: "relative", display: "flex",
        alignItems: "center", padding: "7px 16px", background: "rgba(0,0,0,.98)", borderBottom: "1px solid rgba(255,215,0,.1)" }}>
        <img src={CLIENT_LOGO_URL} alt="" style={{ height: 69, width: "auto", objectFit: "contain",
          filter: "drop-shadow(0 0 8px rgba(255,215,0,.3))" }}/>
        <span style={{ position: "absolute", right: 5, top: "50%", transform: "translateY(-50%)", display: "flex" }}>
          <Icono nombre="bell" size={32} strokeWidth={2.2}
            style={{ color: "#FFD700", filter: "drop-shadow(0 0 6px rgba(255,214,0,.45))" }}/>
        </span>
      </header>

      <div style={{ padding: "14px 16px 16px" }}>{children}</div>

      <nav title="Navegación de la app (no se edita)" style={{ ...fijo, display: "flex", gap: 2, padding: "4px 6px 10px",
        background: "rgba(0,0,0,.98)", borderTop: "1px solid rgba(255,215,0,.1)" }}>
        {nav.map((n) => (
          <div key={n.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "7px 4px",
            borderRadius: 10, background: n.id === activo ? "rgba(255,215,0,.1)" : "transparent" }}>
            <img src={n.image} alt="" style={{ display: "block", width: 35, height: 35, maxWidth: "100%", objectFit: "contain" }}/>
          </div>
        ))}
      </nav>
    </div>
  );
}
