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

async function ensureSession(client, requirePersistentUser = false) {
  const { data } = await client.auth.getSession();
  if (data.session && (!requirePersistentUser || !data.session.user.is_anonymous)) return data.session;
  if (requirePersistentUser) {
    const error = new Error("Sign in to accept this invitation.");
    error.code = "INVITE_LOGIN_REQUIRED";
    throw error;
  }
  const { data: signedIn, error } = await client.auth.signInAnonymously();
  if (error) throw error;
  return signedIn.session;
}

export async function connectCloudWorkspace(localState, onRemoteState, onStatus) {
  const client = await getClient();
  if (!client) return null;

  onStatus("connecting");
  const params = new URLSearchParams(window.location.search);
  const inviteToken = params.get("invite");
  const session = await ensureSession(client, Boolean(inviteToken));
  const userId = session.user.id;
  let strongholdId = params.get("stronghold");

  if (inviteToken) {
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

export async function sendInviteLogin(email) {
  const client = await getClient();
  if (!client) throw new Error("Cloud login is not configured.");
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href },
  });
  if (error) throw error;
}
