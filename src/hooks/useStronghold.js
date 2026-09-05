import { useCallback, useEffect, useRef, useState } from "react";
import {
  cloudConfigured,
  connectCloudWorkspace,
  createPinAccess,
  signInWithUsernamePin,
} from "../lib/cloud";
import { normalizePolygonPoints, normalizeRoomType, roomTypeFromRoom } from "../data/rooms";
import { createWorkspaceSync } from "../lib/workspaceSync.js";

const STORAGE_KEY = "stronghold-atlas:v2";
const SCHEMA_VERSION = 3;
const OLDEST_SUPPORTED_SCHEMA = 2;
const DEFAULT_FLOOR_ID = "ground";

function normalizeFloors(source, seed) {
  const floors = Array.isArray(source.floors) && source.floors.length ? source.floors : seed.floors;
  return (floors?.length ? floors : [{ id: DEFAULT_FLOOR_ID, name: "Ground Floor", order: 0 }])
    .map((floor, index) => ({
      id: floor.id ?? `${DEFAULT_FLOOR_ID}-${index}`,
      name: floor.name ?? (index === 0 ? "Ground Floor" : `Floor ${index + 1}`),
      order: floor.order ?? index,
    }))
    .sort((a, b) => a.order - b.order);
}

function normalizeLayoutObjects(source, seed, defaultFloorId) {
  const layoutObjects = Array.isArray(source.layoutObjects) ? source.layoutObjects : seed.layoutObjects;
  return (layoutObjects ?? []).map((item) => ({
    kind: "hallway",
    shape: "rect",
    floorId: defaultFloorId,
    color: item.kind === "space" ? "#efe9dc" : "#e7e3da",
    ...item,
  }));
}

