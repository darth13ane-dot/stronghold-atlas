let clientPromise;

const cloudUrl = import.meta.env.VITE_SUPABASE_URL;
const cloudKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const cloudConfigured = Boolean(cloudUrl && cloudKey);

async function getClient() {
  if (!cloudConfigured) return null;
  if (!clientPromise) {
    clientPromise = import("@supabase/supabase-js").then(({ createClient }) =>
      createClient(cloudUrl, cloudKey, {
        auth: { persistSession: true, autoRefreshToken: true },
      }),
    );
  }
  return clientPromise;
}

async function ensureSession(client) {
  const { data } = await client.auth.getSession();
  if (data.session) return data.session;
  const { data: signedIn, error } = await client.auth.signInAnonymously();
  if (error) throw error;
  if (!signedIn.session) throw new Error("Supabase did not create a browser session.");
  return signedIn.session;
}

async function readCurrentUsername(client) {
  const { data, error } = await client.rpc("get_current_username");
  if (error) throw error;
  return data ?? "";
}

function getStrongholdId() {
  const strongholdId = new URLSearchParams(window.location.search).get("stronghold");
  if (!strongholdId) throw new Error("The cloud workspace is still connecting.");
  return strongholdId;
}

export async function connectCloudWorkspace(localState, onRemoteState, onStatus) {
  const client = await getClient();
  if (!client) return null;

  onStatus("connecting");
  const params = new URLSearchParams(window.location.search);
  const inviteToken = params.get("invite");
  const session = await ensureSession(client);
  const userId = session.user.id;
  let strongholdId = params.get("stronghold");

  if (inviteToken) {
    const username = await readCurrentUsername(client);
    if (!username) {
      const error = new Error("Choose a username to accept this invitation.");
      error.code = "INVITE_USERNAME_REQUIRED";
      throw error;
    }
    const { data, error } = await client.rpc("accept_stronghold_invite", { p_token: inviteToken });
    if (error) throw error;
    strongholdId = data;
    params.delete("invite");
    params.set("stronghold", strongholdId);
    window.history.replaceState({}, "", `${window.location.pathname}?${params}`);
  }

  if (!strongholdId) {
    strongholdId = crypto.randomUUID();
    const { error } = await client
      .from("strongholds")
      .insert({ id: strongholdId, name: localState.name, state: localState, created_by: userId });
    if (error) throw error;
    params.set("stronghold", strongholdId);
    window.history.replaceState({}, "", `${window.location.pathname}?${params}`);
  } else {
    const { data, error } = await client
      .from("strongholds")
      .select("state")
      .eq("id", strongholdId)
      .single();
    if (error) throw error;
    if (data?.state) onRemoteState(data.state);
  }

  const channel = client
    .channel(`stronghold:${strongholdId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "strongholds", filter: `id=eq.${strongholdId}` },
      (payload) => {
        if (payload.new?.state) onRemoteState(payload.new.state);
      },
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") onStatus("online");
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") onStatus("error");
    });

  return {
    id: strongholdId,
    save: async (state) => {
      const { error } = await client
        .from("strongholds")
        .update({ name: state.name, state, updated_at: new Date().toISOString() })
        .eq("id", strongholdId);
      if (error) throw error;
    },
    invite: async (role = "editor") => {
      const { data, error } = await client.rpc("create_stronghold_invite", {
        p_stronghold_id: strongholdId,
        p_role: role,
      });
      if (error) throw error;
      if (!data) throw new Error("Supabase did not return an invite token.");
      return `${window.location.origin}${window.location.pathname}?invite=${data}`;
    },
    disconnect: () => {
      client.removeChannel(channel);
    },
  };
}

export async function listRegisteredAccounts() {
  const client = await getClient();
  if (!client) throw new Error("Cloud sync is not configured.");

  await ensureSession(client);
  const strongholdId = getStrongholdId();

  const { data, error } = await client.rpc("list_stronghold_members", {
    p_stronghold_id: strongholdId,
  });
  if (error) throw error;
  return data ?? [];
}

export async function getCurrentUsername() {
  const client = await getClient();
  if (!client) throw new Error("Cloud sync is not configured.");
  await ensureSession(client);
  return readCurrentUsername(client);
}

export async function setCurrentUsername(username) {
  const client = await getClient();
  if (!client) throw new Error("Cloud sync is not configured.");
  await ensureSession(client);
  const { data, error } = await client.rpc("set_current_username", { p_username: username });
  if (error) throw error;
  return data;
}

export async function updateRegisteredAccountRole(userId, role) {
  const client = await getClient();
  if (!client) throw new Error("Cloud sync is not configured.");
  await ensureSession(client);
  const { data, error } = await client.rpc("update_stronghold_member_role", {
    p_stronghold_id: getStrongholdId(),
    p_user_id: userId,
    p_role: role,
  });
  if (error) throw error;
  return data;
}

export async function removeRegisteredAccount(userId) {
  const client = await getClient();
  if (!client) throw new Error("Cloud sync is not configured.");
  await ensureSession(client);
  const { error } = await client.rpc("remove_stronghold_member", {
    p_stronghold_id: getStrongholdId(),
    p_user_id: userId,
  });
  if (error) throw error;
}
