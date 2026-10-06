/**
 * Shell de la app Cliente: header + área de contenido + navegación inferior
 * (`.phone-shell`). Sólo presentación: no lee sesión, no decide la vista
 * activa ni monta nada con efectos. Lo usa App y, más adelante, la ruta de
 * preview del Diseñador Cliente (que no monta App).
 *
 * Props
 *   logoSrc           imagen del header
 *   notificationSlot  lo que va a la derecha del header (en App, la campana
 *                     real; un preview puede pasar una campana inerte)
 *   navItems          [{ id, label, image?, icon?, locked? }] en orden
 *   activeNavId       id del botón activo
 *   onNavigate(id)    click en un botón de la navegación
 *   onNavIntent(id)   opcional: puntero encima o dedo apoyado sobre un botón,
 *                     antes del click (para precargar el destino)
 *   children          contenido de `main.app-content` (el único scroll)
 *
 * Las clases y medidas son las de src/constants/styles.js; el CSS global lo
 * sigue inyectando quien monta el shell. `.app-root` y los overlays fixed
 * (PushPermissionBanner, DueloTeaserBanner) quedan afuera, en App.
 */
export default function ClientShell({
  logoSrc, notificationSlot = null, navItems, activeNavId, onNavigate, onNavIntent, children,
}) {
  return (
    <div className="phone-shell">
      <header className="app-header">
        <div className="app-header-brand">
          <img src={logoSrc} alt="Bizarren" className="app-header-logo"
            onError={e => { e.target.style.display="none"; }}/>
        </div>
        {/* Campana pegada al borde derecho, a 5 px. */}
        {notificationSlot}
      </header>
      <main className="app-content">
        {children}
      </main>
      <nav className="app-nav">
        {navItems.map(n => {
          const isActive = activeNavId === n.id;
          return (
            <button key={n.id}
              className={`nav-btn${isActive ? " active" : ""}`}
              aria-label={n.label}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onNavigate(n.id)}
              onPointerEnter={onNavIntent ? () => onNavIntent(n.id) : undefined}
              onPointerDown={onNavIntent ? () => onNavIntent(n.id) : undefined}
              style={{
                position: "relative",
                opacity: n.locked ? 0.45 : 1,
              }}>
              {n.image
                ? <img className="nav-image" src={n.image} alt="" aria-hidden="true"/>
                : <span className="nav-icon" aria-hidden="true">{n.icon}</span>}
              {n.locked && (
                <span aria-hidden="true" style={{
                  position:"absolute", top:1, right:5, fontSize:11,
                  pointerEvents:"none", filter:"drop-shadow(0 0 2px #000)",
                }}>🔒</span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
