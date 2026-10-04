/**
 * "Vista Original" del Perfil (escena profile.complete) expresada como
 * DesignDocument V1. Modela la estructura real de ProfileDesignOriginal: mismo
 * orden, mismos textos y los mismos valores de estilo. Sólo composición: los
 * datos y las acciones salen de bindings/acciones protegidos.
 *
 * El Cliente productivo sigue usando ProfileDesignOriginal; este documento es
 * el punto de partida del editor hasta validar la equivalencia.
 */
const muted = (a) => `rgba(245,230,192,${a})`;
const OK_GREEN = "#86EFAC";

export const PROFILE_ORIGINAL_DOCUMENT = Object.freeze({
  version: 1,
  scene: "profile.complete",
  root: {
    id: "root", component: "container", name: "Mi Perfil",
    layout: { direction: "column" },
    children: [
      {
        id: "header", component: "container", name: "Encabezado de sección", preset: "sectionHeader",
        layout: { direction: "row", align: "center", gap: 8 }, box: { margin: [0, 0, 16, 0] },
        children: [
          { id: "header-icon",  component: "text", name: "Ícono", props: { tag: "span", text: "👤" }, style: { fontSize: 20 } },
          { id: "header-title", component: "text", name: "Título", props: { tag: "h3", text: "Mi Perfil" } },
        ],
      },
      { id: "steps", component: "profile.stepBar", name: "Pasos del registro" },
      {
        id: "welcome", component: "container", name: "Aviso de cuenta nueva",
        visibleWhen: { binding: "profile.emailSent" },
        layout: { direction: "row", align: "start", gap: 10 },
        box: { padding: [12, 14, 12, 14], margin: [0, 0, 16, 0] },
        style: { background: "rgba(34,197,94,.1)", borderWidth: 1, borderColor: "rgba(34,197,94,.25)", radius: 12 },
        children: [
          { id: "welcome-icon", component: "text", name: "Ícono", props: { tag: "span", text: "🎉" },
            box: { width: { mode: "hug" } }, style: { fontSize: 20 } },
          {
            id: "welcome-body", component: "container", name: "Texto", layout: { direction: "column" },
            children: [
              { id: "welcome-title", component: "text", name: "Título", props: { text: "¡Cuenta activa!" },
                box: { margin: [0, 0, 2, 0] }, style: { fontSize: 12, fontWeight: 700, color: OK_GREEN } },
              { id: "welcome-text", component: "profile.displayName", name: "Bienvenida",
                props: { prefix: "¡Bienvenido/a a BizarrApp, ", suffix: "! Tu cuenta quedó lista. ¡Ya podés jugar!" },
                style: { fontSize: 11, color: muted(.55), lineHeight: 1.4 } },
            ],
          },
        ],
      },
      {
        id: "identity", component: "container", name: "Identidad",
        layout: { direction: "column", align: "center" }, box: { margin: [0, 0, 18, 0] }, style: { textAlign: "center" },
        children: [
          {
            id: "avatar-row", component: "container", name: "Avatar",
            layout: { direction: "row", justify: "center" }, box: { width: { mode: "fill" }, margin: [0, 0, 12, 0] },
            children: [{ id: "avatar", component: "profile.avatar", name: "Avatar", props: { size: 80, emojiSize: 36 } }],
          },
          { id: "greeting", component: "profile.displayName", name: "Saludo", props: { prefix: "¡Hola, ", suffix: "!" },
            box: { width: { mode: "fill" } },
            style: { fontFamily: "display", fontWeight: 900, fontSize: 22, color: "#FFD700" } },
          { id: "team", component: "profile.teamBadge", name: "Equipo",
            visibleWhen: { binding: "profile.hasTeam" }, box: { margin: [10, 0, 0, 0] } },
        ],
      },
      {
        id: "account", component: "container", name: "Tu cuenta", preset: "card", layout: { direction: "column" },
        children: [
          { id: "account-title", component: "text", name: "Título", preset: "cardTitle", props: { text: "Tu cuenta BizarrApp" } },
          {
            id: "account-row", component: "container", name: "Fila de estado",
            repeat: { binding: "profile.completion", as: "item" },
            layout: { direction: "row", align: "center", gap: 8 },
            box: { padding: [8, 10, 8, 10], margin: [0, 0, 5, 0] },
            style: { radius: 9, background: "rgba(255,255,255,.03)", borderWidth: 1, borderColor: "rgba(255,255,255,.06)" },
            variants: [{ when: { binding: "item.ok" }, style: { background: "rgba(34,197,94,.06)", borderColor: "rgba(34,197,94,.18)" } }],
            children: [
              { id: "row-icon", component: "text", name: "Ícono", binding: "item.icon", props: { tag: "span" }, style: { fontSize: 15 } },
              { id: "row-label", component: "text", name: "Dato", binding: "item.label", props: { tag: "span" },
                box: { width: { mode: "fill" } }, style: { fontSize: 12, fontWeight: 600, color: muted(.8) } },
              { id: "row-value", component: "text", name: "Valor", binding: "item.value", props: { tag: "span" },
                style: { fontSize: 11, color: muted(.3) },
                variants: [{ when: { binding: "item.ok" }, style: { color: OK_GREEN } }] },
              { id: "row-check", component: "text", name: "Marca", binding: "item.check", props: { tag: "span" },
                style: { fontSize: 12, color: muted(.18) },
                variants: [{ when: { binding: "item.ok" }, style: { color: OK_GREEN } }] },
              { id: "row-locate", component: "profile.requestLocationButton", name: "Verificar ubicación",
                visibleWhen: { binding: "item.canRequestLocation" }, props: { label: "📍" },
                style: { background: "none", borderWidth: 0, fontSize: 14 } },
            ],
          },
        ],
      },
      {
        id: "location-warning", component: "text", name: "Aviso de ubicación",
        visibleWhen: { binding: "profile.needsLocation" },
        props: { text: "📍 Para activar los juegos verificá tu ubicación. Editá el perfil y habilitá la ubicación cuando estés en el bar." },
        box: { padding: [10, 14, 10, 14], margin: [0, 0, 12, 0] },
        style: { background: "rgba(239,68,68,.08)", borderWidth: 1, borderColor: "rgba(239,68,68,.2)", radius: 10,
          fontSize: 11, color: muted(.5), lineHeight: 1.5 },
      },
      { id: "password", component: "profile.changePasswordCard", name: "Contraseña",
        visibleWhen: { binding: "profile.canChangePassword" } },
      { id: "edit", component: "profile.editButton", name: "Editar perfil", preset: "buttonPrimary",
        props: { label: "✏️ Editar perfil" } },
      { id: "logout", component: "profile.logoutButton", name: "Cerrar sesión",
        props: { label: "🚪 Cerrar sesión" },
        box: { width: { mode: "fill" }, padding: [12, 12, 12, 12], margin: [10, 0, 0, 0] },
        style: { radius: 12, background: "rgba(255,45,120,.1)", borderWidth: 1, borderColor: "rgba(255,45,120,.3)",
          color: "#FF2D78", fontFamily: "display", fontWeight: 800, fontSize: 13 } },
    ],
  },
});
