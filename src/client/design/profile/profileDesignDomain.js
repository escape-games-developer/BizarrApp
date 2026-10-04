import { previewProfile, previewShellState } from "../../../preview/fixtures/profile";
import { profileSceneData } from "./profileSceneData";
import {
  ProfileAvatarView, ProfileStepBarView, ProfileTeamBadgeView, ProfileChangePasswordView,
} from "./profileSystemComponents";

/**
 * Dominio Perfil del motor del Diseñador Cliente: lo que el Perfil aporta al
 * registro (datos, acciones, componentes de sistema y escenas). El motor no
 * sabe nada de esto; sólo lo lee del registro.
 *
 * Todos los bindings y acciones son protegidos: un diseño cambia cómo se ven,
 * nunca de dónde sale el dato ni qué hace el botón.
 */

export const PROFILE_BINDINGS = [
  { key: "profile.displayName",       label: "Nombre del usuario",            type: "text",    protected: true },
  { key: "profile.email",             label: "Email del usuario",             type: "text",    protected: true },
  { key: "profile.avatar",            label: "Avatar del usuario",            type: "object",  protected: true },
  { key: "profile.team",              label: "Equipo del usuario",            type: "object",  protected: true },
  { key: "profile.hasTeam",           label: "Tiene equipo",                  type: "boolean", protected: true },
  { key: "profile.geoStatus",         label: "Estado de la ubicación",        type: "text",    protected: true },
  { key: "profile.steps",             label: "Pasos del registro",            type: "list",    protected: true, itemFields: {} },
  { key: "profile.currentStep",       label: "Paso actual del registro",      type: "number",  protected: true },
  { key: "profile.emailSent",         label: "Cuenta recién creada",          type: "boolean", protected: true },
  { key: "profile.needsLocation",     label: "Falta verificar la ubicación",  type: "boolean", protected: true },
  { key: "profile.canChangePassword", label: "Puede cambiar la contraseña",   type: "boolean", protected: true },
  { key: "profile.completion",        label: "Estado de la cuenta",           type: "list",    protected: true,
    itemFields: { id: "text", icon: "text", label: "text", value: "text", ok: "boolean", check: "text", canRequestLocation: "boolean" } },
];

export const PROFILE_ACTIONS = [
  { key: "profile.edit",            label: "Editar perfil",         protected: true },
  { key: "profile.logout",          label: "Cerrar sesión",         protected: true },
  { key: "profile.requestLocation", label: "Verificar ubicación",   protected: true },
  { key: "profile.changePassword",  label: "Cambiar contraseña",    protected: true },
];

const TEXT_CAPS   = ["text", "typography", "size", "spacing", "background", "border"];
const BUTTON_CAPS = ["label", "typography", "size", "spacing", "background", "border"];

export const PROFILE_COMPONENTS = [
  { key: "profile.displayName", kind: "system", primitive: "text", label: "Nombre del usuario",
    binding: "profile.displayName", capabilities: TEXT_CAPS },
  { key: "profile.avatar", kind: "system", primitive: "custom", label: "Avatar",
    binding: "profile.avatar", render: ProfileAvatarView, capabilities: ["spacing", "props"],
    propFields: [{ key: "size", label: "Tamaño", control: "number" }, { key: "emojiSize", label: "Tamaño del emoji", control: "number" }] },
  { key: "profile.teamBadge", kind: "system", primitive: "custom", label: "Equipo",
    binding: "profile.team", render: ProfileTeamBadgeView, capabilities: ["spacing"] },
  { key: "profile.stepBar", kind: "system", primitive: "custom", label: "Pasos del registro",
    inputs: { steps: "profile.steps", current: "profile.currentStep" }, render: ProfileStepBarView, capabilities: ["spacing"] },
  { key: "profile.changePasswordCard", kind: "system", primitive: "custom", label: "Cambio de contraseña",
    action: "profile.changePassword", render: ProfileChangePasswordView, capabilities: ["spacing"] },
  { key: "profile.editButton", kind: "system", primitive: "button", label: "Botón Editar perfil",
    action: "profile.edit", defaultLabel: "Editar perfil", capabilities: BUTTON_CAPS },
  { key: "profile.logoutButton", kind: "system", primitive: "button", label: "Botón Cerrar sesión",
    action: "profile.logout", defaultLabel: "Cerrar sesión", capabilities: BUTTON_CAPS },
  { key: "profile.requestLocationButton", kind: "system", primitive: "button", label: "Botón Verificar ubicación",
    action: "profile.requestLocation", defaultLabel: "📍", capabilities: BUTTON_CAPS },
];

export const PROFILE_SCENES = [
  {
    id: "profile.complete", section: "profile", state: "complete", label: "Perfil completo",
    allowedComponents: ["container", "text", "image", "button", ...PROFILE_COMPONENTS.map((c) => c.key)],
    bindings: PROFILE_BINDINGS.map((b) => b.key),
    actions: PROFILE_ACTIONS.map((a) => a.key),
    fixtures: [
      { id: "registrado-sin-ubicacion", label: "Registrado, sin ubicación verificada",
        data: profileSceneData(previewProfile), shell: previewShellState },
    ],
  },
];
