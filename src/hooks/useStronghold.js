import { useCallback, useEffect, useRef, useState } from "react";
import { cloudConfigured, connectCloudWorkspace } from "../lib/cloud";

const STORAGE_KEY = "stronghold-atlas:v2";

function loadInitialState(seed) {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return seed;
    const parsed = JSON.parse(saved);
    return parsed.schemaVersion === 2 ? parsed : seed;
  } catch {
    return seed;
  }
}

export function useStronghold(seed) {
  const [state, setState] = useState(() => loadInitialState(seed));
  const [syncStatus, setSyncStatus] = useState(cloudConfigured ? "connecting" : "local");
  const [syncError, setSyncError] = useState("");
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
        setState(data);
      }
    };
    return () => {
      channel.close();
      if (channelRef.current === channel) channelRef.current = null;
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
        setState(remoteState);
      },
      setSyncStatus,
    )
      .then((connection) => {
        if (!active) {
          connection?.disconnect();
          return;
        }
        cloudRef.current = connection;
      })
      .catch((error) => {
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
        .then(() => setSyncStatus("online"))
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
    if (!cloudRef.current) return null;
    return cloudRef.current.invite(role);
  }, []);

  return { state, update, syncStatus, syncError, createInvite, cloudConfigured };
}
