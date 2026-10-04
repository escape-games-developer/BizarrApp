/**
 * Adaptador de datos de la escena profile.complete: del `profile` que arma
 * useProfileController (o el fixture del preview, con la misma forma) a los
 * bindings del motor. Es el único lugar que conoce esa forma.
 */
export function profileSceneData(profile) {
  const { user, team } = profile;
  return {
    "profile.displayName":       user.name,
    "profile.email":             user.email ?? null,
    "profile.avatar":            user,
    "profile.team":              team ?? null,
    "profile.hasTeam":           !!user.team,
    "profile.geoStatus":         user.geoOk ? "verified" : "unverified",
    "profile.steps":             profile.steps,
    "profile.currentStep":       profile.currentStep,
    "profile.emailSent":         !!profile.emailSent,
    "profile.needsLocation":     !!profile.needsLocation,
    "profile.canChangePassword": !!profile.canChangePassword,
    "profile.completion": profile.completion.map((row) => ({
      id:    row.id,
      icon:  row.icon,
      label: row.label,
      value: row.val,
      ok:    row.ok,
      check: row.ok ? "✓" : "○",
      canRequestLocation: !row.ok && row.id === "location",
    })),
  };
}
