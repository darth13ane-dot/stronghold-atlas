let clientPromise;
let supabaseModulePromise;

const cloudUrl = import.meta.env.VITE_SUPABASE_URL;
const cloudKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const WORKSPACE_STORAGE_KEY = "stronghold-atlas:workspace:v1";
const PIN_EMAIL_DOMAIN = "users.stronghold-atlas.invalid";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const cloudConfigured = Boolean(cloudUrl && cloudKey);

async function getSupabaseModule() {
  if (!supabaseModulePromise) supabaseModulePromise = import("@supabase/supabase-js");
  return supabaseModulePromise;
}

async function getClient() {
  if (!cloudConfigured) return null;
  if (!clientPromise) {
    clientPromise = getSupabaseModule().then(({ createClient }) =>
      createClient(cloudUrl, cloudKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      }),
    );
  }
  return clientPromise;
}

async function getDetachedClient() {
  const { createClient } = await getSupabaseModule();
  return createClient(cloudUrl, cloudKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: `stronghold-atlas-pin-transfer:${crypto.randomUUID()}`,
    },
  });
}

async function requireSession(client, errorCode = "PIN_SIGNIN_REQUIRED") {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (data.session) return data.session;
  const sessionError = new Error("Sign in with your username and PIN to continue.");
  sessionError.code = errorCode;
  throw sessionError;
}

async function readCurrentUsername(client) {
  const { data, error } = await client.rpc("get_current_username");
  if (error) throw error;
  return data ?? "";
}

async function readPinLoginStatus(client) {
  const { data, error } = await client.rpc("has_pin_login");
  if (error) throw error;
  return Boolean(data);
}

async function registerCurrentPinIdentity(client, username) {
  const { error: usernameError } = await client.rpc("set_current_username", { p_username: username });
  if (usernameError) throw usernameError;
  const { error: loginError } = await client.rpc("enable_pin_login");
  if (loginError) throw loginError;
}

function createHiddenLoginEmail() {
  return `pin-${crypto.randomUUID()}@${PIN_EMAIL_DOMAIN}`;
}

async function createNewPinIdentity(username, pin) {
  const client = await getClient();
  if (!client) throw new Error("Cloud sync is not configured.");

  const { data, error } = await client.auth.signUp({
    email: createHiddenLoginEmail(),
    password: pin,
    options: { data: { pin_account: true } },
  });
  if (error) throw error;
  if (!data.session) {
    const confirmationError = new Error("PIN access is not enabled on the server yet.");
    confirmationError.code = "PIN_CONFIRMATION_ENABLED";
    throw confirmationError;
  }
  await registerCurrentPinIdentity(client, username);
}

async function upgradeCurrentIdentity(client, username, pin) {
  const transferNonce = crypto.randomUUID();
  const detachedClient = await getDetachedClient();
  const { data, error } = await detachedClient.auth.signUp({
    email: createHiddenLoginEmail(),
    password: pin,
    options: { data: { pin_account: true, pin_transfer_nonce: transferNonce } },
  });
  if (error) throw error;
  if (!data.session || !data.user) {
    const confirmationError = new Error("PIN access is not enabled on the server yet.");
    confirmationError.code = "PIN_CONFIRMATION_ENABLED";
    throw confirmationError;
  }

  const { error: transferError } = await client.rpc("upgrade_current_user_to_pin", {
    p_new_user_id: data.user.id,
    p_username: username,
    p_transfer_nonce: transferNonce,
  });
  if (transferError) throw transferError;

  const { error: sessionError } = await client.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  if (sessionError) throw sessionError;
}

async function readMostRecentStronghold(client) {
  const { data, error } = await client
    .from("strongholds")
    .select("id,state")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function readRememberedStrongholdId() {
  try {
    const strongholdId = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    return UUID_PATTERN.test(strongholdId ?? "") ? strongholdId : "";
  } catch {
    return "";
  }
}

function rememberStrongholdId(strongholdId) {
  if (!UUID_PATTERN.test(strongholdId ?? "")) return;
  try {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, strongholdId);
  } catch {
    // The reusable URL still works when browser storage is unavailable.
  }
}

function replaceStrongholdLocation(params, strongholdId) {
  params.delete("invite");
  params.set("stronghold", strongholdId);
  window.history.replaceState({}, "", `${window.location.pathname}?${params}`);
}

function getStrongholdId() {
  const strongholdId = new URLSearchParams(window.location.search).get("stronghold");
  if (!strongholdId) throw new Error("The cloud workspace is still connecting.");
  return strongholdId;
}

export function getStrongholdReturnLink() {
  const strongholdId = new URLSearchParams(window.location.search).get("stronghold");
  if (!strongholdId) return "";
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("stronghold", strongholdId);
  return url.toString();
}

