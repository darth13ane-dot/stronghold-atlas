import { Icon } from "./Icon";

const navItems = [
  { id: "overview", label: "Overview", icon: "overview" },
  { id: "plan", label: "Floor plan", icon: "plan" },
  { id: "facilities", label: "Facilities", icon: "facilities" },
  { id: "downtime", label: "Downtime", icon: "downtime" },
  { id: "roster", label: "Roster", icon: "roster" },
  { id: "rules", label: "Rules", icon: "rules" },
];

export function BrandMark({ compact = false }) {
  return (
    <div className={compact ? "brand brand--compact" : "brand"}>
      <span className="brand__mark" aria-hidden="true">
        <span />
      </span>
      {compact ? null : <span>Stronghold Atlas</span>}
    </div>
  );
}

export function Sidebar({ active, onNavigate, collapsed, onToggle }) {
  return (
    <aside className={collapsed ? "sidebar sidebar--collapsed" : "sidebar"}>
      <div className="sidebar__brand-row">
        <BrandMark compact={collapsed} />
        <button className="icon-button sidebar__collapse" onClick={onToggle} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}>
          <Icon name="chevron" size={17} className={collapsed ? "" : "flip-horizontal"} />
        </button>
      </div>
      <nav className="sidebar__nav" aria-label="Primary navigation">
        {navItems.map((item) => (
          <button
            className={active === item.id ? "nav-item nav-item--active" : "nav-item"}
            key={item.id}
            onClick={() => onNavigate(item.id)}
            title={collapsed ? item.label : undefined}
          >
            <Icon name={item.icon} size={21} />
            {collapsed ? null : <span>{item.label}</span>}
          </button>
        ))}
      </nav>
      <div className="sidebar__footer">
        <button className="sidebar__utility" aria-label="Workspace connection" title="Workspace connection"><Icon name="cloud" size={18} /></button>
        <button className="sidebar__utility" aria-label="About Stronghold Atlas" title="About Stronghold Atlas"><Icon name="info" size={18} /></button>
      </div>
    </aside>
  );
}

export function MobileTabs({ active, onNavigate }) {
  const map = [
    { id: "plan", label: "Plan" },
    { id: "overview", label: "Manage" },
    { id: "rules", label: "Rules" },
  ];
  const normalized = ["facilities", "downtime", "roster"].includes(active) ? "overview" : active;
  return (
    <nav className="mobile-tabs" aria-label="Mobile navigation">
      {map.map((item) => (
        <button
          className={normalized === item.id ? "mobile-tab mobile-tab--active" : "mobile-tab"}
          key={item.id}
          onClick={() => onNavigate(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
