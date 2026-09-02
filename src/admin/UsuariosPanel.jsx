const card = {
  background: "rgba(240,232,255,.035)",
  border: "1px solid rgba(240,232,255,.1)",
  borderRadius: 18,
  padding: 22,
};

export default function UsuariosPanel() {
  return (
    <div style={{ maxWidth: 920 }}>
      <div style={{ ...card, borderColor: "rgba(155,47,255,.35)", background: "rgba(155,47,255,.06)" }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 900, marginBottom: 8 }}>
          Gestión de usuarios
        </div>
        <p style={{ color: "rgba(240,232,255,.58)", fontSize: 12.5, lineHeight: 1.6, margin: 0 }}>
          Desde esta sección se administrarán las cuentas con acceso al panel.
          Solo los administradores generales pueden verla y gestionar usuarios.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12, marginTop: 14 }}>
        <div style={card}>
          <div style={{ fontSize: 22, marginBottom: 10 }}>🛡️</div>
          <strong style={{ display: "block", fontSize: 14, marginBottom: 6 }}>Administrador general</strong>
          <span style={{ color: "rgba(240,232,255,.48)", fontSize: 11.5, lineHeight: 1.55 }}>
            Acceso completo al panel, incluida la gestión de usuarios.
          </span>
        </div>
        <div style={card}>
          <div style={{ fontSize: 22, marginBottom: 10 }}>🎛️</div>
          <strong style={{ display: "block", fontSize: 14, marginBottom: 6 }}>Operador de sistema</strong>
          <span style={{ color: "rgba(240,232,255,.48)", fontSize: 11.5, lineHeight: 1.55 }}>
            Opera las funciones del sistema, pero no puede ver ni administrar usuarios.
          </span>
        </div>
      </div>

      <div style={{ ...card, marginTop: 14, textAlign: "center", color: "rgba(240,232,255,.42)", fontSize: 12 }}>
        El listado y la creación de usuarios se incorporarán en el próximo paso.
      </div>
    </div>
  );
}
