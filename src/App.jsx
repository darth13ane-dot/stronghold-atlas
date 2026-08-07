import { useCallback, useState } from "react";
import { Downtime, Facilities, Overview, Roster, Rules } from "./components/ManagementViews";
import { BrandMark, MobileTabs, Sidebar } from "./components/Navigation";
import { Icon } from "./components/Icon";
import { Modal, Toast } from "./components/Modal";
import { PlanEditor } from "./components/PlanEditor";
import { RegisteredAccountsDialog } from "./components/RegisteredAccountsDialog";
import { seedState } from "./data/seed";
import { useStronghold } from "./hooks/useStronghold";
import { getStrongholdReturnLink } from "./lib/cloud";
import { normalizePin, PIN_PATTERN, PIN_REQUIREMENTS } from "./lib/pins";
import { normalizeUsername, USERNAME_PATTERN, USERNAME_REQUIREMENTS } from "./lib/usernames";

const syncLabels = {
  local: "Local only",
  connecting: "Connecting…",
  saving: "Saving…",
  online: "Live sync",
  error: "Sync issue",
};

function SyncLabel({ status }) {
  const label = syncLabels[status] ?? status;
  return (
    <span className={`sync-label sync-label--${status}`} aria-label={label} title={label}>
      <span className="sync-label__dot" />
      <span className="sync-label__text">{label}</span>
    </span>
  );
}

