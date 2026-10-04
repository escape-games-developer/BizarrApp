import { useState, useRef, useCallback, useEffect } from "react";
import { PRESET_AVATARS, TEAMS } from "../../constants/theme";
import { useGeoGate }            from "../../hooks/useGeoGate";

export const STEP_LABELS = ["Identidad","Equipo","¡A jugar!","Cuenta","¡Listo!"];

/**
 * Lógica compartida del Perfil del cliente: estado del wizard, alta, GPS y las
 * acciones de la cuenta. Los diseños de "Mi Perfil" (paso 5) sólo dibujan lo
 * que devuelve `profile`; ninguno toca Supabase ni Auth por su cuenta.
 *
 * Las acciones de Auth llegan por parámetro desde la instancia de `useAuth()`
 * de App: cada `useAuth()` monta su propio `restoreSession` y su propio
 * listener de `onAuthStateChange`, así que no se crea otra acá.
 *
 * El gate de ubicación vive acá y no en un diseño: es el único lugar de la app
 * que persiste `geo_ok = true`, y App usa ese campo para destrabar Juegos,
 * Escenario y Pantalla. Un diseño nuevo no puede olvidarse de montarlo.
 */
export function useProfileController({
  user, onSave, onRegister, regStep, setRegStep,
  logout, resendConfirmation, changePassword, isGuest,
}) {
  const step    = regStep;
  const setStep = setRegStep;

  // Form state
  const [name,      setName]      = useState(user?.name||"");
  const [avatarSrc, setAvatarSrc] = useState("preset");
  const [selAv,     setSelAv]     = useState(user?.avatarId||null);
  const [photoUrl,  setPhotoUrl]  = useState(user?.photoUrl||null);
  const [team,      setTeam]      = useState(user?.team||null);
  const [email,     setEmail]     = useState(user?.email||"");
  const [phone,     setPhone]     = useState(user?.phone||"");
  const [pass,      setPass]      = useState("");
  const [passConf,  setPassConf]  = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [editing,   setEditing]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState("");
  // Cuenta creada pero esperando que el cliente toque el link del mail.
  const [pendingEmail, setPendingEmail] = useState(null);
  const [resent,       setResent]       = useState(false);
  const fileRef = useRef();

  // Geo — el invitado abre el gate sin pedir ubicación.
  const { geoState, distMeters, loading: geoLoading, retry: requestGeo } = useGeoGate(isGuest);
  const geoOk = geoState === "ok";

  useEffect(() => {
    // Para el invitado el "ok" es de mentira: no persistimos `geo_ok` o quedaría
    // un permiso falso guardado que sobrevive a apagar VITE_GUEST_LOGIN. Al
    // invitado lo destraba `isGuest` en App.jsx, no este campo.
    if (isGuest) return;
    if (geoState === "ok" && !user?.geoOk) onSave({ geoOk: true });
  }, [geoState, isGuest]);

  const selAvData   = PRESET_AVATARS.find((a) => a.id === selAv);
  const previewUser = avatarSrc==="photo"&&photoUrl
    ? { photoUrl, name }
    : selAv ? { avatarId:selAv, avatarEmoji:selAvData?.emoji, name } : { name };

  const handleFile = useCallback((e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => setPhotoUrl(ev.target.result);
    r.readAsDataURL(f);
  }, []);

  const canStep1 = name.trim().length > 0 && (selAv || (avatarSrc==="photo"&&photoUrl));
  const canStep4 = email.includes("@") && pass.length >= 6 && pass === passConf && phone.replace(/\D/g,"").length >= 8;

  // onRegister es async. Antes se leía `result.ok` directo de la promesa
  // (siempre undefined), así que ni se confirmaba el alta ni se mostraba el
  // error: el cliente tocaba "Crear mi cuenta" y no pasaba nada.
  const handleSave = useCallback(async () => {
    if (saving) return;               // evita doble alta por doble tap
    setSaveError(""); setSaving(true);
    try {
      const profile = {
        name: name.trim(),
        ...(avatarSrc==="photo"&&photoUrl
          ? { photoUrl, avatarId:null, avatarEmoji:null }
          : { avatarId:selAv, avatarEmoji:selAvData?.emoji||null, photoUrl:null }),
        team, email:email.toLowerCase().trim(),
        phone:phone.replace(/\D/g,""), geoOk, registered:true,
      };
      const result = await onRegister(profile, pass);
      // El proyecto exige confirmar el email: la cuenta ya existe, pero recién
      // queda activa cuando toca el link. No lo mandamos al paso 5 fingiendo
      // que terminó — lo dejamos en la pantalla de "revisá tu mail".
      if (result?.pendingConfirmation) {
        setPendingEmail(result.email || profile.email);
        setEditing(false);
      }
      else if (result?.ok) { setEmailSent(true); setEditing(false); setStep(5); }
      else                 { setSaveError(result?.error || "No se pudo crear la cuenta. Probá de nuevo."); }
    } catch (e) {
      setSaveError(e?.message || "No se pudo crear la cuenta. Probá de nuevo.");
    } finally {
      setSaving(false);
    }
  }, [saving,name,avatarSrc,photoUrl,selAv,selAvData,team,email,phone,geoOk,pass,onRegister,setStep]);

  // "Ahora no, solo quiero ver la carta" (paso 3): perfil local sin cuenta.
  const skipRegistration = useCallback(() => {
    onSave({ name:name.trim(),avatarId:selAv,avatarEmoji:selAvData?.emoji||null,
      photoUrl:avatarSrc==="photo"?photoUrl:null,team,geoOk:false,registered:false });
    setStep(5);
  }, [onSave,name,selAv,selAvData,avatarSrc,photoUrl,team,setStep]);

  // "Editar perfil" vuelve al wizard desde el paso 1 (termina otra vez en
  // onRegister: deuda conocida, se trata aparte).
  const startEdit = useCallback(() => { setEditing(true); setStep(1); }, [setStep]);

  const resendPending = useCallback(async () => {
    const r = await resendConfirmation(pendingEmail);
    if (r?.ok) setResent(true);
  }, [resendConfirmation, pendingEmail]);

  const backFromPending = useCallback(() => { setPendingEmail(null); setStep(4); }, [setStep]);

  // Ya registrado → saltar a paso 5. En efecto, no durante el render:
  // llamar a setStep mientras se renderiza dispara un warning de React y,
  // con el return null, deja la vista en blanco por un frame.
  useEffect(() => {
    if (user?.registered && !editing && step === 1) setStep(5);
  }, [user?.registered, editing, step, setStep]);

  // ── Datos de "Mi Perfil" (paso 5) que consumen los diseños ──────────────────
  const userTeam = user?.team ? TEAMS[user.team] : null;
  const profile = user ? {
    user,
    team:       userTeam,
    emailSent,
    steps:      STEP_LABELS,
    currentStep: step,
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
    // Solo tiene sentido con cuenta de Auth detrás: quien eligió
    // "ahora no, solo la carta" no tiene contraseña que cambiar.
    canChangePassword: !!(user.registered && user.email),
    actions: { requestGeo, startEdit, logout, changePassword },
  } : null;

  return {
    // Wizard 1–4
    step, setStep,
    name, setName, avatarSrc, setAvatarSrc, selAv, setSelAv, photoUrl,
    team, setTeam, email, setEmail, phone, setPhone,
    pass, setPass, passConf, setPassConf,
    fileRef, handleFile, previewUser,
    canStep1, canStep4, saving, saveError, handleSave, skipRegistration,
    geoState, distMeters, geoLoading, geoOk, requestGeo,
    // Confirmá tu cuenta
    pendingEmail, resent, resendPending, backFromPending,
    // Mi Perfil (paso 5)
    profile,
  };
}
