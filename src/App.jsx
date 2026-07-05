import { useCallback, useState } from "react";
import { Downtime, Facilities, Overview, Roster, Rules } from "./components/ManagementViews";
import { BrandMark, MobileTabs, Sidebar } from "./components/Navigation";
import { Icon } from "./components/Icon";
import { Modal, Toast } from "./components/Modal";
import { PlanEditor } from "./components/PlanEditor";
import { seedState } from "./data/seed";
import { useStronghold } from "./hooks/useStronghold";

function SyncLabel({ status }) {
  const labels = {
    local: "Local demo",
    connecting: "Connecting",
    saving: "Saving",
    online: "Live",
    error: "Sync issue",
  };
  return (
    <span className={`sync-label sync-label--${status}`} aria-label={labels[status] ?? status} title={labels[status] ?? status}>
      <span />
    </span>
  );
}

function AppHeader({ state, updateState, syncStatus, onInvite, onOpenMenu }) {
  const [editingName, setEditingName] = useState(false);
  return (
    <header className="app-header">
      <div className="app-header__mobile-brand"><BrandMark compact /></div>
      <div className="app-header__title">
        {editingName ? (
          <input
            autoFocus
            value={state.name}
            onBlur={() => setEditingName(false)}
            onChange={(event) => updateState((current) => ({ ...current, name: event.target.value }))}
            onKeyDown={(event) => {
              if (event.key === "Enter") setEditingName(false);
            }}
          />
        ) : (
          <button onClick={() => setEditingName(true)} title="Rename stronghold">
            <span>{state.name}</span><Icon name="edit" size={17} />
          </button>
        )}
      </div>
      <div className="app-header__actions">
        <SyncLabel status={syncStatus} />
        <button className="header-control header-control--week">
          <Icon name="calendar" size={18} /> Week {state.week}
        </button>
        <button className="header-control header-control--invite" onClick={onInvite}>
          <Icon name="invite" size={18} /> Invite
        </button>
        <div className="avatar-stack" aria-label={`${state.people.length} collaborators`}>
          {state.people.slice(0, 3).map((person) => <span className="avatar avatar--header" style={{ "--avatar": person.color }} key={person.id}>{person.initials}</span>)}
          {state.people.length > 3 ? <span className="avatar avatar--header avatar--more">+{state.people.length - 3}</span> : null}
        </div>
        <button className="icon-button app-header__menu" onClick={onOpenMenu} aria-label="Open navigation">
          <Icon name="menu" />
        </button>
      </div>
    </header>
  );
}

function InviteDialog({ cloudConfigured, createInvite, onClose, onToast }) {
  const [role, setRole] = useState("editor");
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const url = await createInvite(role);
      if (!url) return;
      setLink(url);
      await navigator.clipboard.writeText(url);
      onToast("Invite link copied");
    } catch {
      onToast("Could not create an invite");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    onToast("Invite link copied");
  };

  return (
    <Modal title="Invite collaborators" onClose={onClose}>
      <div className="invite-dialog">
        <p>Invite a player or co-GM to this stronghold. Changes appear for everyone in realtime.</p>
        {cloudConfigured ? (
          <>
            <label>Permission<select value={role} onChange={(event) => setRole(event.target.value)}><option value="editor">Can edit</option><option value="viewer">Can view</option></select></label>
            {link ? (
              <div className="share-link"><input readOnly value={link} /><button className="icon-button" onClick={copy} aria-label="Copy invite link"><Icon name="copy" size={18} /></button></div>
            ) : (
              <button className="button button--primary button--wide" onClick={generate} disabled={loading}>{loading ? "Creating link…" : "Create invite link"}</button>
            )}
            <small>Invite links expire after seven days and can be claimed once.</small>
          </>
        ) : (
          <div className="connection-note">
            <Icon name="cloud" />
            <div><strong>Local demo mode</strong><p>Connect the included Supabase project before deploying to turn on secure invitations and realtime internet collaboration.</p></div>
          </div>
        )}
      </div>
    </Modal>
  );
}

const manageTabs = [
  ["overview", "Summary"],
  ["facilities", "Facilities"],
  ["downtime", "Downtime"],
  ["roster", "Roster"],
];

export default function App() {
  const { state, update, syncStatus, syncError, createInvite, cloudConfigured } = useStronghold(seedState);
  const [active, setActive] = useState("plan");
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [toast, setToast] = useState("");
  const showToast = useCallback((message) => setToast(message), []);
  const dismissToast = useCallback(() => setToast(""), []);

  const navigate = (page) => {
    setActive(page);
    setMenuOpen(false);
  };

  const content = {
    overview: <Overview state={state} onNavigate={navigate} />,
    plan: <PlanEditor state={state} updateState={update} onToast={showToast} />,
    facilities: <Facilities state={state} updateState={update} onToast={showToast} onNavigate={navigate} />,
    downtime: <Downtime state={state} updateState={update} onToast={showToast} />,
    roster: <Roster state={state} updateState={update} onToast={showToast} />,
    rules: <Rules />,
  }[active];

  return (
    <div className="app-shell">
      <Sidebar active={active} onNavigate={navigate} collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
      <div className="app-main">
        <AppHeader state={state} updateState={update} syncStatus={syncStatus} onInvite={() => setInviteOpen(true)} onOpenMenu={() => setMenuOpen((value) => !value)} />
        <MobileTabs active={active} onNavigate={navigate} />
        {active !== "plan" && active !== "rules" ? (
          <nav className="manage-subnav" aria-label="Management sections">
            {manageTabs.map(([id, label]) => <button key={id} className={active === id ? "manage-subnav__active" : ""} onClick={() => navigate(id)}>{label}</button>)}
          </nav>
        ) : null}
        {menuOpen ? (
          <div className="mobile-menu">
            {manageTabs.map(([id, label]) => <button key={id} onClick={() => navigate(id)}>{label}<Icon name="chevron" size={16} /></button>)}
          </div>
        ) : null}
        <div className={active === "plan" ? "app-content app-content--plan" : "app-content"}>
          {content}
        </div>
      </div>
      {inviteOpen ? <InviteDialog cloudConfigured={cloudConfigured} createInvite={createInvite} onClose={() => setInviteOpen(false)} onToast={showToast} /> : null}
      {toast ? <Toast message={toast} onDismiss={dismissToast} /> : null}
      {syncError ? <span className="visually-hidden">Realtime sync error: {syncError}</span> : null}
    </div>
  );
}
