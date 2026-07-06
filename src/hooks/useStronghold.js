import { useCallback, useEffect, useRef, useState } from "react";
import { cloudConfigured, connectCloudWorkspace } from "../lib/cloud";

const STORAGE_KEY = "stronghold-atlas:v2";

function normalizeState(value, seed) {
  const source = value?.schemaVersion === 2 ? value : seed;
  return {
    ...source,
    condition: {
      status: source.condition?.status ?? "Operational",
      notes: source.condition?.notes ?? "",
    },
    rooms: (source.rooms ?? seed.rooms).map((room) => ({
      shape: "rect",
      ...room,
    })),
  };
}

function loadInitialState(seed) {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return normalizeState(seed, seed);
    return normalizeState(JSON.parse(saved), seed);
  } catch {
    return normalizeState(seed, seed);
  }
}

export function useStronghold(seed) {
  const [state, setState] = useState(() => loadInitialState(seed));
  const [syncStatus, setSyncStatus] = useState(cloudConfigured ? "connecting" : "local");
  const [syncError, setSyncError] = useState("");
  const [cloudReady, setCloudReady] = useState(false);
  const cloudRef = useRef(null);
  const remoteUpdate = useRef(false);
  const broadcastUpdate = useRef(false);
  const channelRef = useRef(null);

  useEffect(() => {
    const channel = new BroadcastChannel("stronghold-atlas");
    channelRef.current = channel;
    channel.onmessage = ({ data }) => {
      if (data?.schemaVersion === 2) {
        broadcastUpdate.current = true;
        remoteUpdate.current = true;
        setState(normalizeState(data, seed));
      }
    };
    return () => {
      channel.close();
      if (channelRef.current === channel) channelRef.current = null;
    };
  }, [seed]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // The app can keep running when storage is unavailable or full.
    }
    if (broadcastUpdate.current) {
      broadcastUpdate.current = false;
    } else {
      channelRef.current?.postMessage(state);
    }
  }, [state]);

  useEffect(() => {
    if (!cloudConfigured) return undefined;
    let active = true;

    connectCloudWorkspace(
      state,
      (remoteState) => {
        if (!active) return;
        remoteUpdate.current = true;
        setState(normalizeState(remoteState, seed));
      },
      (status) => {
        setSyncStatus(status);
        if (status === "online") setSyncError("");
        if (status === "error") setSyncError("The realtime connection could not be established.");
      },
    )
      .then((connection) => {
        if (!active) {
          connection?.disconnect();
          return;
        }
        cloudRef.current = connection;
        setCloudReady(Boolean(connection));
      })
      .catch((error) => {
        setCloudReady(false);
        setSyncStatus("error");
        setSyncError(error.message);
      });

    return () => {
      active = false;
      cloudRef.current?.disconnect();
    };
    // The initial snapshot is intentionally captured once for cloud bootstrapping.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!cloudRef.current) return undefined;
    if (remoteUpdate.current) {
      remoteUpdate.current = false;
      return undefined;
    }
    setSyncStatus("saving");
    const timer = window.setTimeout(() => {
      cloudRef.current
        ?.save(state)
        .then(() => {
          setSyncStatus("online");
          setSyncError("");
        })
        .catch((error) => {
          setSyncStatus("error");
          setSyncError(error.message);
        });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [state]);

  const update = useCallback((updater) => {
    setState((current) => (typeof updater === "function" ? updater(current) : updater));
  }, []);

  const createInvite = useCallback(async (role) => {
    if (!cloudRef.current) {
      throw new Error("Cloud sync is still connecting. Try again in a moment.");
    }
    return cloudRef.current.invite(role);
  }, []);

  return { state, update, syncStatus, syncError, createInvite, cloudConfigured, cloudReady };
}
