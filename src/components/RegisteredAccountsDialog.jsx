import { useEffect, useState } from "react";
import { listRegisteredAccounts } from "../lib/cloud";
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
  const source = member.display_name || member.email || "Registered account";
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
  return `Joined ${joinedDateFormatter.format(new Date(value))}`;
}

function accountErrorMessage(error) {
  if (error?.code === "42883") {
    return "The registered-accounts database update has not been installed yet.";
  }
  if (error?.code === "42501") {
    return "Only the stronghold owner can view registered accounts.";
  }
  return error?.message || "Registered accounts could not be loaded.";
}

export function RegisteredAccountsDialog({ cloudConfigured, cloudReady, onClose }) {
  const [members, setMembers] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    if (!cloudConfigured || !cloudReady) return undefined;
    let active = true;

    setStatus("loading");
    setError("");
    listRegisteredAccounts()
      .then((accounts) => {
        if (!active) return;
        setMembers(accounts);
        setStatus("ready");
      })
      .catch((loadError) => {
        if (!active) return;
        setStatus("error");
        setError(accountErrorMessage(loadError));
      });

    return () => {
      active = false;
    };
  }, [cloudConfigured, cloudReady, refreshVersion]);

  const refresh = () => setRefreshVersion((value) => value + 1);

  return (
    <Modal title="Registered accounts" onClose={onClose}>
      <div className="registered-accounts-dialog">
        <header className="registered-accounts-dialog__intro">
          <div>
            <span>Workspace access</span>
            <p>Accounts that have joined this stronghold through an invitation.</p>
          </div>
          <button type="button" className="button button--secondary" onClick={refresh} disabled={!cloudReady || status === "loading"}>
            <Icon name="refresh" size={16} />
            {status === "loading" ? "Refreshing…" : "Refresh"}
          </button>
        </header>

        {!cloudConfigured ? (
          <p className="registered-accounts-dialog__message">Connect Supabase to see registered accounts.</p>
        ) : !cloudReady || ["idle", "loading"].includes(status) ? (
          <p className="registered-accounts-dialog__message">Loading registered accounts…</p>
        ) : status === "error" ? (
          <div className="registered-accounts-dialog__message registered-accounts-dialog__message--error" role="alert">
            <strong>Registered accounts could not be shown.</strong>
            <span>{error}</span>
          </div>
        ) : members.length ? (
          <>
            <div className="registered-accounts-dialog__count">{members.length} registered {members.length === 1 ? "account" : "accounts"}</div>
            <div className="registered-accounts-dialog__list">
              {members.map((member) => (
                <article className="registered-account" key={member.user_id}>
                  <span className="registered-account__avatar">{memberInitials(member)}</span>
                  <div className="registered-account__identity">
                    <strong>
                      {member.display_name || "Registered account"}
                      {member.is_current_user ? <small>You</small> : null}
                    </strong>
                    <span>{member.email || "Email unavailable"}</span>
                  </div>
                  <span className={`registered-account__role registered-account__role--${member.role}`}>
                    {roleLabels[member.role] ?? member.role}
                  </span>
                  <time dateTime={member.joined_at}>{joinedDate(member.joined_at)}</time>
                </article>
              ))}
            </div>
          </>
        ) : (
          <p className="registered-accounts-dialog__message">No registered accounts were found for this stronghold.</p>
        )}
      </div>
    </Modal>
  );
}
