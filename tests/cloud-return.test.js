import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Buffer } from "node:buffer";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const storageKey = "stronghold-atlas:workspace:v1";
const source = await readFile(new URL("../src/lib/cloud.js", import.meta.url), "utf8");
const moduleSource = source
  .replace("import.meta.env.VITE_SUPABASE_URL", JSON.stringify("https://test.invalid"))
  .replace("import.meta.env.VITE_SUPABASE_ANON_KEY", JSON.stringify("public-test-key"))
  .replace('import("@supabase/supabase-js")', "Promise.resolve({ createClient: () => globalThis.returnTestClient })");

async function fixture(t, { search = "", remembered = "", reads = [] } = {}) {
  const storage = new Map(remembered ? [[storageKey, remembered]] : []);
  const changes = [];
  let claims = 0;
  let inserts = 0;
  const location = { search, pathname: "/stronghold-atlas/" };
  globalThis.window = {
    location,
    history: { replaceState(_state, _unused, url) { location.search = new URL(url, "https://test.invalid").search; } },
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
  };
  globalThis.returnTestClient = {
    auth: { getSession: async () => ({ data: { session: { user: { id: "player" } } }, error: null }) },
    rpc: async (name) => {
      if (name === "get_current_username") return { data: "player", error: null };
      if (name === "accept_stronghold_invite") {
        claims++;
        return claims === 1 ? { data: workspaceId, error: null } : { data: null, error: new Error("Invite already used") };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    },
    from: () => ({
      select() { return this; },
      eq(key, value) { assert.equal(key, "id"); assert.equal(value, workspaceId); return this; },
      async maybeSingle() { return reads.shift() ?? { data: null, error: null }; },
      async single() { return reads.shift() ?? { data: null, error: null }; },
      async insert() { inserts++; return { error: null }; },
    }),
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel() {},
  };
  t.after(() => { delete globalThis.window; delete globalThis.returnTestClient; });
  // Each fixture needs its own cached clientPromise.
  const cloud = await import(`data:text/javascript;base64,${Buffer.from(`${moduleSource}\n// ${Math.random()}`).toString("base64")}`);
  return { cloud, location, storage, changes, get claims() { return claims; }, get inserts() { return inserts; } };
}

for (const mode of ["explicit", "remembered"]) {
  test(`an inaccessible ${mode} stronghold gives an actionable error without creating a replacement`, async (t) => {
    const f = await fixture(t, mode === "explicit" ? { search: `?stronghold=${workspaceId}` } : { remembered: workspaceId });
    await assert.rejects(f.cloud.connectCloudWorkspace({ name: "Seed" }, () => {}, () => {}), (error) => {
      assert.equal(error.code, "WORKSPACE_UNAVAILABLE");
      assert.match(error.message, /access|invite/i);
      return true;
    });
    assert.equal(f.inserts, 0);
    if (mode === "explicit") assert.equal(new URLSearchParams(f.location.search).get("stronghold"), workspaceId);
    else assert.equal(f.storage.get(storageKey), workspaceId);
  });
}

for (const failure of [
  { code: "57014", message: "database timeout" },
  { code: "PGRST116", message: "Cannot coerce the result to a single JSON object", details: "The result contains 2 rows" },
]) {
  test(`database error ${failure.code} remains visible and does not create a replacement`, async (t) => {
    const f = await fixture(t, { search: `?stronghold=${workspaceId}`, reads: [{ data: null, error: failure }] });
    await assert.rejects(f.cloud.connectCloudWorkspace({ name: "Seed" }, () => {}, () => {}), (error) => error === failure);
    assert.equal(f.inserts, 0);
  });
}

test("accepted invite survives a transient first read and can reconnect without consuming it twice", async (t) => {
  const failure = { code: "FETCH_ERROR", message: "network unavailable" };
  const snapshot = { state: { name: "Shared Keep" }, updated_at: "2026-10-29T12:00:00Z" };
  const f = await fixture(t, { search: "?invite=single-use-token", reads: [{ data: null, error: failure }, { data: snapshot, error: null }] });
  await assert.rejects(f.cloud.connectCloudWorkspace({ name: "Seed" }, () => {}, () => {}), (error) => error === failure);
  assert.equal(f.claims, 1);
  assert.equal(new URLSearchParams(f.location.search).get("stronghold"), workspaceId);
  assert.equal(new URLSearchParams(f.location.search).has("invite"), false);
  const connection = await f.cloud.connectCloudWorkspace({ name: "Seed" }, (value) => f.changes.push(value), () => {});
  assert.equal(connection.initial.state.name, "Shared Keep");
  assert.equal(f.claims, 1);
  assert.equal(f.inserts, 0);
  connection.disconnect();
});