function AppHeader({ state, updateState, syncStatus, onAccounts, onCalendar, onInvite, onOpenMenu }) {
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
        <button className="header-control header-control--accounts" onClick={onAccounts}>
          <Icon name="users" size={18} /> Accounts
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

  const copyReturnLink = async () => {
    setError("");
    const returnLink = getStrongholdReturnLink();
    if (!returnLink) {
      setError("The reusable link will be available after live sync finishes connecting.");
      return;
    }
    const copied = await copyToClipboard(returnLink);
    if (copied) {
      onToast("Reusable return link copied");
    } else {
      setError("Your browser blocked automatic copying. Copy the current page address instead.");
    }
  };

  return (
    <Modal title="Invite collaborators" onClose={onClose}>
      <div className="invite-dialog">
        <p>Invite a player or co-GM to this stronghold. Changes appear for everyone in realtime.</p>
        {cloudConfigured ? (
          <>
            <div className="connection-note">
              <Icon name="cloud" />
              <div><strong>Reusable return link</strong><p>Bookmark or copy this address. Members can sign in with their username and PIN from any browser.</p></div>
            </div>
            <button className="button button--secondary button--wide" onClick={copyReturnLink} disabled={!cloudReady}>Copy return link</button>
            <label>Permission<select value={role} onChange={(event) => setRole(event.target.value)}><option value="editor">Can edit</option><option value="viewer">Can view</option></select></label>
            {link ? (
              <div className="share-link"><input readOnly value={link} onFocus={(event) => event.currentTarget.select()} aria-label="Generated invite link" /><button className="icon-button" onClick={copy} aria-label="Copy invite link"><Icon name="copy" size={18} /></button></div>
            ) : (
              <button className="button button--primary button--wide" onClick={generate} disabled={loading || !cloudReady}>{loading ? "Creating link…" : cloudReady ? "Create invite link" : "Waiting for live sync…"}</button>
            )}
            {!cloudReady && !error ? <div className="invite-status"><SyncLabel status={syncStatus} /><span>{syncError || "The live connection must finish before an invite can be created."}</span></div> : null}
            {error ? <p className="invite-error" role="alert">{error}</p> : null}
            <small>Invite links expire after seven days and are only needed the first time someone joins. After that, the member can use their username and PIN.</small>
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

function accessErrorMessage(error) {
  if (error?.code === "23505") return "That username is already in use. Try another one.";
  if (error?.code === "42883") return "The username and PIN database update has not been installed yet.";
  if (error?.code === "PIN_CONFIRMATION_ENABLED") return "PIN access needs one final server setting before it can be used.";
  if (error?.code === "INVALID_PIN_LOGIN") return error.message;
  if (error?.status === 422 || error?.code === "weak_password") return PIN_REQUIREMENTS;
  return error?.message || "Access could not be completed.";
}

function AccessDialog({ reason, onCreateAccess, onSignIn }) {
  const [mode, setMode] = useState(reason === "join" || reason === "setup" ? "create" : "sign-in");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirmation, setPinConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const creating = mode === "create";

  const title = reason === "setup"
    ? "Create your access"
    : reason === "join"
      ? creating ? "Join this stronghold" : "Sign in to join"
      : "Sign in to Stronghold";

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setPin("");
    setPinConfirmation("");
    setError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextUsername = normalizeUsername(username);
    if (!USERNAME_PATTERN.test(nextUsername)) {
      setError(USERNAME_REQUIREMENTS);
      return;
    }
    if (!PIN_PATTERN.test(pin)) {
      setError(PIN_REQUIREMENTS);
      return;
    }
    if (creating && pin !== pinConfirmation) {
      setError("The two PIN entries do not match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (creating) {
        await onCreateAccess(nextUsername, pin);
      } else {
        await onSignIn(nextUsername, pin);
      }
    } catch (accessError) {
      setError(accessErrorMessage(accessError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={title} className="modal--access">
      <form className="invite-dialog access-dialog" onSubmit={submit}>
        <p>{creating
          ? "Choose a username and private 8-digit PIN. You can use them to return from any browser, with no email required."
          : "Enter your username and private 8-digit PIN. No email or login link is required."}</p>
        <label>Username<input required autoFocus autoComplete="username" maxLength="24" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="stronghold_keeper" /></label>
        <label>PIN<input required autoComplete={creating ? "new-password" : "current-password"} inputMode="numeric" pattern="[0-9]{8}" maxLength="8" value={pin} onChange={(event) => setPin(normalizePin(event.target.value))} placeholder="8 digits" type="password" /></label>
        {creating ? <label>Confirm PIN<input required autoComplete="new-password" inputMode="numeric" pattern="[0-9]{8}" maxLength="8" value={pinConfirmation} onChange={(event) => setPinConfirmation(normalizePin(event.target.value))} placeholder="Repeat PIN" type="password" /></label> : null}
        <small>{USERNAME_REQUIREMENTS} {PIN_REQUIREMENTS} There is no email recovery, so keep your PIN somewhere safe.</small>
        <button className="button button--primary button--wide" type="submit" disabled={loading}>{loading ? "Working..." : creating ? "Create access and join" : "Sign in"}</button>
        {reason === "join" ? (
          <button className="button button--secondary button--wide" type="button" disabled={loading} onClick={() => switchMode(creating ? "sign-in" : "create")}>
            {creating ? "I already have a username" : "Create a new username and PIN"}
          </button>
        ) : null}
        {error ? <p className="invite-error" role="alert">{error}</p> : null}
      </form>
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
  const {
    state,
    update,
    syncStatus,
    syncError,
    createInvite,
    cloudConfigured,
    cloudReady,
    accessRequired,
    signIn,
    createAccess,
    refreshCloudConnection,
  } = useStronghold(seedState);
  const [active, setActive] = useState("plan");
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState(null);
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
        <AppHeader state={state} updateState={update} syncStatus={syncStatus} onAccounts={() => setDialog("accounts")} onCalendar={() => setDialog("calendar")} onInvite={() => setDialog("invite")} onOpenMenu={() => setMenuOpen((value) => !value)} />
        <MobileTabs active={active} onNavigate={navigate} />
        {active !== "plan" && active !== "rules" ? (
          <nav className="manage-subnav" aria-label="Management sections">
            {manageTabs.map(([id, label]) => <button key={id} className={active === id ? "manage-subnav__active" : ""} onClick={() => navigate(id)}>{label}</button>)}
          </nav>
        ) : null}
        {menuOpen ? (
          <div className="mobile-menu">
            {manageTabs.map(([id, label]) => <button key={id} onClick={() => navigate(id)}>{label}<Icon name="chevron" size={16} /></button>)}
            <button onClick={() => { setDialog("accounts"); setMenuOpen(false); }}>Accounts &amp; access<Icon name="users" size={16} /></button>
            <button onClick={() => { setDialog("calendar"); setMenuOpen(false); }}>Adjust calendar<Icon name="calendar" size={16} /></button>
            <button onClick={() => { setDialog("invite"); setMenuOpen(false); }}>Invite collaborators<Icon name="invite" size={16} /></button>
          </div>
        ) : null}
        <div className={active === "plan" ? "app-content app-content--plan" : "app-content"}>
          {content}
        </div>
      </div>
      {dialog === "calendar" ? <CalendarDialog week={state.week} onSave={(week) => { update((current) => ({ ...current, week })); showToast(`Calendar set to week ${week}`); }} onClose={() => setDialog(null)} /> : null}
      {dialog === "invite" ? <InviteDialog cloudConfigured={cloudConfigured} cloudReady={cloudReady} syncStatus={syncStatus} syncError={syncError} createInvite={createInvite} onClose={() => setDialog(null)} onToast={showToast} /> : null}
      {dialog === "accounts" ? <RegisteredAccountsDialog cloudConfigured={cloudConfigured} cloudReady={cloudReady} onAccessChanged={refreshCloudConnection} onClose={() => setDialog(null)} onToast={showToast} /> : null}
      {accessRequired ? <AccessDialog key={accessRequired} reason={accessRequired} onCreateAccess={createAccess} onSignIn={signIn} /> : null}
      {toast ? <Toast message={toast} onDismiss={dismissToast} /> : null}
      {syncError ? <span className="visually-hidden">Realtime sync error: {syncError}</span> : null}
    </div>
  );
}
