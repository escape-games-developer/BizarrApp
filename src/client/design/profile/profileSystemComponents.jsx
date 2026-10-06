import { AvatarDisplay }  from "../../../components/AvatarDisplay";
import { StepBar }        from "../../../components/UI";
import ChangePasswordCard from "../../../views/Auth/ChangePasswordCard";

/**
 * Renderers de los componentes de sistema "custom" del Perfil. Presentación
 * pura: reciben datos (`inputs`) y, si corresponde, la acción ya resuelta.
 * El root lleva `designProps` (data-design-id) para que el editor lo ubique.
 */

export function ProfileAvatarView({ designProps, className, style, props, inputs }) {
  return (
    <div {...designProps} className={className} style={{ display: "flex", ...style }}>
      <AvatarDisplay user={inputs.value} size={props.size ?? 80} fontSize={props.emojiSize ?? 36}/>
    </div>
  );
}

export function ProfileStepBarView({ designProps, className, style, inputs }) {
  return (
    <div {...designProps} className={className} style={style}>
      <StepBar steps={inputs.steps ?? []} current={inputs.current}/>
    </div>
  );
}

/** Colores del equipo: vienen del dato (TEAMS), no del documento. */
export function ProfileTeamBadgeView({ designProps, className, style, inputs }) {
  const team = inputs.value;
  if (!team) return null;
  return (
    <div {...designProps} className={className} style={{ display: "inline-flex", alignItems: "center", gap: 8,
      padding: "6px 16px", borderRadius: 20, background: team.bg, border: `1px solid ${team.border}`, ...style }}>
      <span style={{ fontSize: 18 }}>{team.emoji}</span>
      <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 700, fontSize: 13, color: team.color }}>{team.name}</span>
    </div>
  );
}

/** Formulario con estado propio: el diseño lo ubica, no lo descompone. */
export function ProfileChangePasswordView({ designProps, className, style, action }) {
  return (
    <div {...designProps} className={className} style={style}>
      <ChangePasswordCard changePassword={action}/>
    </div>
  );
}
