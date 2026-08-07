import { useEffect, useState } from "react";
import {
  getCurrentUsername,
  listRegisteredAccounts,
  removeRegisteredAccount,
  setCurrentUsername,
  updateRegisteredAccountRole,
} from "../lib/cloud";
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
  const source = member.display_name || member.email || "Stronghold member";
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
  return error?.message || "Account information could not be loaded.";
}

export function RegisteredAccountsDialog({ cloudConfigured, cloudReady, onClose, onToast = () => {} }) {
  const [members, setMembers] = useState([]);
  const [username, setUsername] = useState("");
  const [savedUsername, setSavedUsername] = useState("");
  const [profileStatus, setProfileStatus] = useState("idle");
  const [profileError, setProfileError] = useState("");
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
    getCurrentUsername()
      .then((value) => {
        if (!active) return;
        setUsername(value);
        setSavedUsername(value);
        setProfileStatus("ready");
      })
      .catch((error) => {
        if (!active) return;
        setProfileStatus("error");
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
    if (!window.confirm(`Remove ${member.display_name || member.email || "this member"} from the stronghold?`)) return;
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
    <Modal title="Accounts & access" onClose={onClose}>
      <div className="registered-accounts-dialog">
        <header className="registered-accounts-dialog__intro">
          <div>
            <span>Workspace access</span>
            <p>Choose your public username and manage who can use this stronghold.</p>
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
                          <span>{member.email || "Username-only access"}</span>
                          <time dateTime={member.joined_at}>{joinedDate(member.joined_at)}</time>
                        </div>
                        {locked ? (
                          <span className={`registered-account__role registered-account__role--${member.role}`}>
                            {roleLabels[member.role] ?? member.role}
                          </span>
                        ) : (
                          <select
                            aria-label={`Access level for ${member.display_name || member.email}`}
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
