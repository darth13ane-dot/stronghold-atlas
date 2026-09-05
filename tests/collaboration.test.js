import test from "node:test";
import assert from "node:assert/strict";
import { setTimeout as pause } from "node:timers/promises";
import { applyChanges, reverseChanges, stateChanges } from "../src/lib/stateChanges.js";
import { createWorkspaceSync } from "../src/lib/workspaceSync.js";
import { updateProject } from "../src/lib/projects.js";
import { seedState } from "../src/data/seed.js";

const clone = (value) => structuredClone(value);
const withFloor = (state, id) => ({ ...state, floors: [...state.floors, { id, name: id, order: state.floors.length }] });
const withRoom = (state, id, patch) => ({ ...state, rooms: state.rooms.map((room) => room.id === id ? { ...room, ...patch } : room) });

test("undo and redo preserve another person's later floor addition", () => {
  const mine = withFloor(seedState, "mine");
  const both = withFloor(mine, "theirs");
  const undone = applyChanges(both, reverseChanges(stateChanges(seedState, mine)));
  assert.deepEqual(undone.state.floors.map((floor) => floor.id), ["ground", "theirs"]);
  const redone = applyChanges(undone.state, reverseChanges(undone.applied));
  assert.deepEqual(new Set(redone.state.floors.map((floor) => floor.id)), new Set(["ground", "mine", "theirs"]));
});

test("undo reverts my geometry while keeping later room metadata", () => {
  const mine = withRoom(seedState, "archive", { x: 100 });
  const theirs = withRoom(mine, "archive", { name: "Shared archive" });
  const result = applyChanges(theirs, reverseChanges(stateChanges(seedState, mine)));
  assert.equal(result.state.rooms.find((room) => room.id === "archive").name, "Shared archive");
  assert.equal(result.state.rooms.find((room) => room.id === "archive").x, 475);
});

test("undo skips a field another person has subsequently changed", () => {
  const mine = withRoom(seedState, "archive", { x: 100, y: 100 });
  const theirs = withRoom(mine, "archive", { x: 200 });
  const result = applyChanges(theirs, reverseChanges(stateChanges(seedState, mine)));
  const room = result.state.rooms.find((item) => item.id === "archive");
  assert.equal(room.x, 200);
  assert.equal(room.y, 320);
  assert.equal(result.conflicts.length, 1);
});

test("undo cannot remove a floor now containing another person's room", () => {
  const mine = withFloor(seedState, "mine");
  const theirs = withRoom(mine, "archive", { floorId: "mine" });
  const result = applyChanges(theirs, reverseChanges(stateChanges(seedState, mine)));
  assert.deepEqual(result.state, theirs);
  assert.ok(result.conflicts.length);
});

test("entity equality ignores database JSON property order", () => {
  const before = { rooms: [] };
  const after = { rooms: [{ id: "new", name: "Room" }] };
  const fromDatabase = { rooms: [{ name: "Room", id: "new" }] };
  const result = applyChanges(fromDatabase, reverseChanges(stateChanges(before, after)));
  assert.deepEqual(result.state.rooms, []);
  assert.equal(result.conflicts.length, 0);
});

test("concurrent deletion and editing is a conflict, not a resurrected room", () => {
  const edited = withRoom(seedState, "archive", { name: "My edit" });
  const deleted = { ...seedState, rooms: seedState.rooms.filter((room) => room.id !== "archive") };
  const result = applyChanges(deleted, stateChanges(seedState, edited));
  assert.ok(result.conflicts.length);
  assert.equal(result.state.rooms.some((room) => room.id === "archive"), false);
});

function harness(t, options = {}) {
  let snapshot = { state: clone(seedState), version: "001" };
  let local = snapshot.state;
  let currentStatus;
  let message = "";
  let activeRequests = 0;
  let maxRequests = 0;
  let saves = 0;
  const writes = [];
  const server = (state) => { snapshot = { state: clone(state), version: String(Number(snapshot.version) + 1).padStart(3, "0") }; return snapshot; };
  const sync = createWorkspaceSync({
    initial: snapshot,
    delay: 5,
    read: async () => snapshot,
    save: async (state, version) => {
      saves++;
      activeRequests++;
      maxRequests = Math.max(maxRequests, activeRequests);
      try {
        if (options.beforeSave) await options.beforeSave();
        if (snapshot.version !== version) return { saved: false, snapshot };
        writes.push(clone(state));
        return { saved: true, snapshot: server(state) };
      } finally { activeRequests--; }
    },
    onState: (state) => { local = state; },
    onStatus: (status, error) => { currentStatus = status; message = error; },
  });
  t.after(() => sync.disconnect());
  return { sync, server, get local() { return local; }, get snapshot() { return snapshot; }, get status() { return currentStatus; }, get message() { return message; }, get maxRequests() { return maxRequests; }, get saves() { return saves; }, writes };
}

