import { useEffect, useState } from "react";
import {
  createPinAccess,
  getCurrentUsername,
  getPinLoginStatus,
  listRegisteredAccounts,
  removeRegisteredAccount,
  setCurrentUsername,
  signOut,
  updatePin,
  updateRegisteredAccountRole,
} from "../lib/cloud";
import { normalizePin, PIN_PATTERN, PIN_REQUIREMENTS } from "../lib/pins";
import { normalizeUsername, USERNAME_PATTERN, USERNAME_REQUIREMENTS } from "../lib/usernames";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import "./RegisteredAccountsDialog.css";

const roleLabels = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Viewer",
};
const joinedDateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

function memberInitials(member) {
  const source = member.display_name || "Stronghold member";
  return source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function joinedDate(value) {
  if (!value) return "Join date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Join date unavailable";
  return `Joined ${joinedDateFormatter.format(date)}`;
}

function accountErrorMessage(error) {
  if (error?.code === "42883") {
    return "The account-management database update has not been installed yet.";
  }
  if (error?.code === "23505") {
    return "That username is already in use. Try another one.";
  }
  if (error?.code === "22023") {
    return error.message || "That account change is not valid.";
  }
  if (error?.code === "42501") {
    return "Only the stronghold owner can manage workspace access.";
  }
  if (error?.code === "PIN_CONFIRMATION_ENABLED") {
    return "PIN access needs one final server setting before it can be used.";
  }
  if (error?.status === 422 || error?.code === "weak_password") {
    return PIN_REQUIREMENTS;
  }
  return error?.message || "Account information could not be loaded.";
}

export function RegisteredAccountsDialog({ cloudConfigured, cloudReady, onAccessChanged = () => {}, onClose, onToast = () => {} }) {
  const [members, setMembers] = useState([]);
  const [username, setUsername] = useState("");
  const [savedUsername, setSavedUsername] = useState("");
  const [profileStatus, setProfileStatus] = useState("idle");
  const [profileError, setProfileError] = useState("");
  const [pinEnabled, setPinEnabled] = useState(null);
  const [pin, setPin] = useState("");
  const [pinConfirmation, setPinConfirmation] = useState("");
  const [pinStatus, setPinStatus] = useState("idle");
  const [pinError, setPinError] = useState("");
  const [listStatus, setListStatus] = useState("idle");
  const [listError, setListError] = useState("");
  const [canManage, setCanManage] = useState(null);
  const [actionUserId, setActionUserId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    if (!cloudConfigured || !cloudReady) return undefined;
    let active = true;

    setProfileStatus("loading");
    setProfileError("");
    setPinStatus("loading");
    setPinError("");
    Promise.all([getCurrentUsername(), getPinLoginStatus()])
      .then(([value, hasPinLogin]) => {
        if (!active) return;
        setUsername(value);
        setSavedUsername(value);
        setPinEnabled(hasPinLogin);
        setProfileStatus("ready");
        setPinStatus("ready");
      })
      .catch((error) => {
        if (!active) return;
        setProfileStatus("error");
        setPinStatus("error");
        setProfileError(accountErrorMessage(error));
      });

    setListStatus("loading");
    setListError("");
    listRegisteredAccounts()
      .then((accounts) => {
        if (!active) return;
        setMembers(accounts);
        setCanManage(true);
        setListStatus("ready");
      })
      .catch((error) => {
        if (!active) return;
        if (error?.code === "42501") {
          setMembers([]);
          setCanManage(false);
          setListStatus("ready");
          return;
        }
        setCanManage(null);
        setListStatus("error");
        setListError(accountErrorMessage(error));
      });

    return () => {
      active = false;
    };
  }, [cloudConfigured, cloudReady, refreshVersion]);

  const refresh = () => {
    setActionError("");
    setRefreshVersion((value) => value + 1);
  };

  const saveUsername = async (event) => {
    event.preventDefault();
    const nextUsername = normalizeUsername(username);
    if (!USERNAME_PATTERN.test(nextUsername)) {
      setProfileError(USERNAME_REQUIREMENTS);
      return;
    }

    setProfileStatus("saving");
    setProfileError("");
    try {
      const saved = await setCurrentUsername(nextUsername);
      setUsername(saved);
      setSavedUsername(saved);
      setMembers((current) => current.map((member) => (
        member.is_current_user ? { ...member, display_name: saved } : member
      )));
      setProfileStatus("ready");
      onToast("Username saved");
    } catch (error) {
      setProfileStatus("error");
      setProfileError(accountErrorMessage(error));
    }
  };

  const savePinAccess = async (event) => {
    event.preventDefault();
    const nextUsername = normalizeUsername(username);
    if (!pinEnabled && !USERNAME_PATTERN.test(nextUsername)) {
      setPinError(USERNAME_REQUIREMENTS);
      return;
    }
    if (!PIN_PATTERN.test(pin)) {
      setPinError(PIN_REQUIREMENTS);
      return;
    }
    if (pin !== pinConfirmation) {
      setPinError("The two PIN entries do not match.");
      return;
    }

    setPinStatus("saving");
    setPinError("");
    try {
      if (pinEnabled) {
        await updatePin(pin);
      } else {
        await createPinAccess(nextUsername, pin);
        setUsername(nextUsername);
        setSavedUsername(nextUsername);
        setPinEnabled(true);
        onAccessChanged();
      }
      setPin("");
      setPinConfirmation("");
      setPinStatus("ready");
      onToast(pinEnabled ? "PIN changed" : "Username and PIN access created");
      setRefreshVersion((value) => value + 1);
    } catch (error) {
      setPinStatus("error");
      setPinError(accountErrorMessage(error));
    }
  };

  const leaveSession = async () => {
    setPinStatus("saving");
    setPinError("");
    try {
      await signOut();
      onClose();
      onAccessChanged();
    } catch (error) {
      setPinStatus("error");
      setPinError(accountErrorMessage(error));
    }
  };

  const changeRole = async (member, role) => {
    setActionUserId(member.user_id);
    setActionError("");
    try {
      await updateRegisteredAccountRole(member.user_id, role);
      setMembers((current) => current.map((item) => (
        item.user_id === member.user_id ? { ...item, role } : item
      )));
      onToast(`${member.display_name || "Member"} is now a ${role}`);
    } catch (error) {
      setActionError(accountErrorMessage(error));
    } finally {
      setActionUserId(null);
    }
  };

  const removeMember = async (member) => {
    if (!window.confirm(`Remove ${member.display_name || "this member"} from the stronghold?`)) return;
    setActionUserId(member.user_id);
    setActionError("");
    try {
      await removeRegisteredAccount(member.user_id);
      setMembers((current) => current.filter((item) => item.user_id !== member.user_id));
      onToast("Account access removed");
    } catch (error) {
      setActionError(accountErrorMessage(error));
    } finally {
      setActionUserId(null);
    }
  };

  const refreshing = profileStatus === "loading" || listStatus === "loading";

  return (
    <Modal title="Accounts & access" onClose={onClose} className="modal--accounts">
      <div className="registered-accounts-dialog">
        <header className="registered-accounts-dialog__intro">
          <div>
            <span>Workspace access</span>
            <p>Manage your username, PIN, and who can use this stronghold.</p>
          </div>
          <button type="button" className="button button--secondary" onClick={refresh} disabled={!cloudReady || refreshing}>
            <Icon name="refresh" size={16} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </header>

        {!cloudConfigured ? (
          <p className="registered-accounts-dialog__message">Connect Supabase to manage accounts.</p>
        ) : !cloudReady ? (
          <p className="registered-accounts-dialog__message">Waiting for the live workspace connection…</p>
        ) : (
          <>
            <section className="account-profile" aria-labelledby="account-profile-title">
              <div>
                <span>Your profile</span>
                <h3 id="account-profile-title">Choose a username</h3>
                <p>This is the name other stronghold members will see.</p>
              </div>
              <form className="account-profile__form" onSubmit={saveUsername}>
                <label>
                  <span>Username</span>
                  <input
                    aria-describedby="username-help"
                    autoComplete="username"
                    maxLength="24"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="stronghold_keeper"
                  />
                </label>
                <button className="button button--primary" type="submit" disabled={profileStatus === "saving" || username.trim() === savedUsername}>
                  {profileStatus === "saving" ? "Saving…" : "Save username"}
                </button>
              </form>
              <small id="username-help">{USERNAME_REQUIREMENTS} Usernames are unique.</small>
              {profileError ? <p className="account-profile__error" role="alert">{profileError}</p> : null}
            </section>

            <section className="account-pin" aria-labelledby="account-pin-title">
              <div className="account-pin__summary">
                <span>Private access</span>
                <h3 id="account-pin-title">{pinEnabled ? "PIN access is on" : "Sign in from any browser"}</h3>
                <p>{pinEnabled
                  ? "Change your 8-digit PIN here, or sign out on this browser."
                  : "Create an 8-digit PIN so this account is not limited to the current browser."}</p>
              </div>
              <form className="account-pin__form" onSubmit={savePinAccess}>
                <label>
                  <span>{pinEnabled ? "New PIN" : "Choose PIN"}</span>
                  <input required autoComplete="new-password" inputMode="numeric" pattern="[0-9]{8}" maxLength="8" value={pin} onChange={(event) => setPin(normalizePin(event.target.value))} placeholder="8 digits" type="password" />
                </label>
                <label>
                  <span>Confirm PIN</span>
                  <input required autoComplete="new-password" inputMode="numeric" pattern="[0-9]{8}" maxLength="8" value={pinConfirmation} onChange={(event) => setPinConfirmation(normalizePin(event.target.value))} placeholder="Repeat PIN" type="password" />
                </label>
                <button className="button button--primary" type="submit" disabled={pinStatus === "saving" || pinStatus === "loading"}>
                  {pinStatus === "saving" ? "Saving…" : pinEnabled ? "Change PIN" : "Create PIN access"}
                </button>
              </form>
              <div className="account-pin__footer">
                <small>{PIN_REQUIREMENTS} There is no email recovery, so keep it somewhere safe.</small>
                {pinEnabled ? <button className="button button--danger-link" type="button" disabled={pinStatus === "saving"} onClick={leaveSession}>Sign out</button> : null}
              </div>
              {pinError ? <p className="account-profile__error" role="alert">{pinError}</p> : null}
            </section>

            <section className="member-management" aria-labelledby="member-management-title">
              <div className="registered-accounts-dialog__count">
                <span id="member-management-title">Stronghold members</span>
                {canManage ? <span>{members.length} {members.length === 1 ? "member" : "members"}</span> : null}
              </div>

              {actionError ? <p className="registered-accounts-dialog__message registered-accounts-dialog__message--error" role="alert">{actionError}</p> : null}
              {listStatus === "loading" || listStatus === "idle" ? (
                <p className="registered-accounts-dialog__message">Loading account access…</p>
              ) : listStatus === "error" ? (
                <div className="registered-accounts-dialog__message registered-accounts-dialog__message--error" role="alert">
                  <strong>Account access could not be shown.</strong>
                  <span>{listError}</span>
                </div>
              ) : !canManage ? (
                <p className="registered-accounts-dialog__message">Only the stronghold owner can view and change member access.</p>
              ) : members.length ? (
                <div className="registered-accounts-dialog__list">
                  {members.map((member) => {
                    const locked = member.role === "owner" || member.is_current_user;
                    const busy = actionUserId === member.user_id;
                    return (
                      <article className="registered-account" key={member.user_id}>
                        <span className="registered-account__avatar">{memberInitials(member)}</span>
                        <div className="registered-account__identity">
                          <strong>
                            {member.display_name || "Stronghold member"}
                            {member.is_current_user ? <small>You</small> : null}
                          </strong>
                          <time dateTime={member.joined_at}>{joinedDate(member.joined_at)}</time>
                        </div>
                        {locked ? (
                          <span className={`registered-account__role registered-account__role--${member.role}`}>
                            {roleLabels[member.role] ?? member.role}
                          </span>
                        ) : (
                          <select
                            aria-label={`Access level for ${member.display_name || "member"}`}
                            className="registered-account__role-select"
                            disabled={busy}
                            value={member.role}
                            onChange={(event) => changeRole(member, event.target.value)}
                          >
                            <option value="editor">Editor</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        )}
                        <button
                          className="button button--danger-link registered-account__remove"
                          type="button"
                          disabled={locked || busy}
                          onClick={() => removeMember(member)}
                        >
                          <Icon name="trash" size={14} /> {busy ? "Working…" : "Remove"}
                        </button>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="registered-accounts-dialog__message">No members were found for this stronghold.</p>
              )}
            </section>
          </>
        )}
      </div>
    </Modal>
  );
}
