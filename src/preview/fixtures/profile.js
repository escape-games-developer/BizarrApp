import { TEAMS } from "../../constants/theme";
import { PREVIEW_ACTION_DISABLED } from "../previewContract";

/**
 * Datos de prueba para previsualizar "Mi Perfil" en el Diseñador Cliente.
 *
 * Ficticios: no son de ningún usuario ni salen de Supabase. El usuario está
 * registrado y sin ubicación verificada, para que se vean el aviso de GPS, el
 * botón 📍 y los candados de la navegación.
 *
 * `previewProfile` tiene la misma forma que el `profile` que arma
 * useProfileController para el paso 5 (y que reciben los diseños). Si esa
 * forma cambia, este fixture tiene que acompañarla: la prueba de equivalencia
 * compara el HTML del Perfil real contra el del preview con este usuario.
 */
export const previewUser = Object.freeze({
  id:          "preview-user",
  email:       "cliente.demo@example.com",
  name:        "Marcelo",
  team:        "batata",
  phone:       "1100000000",
  avatarId:    "a1",
  avatarEmoji: "🦁",
  photoUrl:    null,
  geoOk:       false,
  registered:  true,
});

// Mismos rótulos que el wizard de registro (useProfileController).
const STEP_LABELS = ["Identidad","Equipo","¡A jugar!","Cuenta","¡Listo!"];

/** Acciones inertes: el preview no abre flujos reales. */
const previewActions = Object.freeze({
  requestGeo()     {},
  startEdit()      {},
  logout()         {},
  // ChangePasswordCard muestra el error que recibe: así el botón no parece roto.
  changePassword:  async () => ({ ok: false, error: PREVIEW_ACTION_DISABLED }),
});

function buildPreviewProfile(user) {
  const userTeam = user.team ? TEAMS[user.team] : null;
  return {
    user,
    team:        userTeam,
    emailSent:   false,
    steps:       STEP_LABELS,
    currentStep: 5,
    completion: [
      {id:"name",    icon:"👤",label:"Nombre",   val:user.name,                        ok:!!user.name},
      {id:"avatar",  icon:"🎭",label:"Avatar",   val:"Configurado",                    ok:!!(user.avatarId||user.photoUrl)},
      {id:"team",    icon:user.team?userTeam.emoji:"❓",
                       label:"Equipo", val:user.team?userTeam.name:"Sin elegir",ok:!!user.team},
      {id:"email",   icon:"📧",label:"Email",    val:user.email||"—",                  ok:!!user.email},
      {id:"phone",   icon:"📱",label:"Teléfono", val:user.phone?"Registrado":"—",      ok:!!user.phone},
      {id:"location",icon:"📍",label:"Ubicación",val:user.geoOk?"Verificada":"No verificada",ok:!!user.geoOk},
    ],
    needsLocation:     !user.geoOk && user.registered,
    canChangePassword: !!(user.registered && user.email),
    actions:           previewActions,
  };
}

export const previewProfile = buildPreviewProfile(previewUser);

/** Estado del shell para este usuario: misma regla que App (no invitado). */
export const previewShellState = Object.freeze({
  isLoggedIn:   previewUser.registered,
  isRestricted: !previewUser.geoOk,
});