async function until(predicate) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) return;
    await pause(10);
  }
  assert.fail("Sync did not reach the expected state");
}

test("a realtime update preserves pending local edits and saves both changes", async (t) => {
  const h = harness(t);
  h.sync.update((state) => withRoom(state, "archive", { name: "Local name" }));
  h.sync.receive(h.server(withRoom(seedState, "hall", { name: "Remote name" })));
  await until(() => h.status === "online");
  assert.equal(h.snapshot.state.rooms.find((room) => room.id === "archive").name, "Local name");
  assert.equal(h.snapshot.state.rooms.find((room) => room.id === "hall").name, "Remote name");
});

test("a compare-and-swap collision rebases disjoint edits and retries", async (t) => {
  const h = harness(t);
  h.sync.update((state) => ({ ...state, week: 20 }));
  h.server({ ...seedState, treasury: 9000 });
  await until(() => h.status === "online");
  assert.equal(h.saves, 2);
  assert.equal(h.snapshot.state.week, 20);
  assert.equal(h.snapshot.state.treasury, 9000);
});

test("same-field conflict keeps unsaved input and never overwrites the server", async (t) => {
  const h = harness(t);
  h.sync.update((state) => ({ ...state, name: "My name" }));
  h.server({ ...seedState, name: "Their name" });
  await until(() => h.status === "error");
  assert.equal(h.local.name, "My name");
  assert.equal(h.snapshot.state.name, "Their name");
  assert.match(h.message, /not been saved/);
  assert.equal(h.writes.length, 0);
  await h.sync.useSharedVersion();
  assert.equal(h.local.name, "Their name");
  assert.equal(h.status, "online");
});

test("edits during an in-flight save are serialized and not lost to the acknowledgement", async (t) => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const h = harness(t, { beforeSave: () => gate });
  h.sync.update((state) => ({ ...state, week: 20 }));
  await until(() => h.saves === 1);
  h.sync.update((state) => ({ ...state, treasury: 7000 }));
  release();
  await until(() => h.status === "online");
  assert.equal(h.maxRequests, 1);
  assert.equal(h.writes.length, 2);
  assert.equal(h.snapshot.state.week, 20);
  assert.equal(h.snapshot.state.treasury, 7000);
});

test("network failure preserves edits and retry saves them", async (t) => {
  let failing = true;
  const h = harness(t, { beforeSave: () => { if (failing) throw new Error("Network unavailable"); } });
  h.sync.update((state) => ({ ...state, week: 50 }));
  await until(() => h.status === "error");
  assert.equal(h.local.week, 50);
  failing = false;
  await h.sync.retry();
  await until(() => h.status === "online");
  assert.equal(h.snapshot.state.week, 50);
});

test("out-of-order realtime events cannot roll back newer shared state", (t) => {
  const h = harness(t);
  const old = h.snapshot;
  h.sync.receive(h.server({ ...seedState, week: 40 }));
  h.sync.receive(old);
  assert.equal(h.local.week, 40);
});

test("upgrade completion applies the room tier and next upgrade costs once", () => {
  const complete = updateProject(seedState, "p1", { status: "Complete", progress: 2 });
  const room = complete.rooms.find((item) => item.id === "archive");
  assert.equal(room.tier, 3);
  assert.equal(room.upgradeCost, 300);
  assert.equal(complete.projects.find((item) => item.id === "p1").upgradeApplied, true);
  const reopened = updateProject(complete, "p1", { status: "In progress" });
  const repeated = updateProject(reopened, "p1", { status: "Complete" });
  assert.equal(repeated.rooms.find((item) => item.id === "archive").tier, 3);
});

test("target tiers and facility caps prevent duplicate or excessive upgrades", () => {
  const state = withRoom(seedState, "archive", { tier: 4 });
  const completed = updateProject(state, "p1", { status: "Complete", targetTier: 3 });
  const room = completed.rooms.find((item) => item.id === "archive");
  assert.equal(room.tier, 4);
  assert.equal(room.upgradeCost, 0);
});

test("editing a completed task or an unlinked project is safe", () => {
  const completed = { ...seedState, projects: seedState.projects.map((p) => p.id === "p1" ? { ...p, status: "Complete" } : p) };
  const reopened = updateProject(completed, "p1", { status: "In progress" });
  assert.equal(updateProject(reopened, "p1", { status: "Complete" }).rooms[3].tier, 2);
  const missing = updateProject(seedState, "p1", { status: "Complete", roomId: "deleted" });
  assert.deepEqual(missing.rooms, seedState.rooms);
});