function normalizeState(value, seed) {
  const source = value?.schemaVersion >= OLDEST_SUPPORTED_SCHEMA && value.schemaVersion <= SCHEMA_VERSION
    ? value
    : seed;
  const floors = normalizeFloors(source, seed);
  const defaultFloorId = floors[0]?.id ?? DEFAULT_FLOOR_ID;
  const { activeFloorId: _legacyFloorView, ...sharedSource } = source;
  const sourceRooms = Array.isArray(source.rooms) ? source.rooms : seed.rooms;
  const legacyRoomTypes = sourceRooms
    .filter((room) => room.hidden)
    .map((room) => roomTypeFromRoom(room, { id: `room-type-${room.id}`, name: room.name }));
  const sourceRoomTypes = Array.isArray(source.roomTypes)
    ? source.roomTypes
    : legacyRoomTypes.length
      ? legacyRoomTypes
      : seed.roomTypes;
  return {
    ...sharedSource,
    schemaVersion: SCHEMA_VERSION,
    floors,
    condition: {
      status: source.condition?.status ?? "Operational",
      notes: source.condition?.notes ?? "",
    },
    rooms: sourceRooms
      .filter((room) => !room.hidden)
      .map((room) => ({
        shape: "rect",
        floorId: defaultFloorId,
        spaceType: "Operating space",
        ...room,
        ...(room.shape === "polygon" ? { points: normalizePolygonPoints(room.points) } : {}),
      })),
    roomTypes: (sourceRoomTypes ?? []).map(normalizeRoomType),
    layoutObjects: normalizeLayoutObjects(source, seed, defaultFloorId),
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
  const [state, setState] = useState(() => cloudConfigured ? normalizeState(seed, seed) : loadInitialState(seed));
  const [floorViewScope, setFloorViewScope] = useState(cloudConfigured ? null : "local");
  const [syncStatus, setSyncStatus] = useState(cloudConfigured ? "connecting" : "local");
  const [syncError, setSyncError] = useState("");
  const [cloudReady, setCloudReady] = useState(false);
  const [accessRequired, setAccessRequired] = useState(null);
  const [cloudConnectionVersion, setCloudConnectionVersion] = useState(0);
  const cloudRef = useRef(null);
  const syncRef = useRef(null);
  const stateRef = useRef(state);
  const broadcastUpdate = useRef(false);
  const channelRef = useRef(null);

  useEffect(() => {
    // Cloud workspaces already sync through their own authenticated realtime channel.
    if (cloudConfigured || typeof BroadcastChannel === "undefined") return undefined;
    const channel = new BroadcastChannel("stronghold-atlas");
    channelRef.current = channel;
    channel.onmessage = ({ data }) => {
      if (data?.schemaVersion >= OLDEST_SUPPORTED_SCHEMA && data.schemaVersion <= SCHEMA_VERSION) {
        broadcastUpdate.current = true;
        stateRef.current = normalizeState(data, seed);
        setState(stateRef.current);
      }
    };
    return () => {
      channel.close();
      if (channelRef.current === channel) channelRef.current = null;
    };
  }, [seed]);

  useEffect(() => {
    if (cloudConfigured) return;
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
    let activeConnection = null;
    let coordinator = null;
    let initialSnapshot = null;
    setCloudReady(false);
    setFloorViewScope(null);

    connectCloudWorkspace(
      stateRef.current,
      (snapshot) => {
        if (!active) return;
        const normalized = { ...snapshot, state: normalizeState(snapshot.state, seed) };
        if (coordinator) coordinator.receive(normalized);
        else {
          initialSnapshot = normalized;
          stateRef.current = normalized.state;
          setState(normalized.state);
        }
      },
      (status) => {
        if (!active) return;
        if (status === "error" || !coordinator) setSyncStatus(status);
        if (status === "error") setSyncError("The realtime connection could not be established. Retry save to reconnect.");
      },
    )
      .then((connection) => {
        if (!active) {
          connection?.disconnect();
          return;
        }
        activeConnection = connection;
        cloudRef.current = connection;
        const normalizeSnapshot = (snapshot) => ({ ...snapshot, state: normalizeState(snapshot.state, seed) });
        coordinator = createWorkspaceSync({
          initial: initialSnapshot ?? normalizeSnapshot(connection.initial),
          read: async () => normalizeSnapshot(await connection.read()),
          save: async (nextState, version) => {
            const result = await connection.save(nextState, version);
            return { ...result, snapshot: normalizeSnapshot(result.snapshot) };
          },
          onState: (nextState) => { stateRef.current = nextState; setState(nextState); },
          onStatus: (status, error) => { setSyncStatus(status); setSyncError(error); },
        });
        syncRef.current = coordinator;
        setSyncStatus("online");
        setSyncError("");
        setFloorViewScope(connection ? `${connection.id}:${connection.userId}` : null);
        setCloudReady(Boolean(connection));
        setAccessRequired(null);
      })
      .catch((error) => {
        if (!active) return;
        setCloudReady(false);
        const accessModes = {
          PIN_SIGNIN_REQUIRED: "sign-in",
          PIN_JOIN_REQUIRED: "join",
          PIN_SETUP_REQUIRED: "setup",
        };
        if (accessModes[error.code]) {
          setAccessRequired(accessModes[error.code]);
          setSyncStatus("connecting");
          setSyncError("");
        } else {
          setSyncStatus("error");
          setSyncError(error.message);
        }
      });

    return () => {
      active = false;
      coordinator?.disconnect();
      if (syncRef.current === coordinator) syncRef.current = null;
      activeConnection?.disconnect();
      if (cloudRef.current === activeConnection) cloudRef.current = null;
    };
    // Cloud bootstrapping only retries after the active login changes.
    // Ordinary state changes are handled by the connection's save coordinator.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudConnectionVersion]);

  const update = useCallback((updater) => {
    if (cloudConfigured) {
      if (syncRef.current) syncRef.current.update(updater);
      else setSyncError("Wait for the shared stronghold to connect before editing.");
      return;
    }
    stateRef.current = typeof updater === "function" ? updater(stateRef.current) : updater;
    setState(stateRef.current);
  }, []);

  const retrySave = useCallback(() => {
    if (syncRef.current) return syncRef.current.retry();
    setCloudConnectionVersion((version) => version + 1);
  }, []);
  const useSharedVersion = useCallback(() => syncRef.current?.useSharedVersion(), []);

  const createInvite = useCallback(async (role) => {
    if (!cloudRef.current) {
      throw new Error("Cloud sync is still connecting. Try again in a moment.");
    }
    return cloudRef.current.invite(role);
  }, []);

  const signIn = useCallback(async (username, pin) => {
    await signInWithUsernamePin(username, pin);
    setAccessRequired(null);
    setCloudConnectionVersion((version) => version + 1);
  }, []);

  const createAccess = useCallback(async (username, pin) => {
    await createPinAccess(username, pin);
    setAccessRequired(null);
    setCloudConnectionVersion((version) => version + 1);
  }, []);

  const refreshCloudConnection = useCallback(() => {
    setCloudConnectionVersion((version) => version + 1);
  }, []);

  return {
    state,
    floorViewScope,
    update,
    syncStatus,
    syncError,
    retrySave,
    useSharedVersion,
    createInvite,
    cloudConfigured,
    cloudReady,
    accessRequired,
    signIn,
    createAccess,
    refreshCloudConnection,
  };
}
