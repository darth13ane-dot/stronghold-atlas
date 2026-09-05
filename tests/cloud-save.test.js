import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Buffer } from "node:buffer";

test("cloud writes use the database timestamp as an atomic precondition and report stale or denied writes", async (t) => {
  const source = await readFile(new URL("../src/lib/cloud.js", import.meta.url), "utf8");
  const moduleSource = source
    .replace("import.meta.env.VITE_SUPABASE_URL", JSON.stringify("https://test.invalid"))
    .replace("import.meta.env.VITE_SUPABASE_ANON_KEY", JSON.stringify("public-test-key"))
    .replace('import("@supabase/supabase-js")', "Promise.resolve({ createClient: () => globalThis.testCloudClient })");
  let stored = { state: { name: "Shared" }, updated_at: "2026-09-05T00:00:00.000001+00:00" };
  let denied = false;
  let updates = 0;
  const workspace = "11111111-1111-4111-8111-111111111111";
  globalThis.window = {
    location: { search: `?stronghold=${workspace}`, pathname: "/" },
    history: { replaceState() {} },
    localStorage: { setItem() {} },
  };
  globalThis.testCloudClient = {
    auth: { getSession: async () => ({ data: { session: { user: { id: "alice" } } } }) },
    from: () => {
      let payload;
      const filters = {};
      return {
        select() { return this; },
        update(value) { payload = value; return this; },
        eq(key, value) { filters[key] = value; return this; },
        async single() { return { data: stored, error: null }; },
        async maybeSingle() {
          assert.equal(filters.id, workspace);
          assert.ok(filters.updated_at, "Each write must include an expected timestamp");
          assert.equal(Object.hasOwn(payload, "updated_at"), false, "The database supplies the new timestamp");
          if (denied || filters.updated_at !== stored.updated_at) return { data: null, error: null };
          updates++;
          stored = { state: payload.state, updated_at: "2026-09-05T00:00:00.000002+00:00" };
          return { data: stored, error: null };
        },
      };
    },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel() {},
  };
  t.after(() => { delete globalThis.window; delete globalThis.testCloudClient; });
  const cloud = await import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}`);
  const connection = await cloud.connectCloudWorkspace({ name: "Seed" }, () => {}, () => {});
  const first = await connection.save({ name: "Alice" }, connection.initial.version);
  assert.equal(first.saved, true);
  const stale = await connection.save({ name: "Bob" }, connection.initial.version);
  assert.equal(stale.saved, false);
  assert.equal(stale.snapshot.state.name, "Alice");
  assert.equal(updates, 1);
  denied = true;
  await assert.rejects(connection.save({ name: "Denied" }, stale.snapshot.version), /permission/);
  connection.disconnect();
});
