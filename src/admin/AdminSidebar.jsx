import { useMemo } from "react";
import SidebarFlyoutMenu from "./SidebarFlyoutMenu";
import { SIDEBAR_MENU, resolverMenu } from "./sidebarMenu";

/**
 * Sidebar del admin. No decide qué ni en qué orden: recorre SIDEBAR_MENU
 * (sidebarMenu.js) resuelto contra la configuración guardada en Ajustes
 * (`configItems`, null = orden base) y las secciones visibles. Los estilos viven
 * en el `css` del AdminPanel (`.sb*`); el modo colapsado se resuelve todo en
 * CSS con `.sb.collapsed`, para que todos los botones compartan el mismo eje.
 */

export default function AdminSidebar({
  logo, sec, setSec, collapsed, onToggle, visibleSecs, configItems = null, badges = {}, onLogout,
}) {
  const entradas = useMemo(
    () => resolverMenu(SIDEBAR_MENU, visibleSecs, configItems),
    [visibleSecs, configItems],
  );

  return (
    <aside className={`sb${collapsed ? " collapsed" : ""}`}>
      <div className="sb-top">
        <img src={logo} alt="BizarrApp" className="sb-logo"
          onError={(e) => { e.target.style.display = "none"; }}/>
        <div className="sb-toggle-row">
          <button type="button" className="sb-toggle" onClick={onToggle}
            title={collapsed ? "Expandir menú" : "Contraer menú"}>
            ☰
          </button>
        </div>
      </div>

      <nav className="sb-nav">
        {entradas.map((e) => {
          if (e.type === "separator") return <div key={e.id} className="sb-sep"/>;
          if (e.type === "flyout") return (
            <SidebarFlyoutMenu key={e.id} icon={e.icon} label={e.label} hijos={e.hijos}
              sec={sec} setSec={setSec} collapsed={collapsed}/>
          );
          const badge = badges[e.sec];
          return (
            <button key={e.id} type="button"
              className={`sb-btn${sec === e.sec ? " sb-btn-active" : ""}`}
              onClick={() => setSec(e.sec)}
              title={e.label}>
              <span className="sb-btn-icon">{e.icon}</span>
              {!collapsed && <span className="sb-btn-label">{e.label}</span>}
              {!collapsed && badge > 0 && <span className="sb-badge">{badge}</span>}
            </button>
          );
        })}
      </nav>

      <div className="sb-footer">
        <button type="button" className="sb-btn sb-logout" onClick={onLogout} title="Cerrar sesión">
          <span className="sb-btn-icon" style={{ fontSize: 15 }}>🚪</span>
          {!collapsed && <span className="sb-btn-label">Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );
}
