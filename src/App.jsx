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
    local: "Local only",
    connecting: "Connecting…",
    saving: "Saving…",
    online: "Live sync",
    error: "Sync issue",
  };
  return (
    <span className={`sync-label sync-label--${status}`} aria-label={labels[status] ?? status} title={labels[status] ?? status}>
      <span className="sync-label__dot" />
      <span className="sync-label__text">{labels[status] ?? status}</span>
    </span>
  );
}

function AppHeader({ state, updateState, syncStatus, onCalendar, onInvite, onOpenMenu }) {
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
        <button className="header-control header-control--week" onClick={onCalendar} aria-haspopup="dialog">
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

async function copyToClipboard(value) {
  if (!navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function CalendarDialog({ week, onSave, onClose }) {
  const [draftWeek, setDraftWeek] = useState(week);
  const normalizedWeek = () => Math.max(1, Math.round(Number(draftWeek) || 1));
  const adjustWeek = (amount) => setDraftWeek(normalizedWeek() + amount);

  const submit = (event) => {
    event.preventDefault();
    onSave(normalizedWeek());
    onClose();
  };

  return (
    <Modal title="Adjust calendar" onClose={onClose}>
      <form className="invite-dialog" onSubmit={submit}>
        <p>Move the stronghold calendar backward or forward, or enter a week directly.</p>
        <div className="share-link">
          <button type="button" className="icon-button" onClick={() => adjustWeek(-1)} disabled={normalizedWeek() <= 1} aria-label="Previous week">
            <Icon name="minus" size={18} />
          </button>
          <input type="number" min="1" step="1" value={draftWeek} onChange={(event) => setDraftWeek(event.target.value)} aria-label="Current stronghold week" />
          <button type="button" className="icon-button" onClick={() => adjustWeek(1)} aria-label="Next week">
            <Icon name="plus" size={18} />
          </button>
        </div>
        <button className="button button--primary button--wide" type="submit">Save week {normalizedWeek()}</button>
      </form>
    </Modal>
  );
}

function InviteDialog({ cloudConfigured, cloudReady, syncStatus, syncError, createInvite, onClose, onToast }) {
  const [role, setRole] = useState("editor");
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    setError("");
    setLoading(true);
    try {
      const url = await createInvite(role);
      setLink(url);
      const copied = await copyToClipboard(url);
      onToast(copied ? "Invite link created and copied" : "Invite link created");
    } catch (inviteError) {
      setError(inviteError.message || "Could not create an invite.");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    const copied = await copyToClipboard(link);
    if (copied) {
      onToast("Invite link copied");
    } else {
      setError("Your browser blocked automatic copying. Select and copy the link manually.");
    }
  };

  return (
    <Modal title="Invite collaborators" onClose={onClose}>
      <div className="invite-dialog">
        <p>Invite a player or co-GM to this stronghold. Changes appear for everyone in realtime.</p>
        {cloudConfigured ? (
          <>
            <label>Permission<select value={role} onChange={(event) => setRole(event.target.value)}><option value="editor">Can edit</option><option value="viewer">Can view</option></select></label>
            {link ? (
              <div className="share-link"><input readOnly value={link} onFocus={(event) => event.currentTarget.select()} aria-label="Generated invite link" /><button className="icon-button" onClick={copy} aria-label="Copy invite link"><Icon name="copy" size={18} /></button></div>
            ) : (
              <button className="button button--primary button--wide" onClick={generate} disabled={loading || !cloudReady}>{loading ? "Creating link…" : cloudReady ? "Create invite link" : "Waiting for live sync…"}</button>
            )}
            {!cloudReady && !error ? <div className="invite-status"><SyncLabel status={syncStatus} /><span>{syncError || "The live connection must finish before an invite can be created."}</span></div> : null}
            {error ? <p className="invite-error" role="alert">{error}</p> : null}
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
  const { state, update, syncStatus, syncError, createInvite, cloudConfigured, cloudReady } = useStronghold(seedState);
  const [active, setActive] = useState("plan");
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [toast, setToast] = useState("");
  const showToast = useCallback((message) => setToast(message), []);
  const dismissToast = useCallback(() => setToast(""), []);

  const navigate = (page) => {
    setActive(page);
    setMenuOpen(false);
  };

  const content = {
    overview: <Overview state={state} updateState={update} onNavigate={navigate} />,
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
        <AppHeader state={state} updateState={update} syncStatus={syncStatus} onCalendar={() => setCalendarOpen(true)} onInvite={() => setInviteOpen(true)} onOpenMenu={() => setMenuOpen((value) => !value)} />
        <MobileTabs active={active} onNavigate={navigate} />
        {active !== "plan" && active !== "rules" ? (
          <nav className="manage-subnav" aria-label="Management sections">
            {manageTabs.map(([id, label]) => <button key={id} className={active === id ? "manage-subnav__active" : ""} onClick={() => navigate(id)}>{label}</button>)}
          </nav>
        ) : null}
        {menuOpen ? (
          <div className="mobile-menu">
            {manageTabs.map(([id, label]) => <button key={id} onClick={() => navigate(id)}>{label}<Icon name="chevron" size={16} /></button>)}
            <button onClick={() => { setCalendarOpen(true); setMenuOpen(false); }}>Adjust calendar<Icon name="calendar" size={16} /></button>
            <button onClick={() => { setInviteOpen(true); setMenuOpen(false); }}>Invite collaborators<Icon name="invite" size={16} /></button>
          </div>
        ) : null}
        <div className={active === "plan" ? "app-content app-content--plan" : "app-content"}>
          {content}
        </div>
      </div>
      {calendarOpen ? <CalendarDialog week={state.week} onSave={(week) => { update((current) => ({ ...current, week })); showToast(`Calendar set to week ${week}`); }} onClose={() => setCalendarOpen(false)} /> : null}
      {inviteOpen ? <InviteDialog cloudConfigured={cloudConfigured} cloudReady={cloudReady} syncStatus={syncStatus} syncError={syncError} createInvite={createInvite} onClose={() => setInviteOpen(false)} onToast={showToast} /> : null}
      {toast ? <Toast message={toast} onDismiss={dismissToast} /> : null}
      {syncError ? <span className="visually-hidden">Realtime sync error: {syncError}</span> : null}
    </div>
  );
}
