import { applyChanges, stateChanges } from "./stateChanges.js";

const CONFLICT_MESSAGE = "Another person changed the same part of the stronghold. Your edits are still here and have not been saved. Retry after resolving the difference, or use the shared version to discard your unsaved edits.";

// One request at a time; incoming updates and edits made during a save are rebased.
export function createWorkspaceSync({ initial, save, read, onState, onStatus, delay = 500 }) {
  let base = initial;
  let local = initial.state;
  let latest = initial;
  let inFlight = false;
  let stopped = false;
  let blocked = false;
  let timer;
  let collisions = 0;
  const pending = () => stateChanges(base.state, local);
  const newer = (snapshot, than) => snapshot.version > than.version;
  const publish = () => { if (!stopped) onState(local); };
  const status = (value, error = "") => { if (!stopped) onStatus(value, error); };

  function schedule() {
    clearTimeout(timer);
    if (stopped || blocked || inFlight) return;
    if (!pending().length) { status("online"); return; }
    status("saving");
    timer = setTimeout(flush, delay);
  }

  function receive(snapshot) {
    if (stopped || newer(base, snapshot)) return;
    if (newer(snapshot, latest)) latest = snapshot;
    if (inFlight) return;
    const merged = applyChanges(snapshot.state, pending());
    if (merged.conflicts.length) {
      blocked = true;
      clearTimeout(timer);
      status("error", CONFLICT_MESSAGE);
      return;
    }
    base = snapshot;
    local = merged.state;
    blocked = false;
    publish();
    schedule();
  }

  async function flush() {
    if (stopped || blocked || inFlight || !pending().length) return;
    inFlight = true;
    const sent = local;
    try {
      const result = await save(sent, base.version);
      if (stopped) return;
      inFlight = false;
      if (result.saved) {
        // Only acknowledge what this request sent; newer local edits remain pending.
        base = { ...result.snapshot, state: sent };
        collisions = 0;
      } else if (++collisions >= 5) {
        status("error", "The stronghold is changing too quickly to save. Your edits are still here. Retry save in a moment.");
        return;
      }
      receive(newer(latest, result.snapshot) ? latest : result.snapshot);
    } catch (error) {
      inFlight = false;
      status("error", error.message || "Your changes could not be saved. Retry save to try again.");
    }
  }

  return {
    receive,
    update(updater) {
      if (stopped) return;
      local = typeof updater === "function" ? updater(local) : updater;
      publish();
      schedule();
    },
    async retry() {
      if (stopped || inFlight) return;
      clearTimeout(timer);
      inFlight = true;
      collisions = 0;
      try {
        const snapshot = await read();
        inFlight = false;
        receive(newer(latest, snapshot) ? latest : snapshot);
      } catch (error) { inFlight = false; status("error", error.message); }
    },
    async useSharedVersion() {
      if (stopped || inFlight) return;
      clearTimeout(timer);
      inFlight = true;
      try {
        const shared = await read();
        const snapshot = newer(latest, shared) ? latest : shared;
        inFlight = false;
        if (stopped) return;
        clearTimeout(timer);
        base = latest = snapshot;
        local = snapshot.state;
        blocked = false;
        collisions = 0;
        publish();
        status("online");
      } catch (error) { inFlight = false; status("error", error.message); }
    },
    disconnect() { stopped = true; clearTimeout(timer); },
  };
}