export async function connectCloudWorkspace(localState, onRemoteState, onStatus) {
  const client = await getClient();
  if (!client) return null;

  onStatus("connecting");
  const params = new URLSearchParams(window.location.search);
  const inviteToken = params.get("invite");
  const session = await requireSession(client, inviteToken ? "PIN_JOIN_REQUIRED" : "PIN_SIGNIN_REQUIRED");
  const userId = session.user.id;
  let strongholdId = params.get("stronghold");
  let restoredState = null;

  if (!inviteToken && !strongholdId) {
    strongholdId = readRememberedStrongholdId();
    if (!strongholdId) {
      const recentStronghold = await readMostRecentStronghold(client);
      strongholdId = recentStronghold?.id ?? "";
      restoredState = recentStronghold?.state ?? null;
    }
  }

  if (inviteToken) {
    const username = await readCurrentUsername(client);
    if (!username) {
      const error = new Error("Create your username and PIN before accepting this invitation.");
      error.code = "PIN_SETUP_REQUIRED";
      throw error;
    }
    const { data, error } = await client.rpc("accept_stronghold_invite", { p_token: inviteToken });
    if (error) throw error;
    strongholdId = data;
  }

  if (!strongholdId) {
    strongholdId = crypto.randomUUID();
    const { error } = await client
      .from("strongholds")
      .insert({ id: strongholdId, name: localState.name, state: localState, created_by: userId });
    if (error) throw error;
  } else if (restoredState) {
    onRemoteState(restoredState);
  } else {
    const { data, error } = await client
      .from("strongholds")
      .select("state")
      .eq("id", strongholdId)
      .single();
    if (error) throw error;
    if (data?.state) onRemoteState(data.state);
  }

  rememberStrongholdId(strongholdId);
  replaceStrongholdLocation(params, strongholdId);

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

export async function signInWithUsernamePin(username, pin) {
  const client = await getClient();
  if (!client) throw new Error("Cloud sync is not configured.");
  const { data: email, error: lookupError } = await client.rpc("resolve_pin_login", { p_username: username });
  if (lookupError) throw lookupError;
  const { error } = await client.auth.signInWithPassword({ email, password: pin });
  if (error) {
    const signInError = new Error("Username or PIN is incorrect.");
    signInError.code = "INVALID_PIN_LOGIN";
    throw signInError;
  }
}

export async function createPinAccess(username, pin) {
  const client = await getClient();
  if (!client) throw new Error("Cloud sync is not configured.");
  const { data, error } = await client.auth.getSession();
  if (error) throw error;

  if (!data.session) {
    await createNewPinIdentity(username, pin);
    return;
  }

  const pinEnabled = await readPinLoginStatus(client);
  if (pinEnabled) {
    const { error: usernameError } = await client.rpc("set_current_username", { p_username: username });
    if (usernameError) throw usernameError;
    const { error: pinError } = await client.auth.updateUser({ password: pin });
    if (pinError) throw pinError;
    return;
  }

  if (data.session.user.email?.toLowerCase().endsWith(`@${PIN_EMAIL_DOMAIN}`)) {
    await registerCurrentPinIdentity(client, username);
    return;
  }

  await upgradeCurrentIdentity(client, username, pin);
}

export async function getPinLoginStatus() {
  const client = await getClient();
  if (!client) throw new Error("Cloud sync is not configured.");
  await requireSession(client);
  return readPinLoginStatus(client);
}

export async function updatePin(pin) {
  const client = await getClient();
  if (!client) throw new Error("Cloud sync is not configured.");
  await requireSession(client);
  if (!(await readPinLoginStatus(client))) throw new Error("Create PIN access before changing your PIN.");
  const { error } = await client.auth.updateUser({ password: pin });
  if (error) throw error;
}

export async function signOut() {
  const client = await getClient();
  if (!client) return;
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) throw error;
}

export async function listRegisteredAccounts() {
  const client = await getClient();
  if (!client) throw new Error("Cloud sync is not configured.");

  await requireSession(client);
  const { data, error } = await client.rpc("list_stronghold_members", {
    p_stronghold_id: getStrongholdId(),
  });
  if (error) throw error;
  return data ?? [];
}

export async function getCurrentUsername() {
  const client = await getClient();
  if (!client) throw new Error("Cloud sync is not configured.");
  await requireSession(client);
  return readCurrentUsername(client);
}

export async function setCurrentUsername(username) {
  const client = await getClient();
  if (!client) throw new Error("Cloud sync is not configured.");
  await requireSession(client);
  const { data, error } = await client.rpc("set_current_username", { p_username: username });
  if (error) throw error;
  return data;
}

export async function updateRegisteredAccountRole(userId, role) {
  const client = await getClient();
  if (!client) throw new Error("Cloud sync is not configured.");
  await requireSession(client);
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
  await requireSession(client);
  const { error } = await client.rpc("remove_stronghold_member", {
    p_stronghold_id: getStrongholdId(),
    p_user_id: userId,
  });
  if (error) throw error;
}
