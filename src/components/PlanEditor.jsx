import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { facilityCatalog } from "../data/rules";
import { Icon } from "./Icon";

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 850;
const DEFAULT_FLOOR_ID = "ground";
const MIN_ROOM_SIZE = 70;
const MIN_LAYOUT_SIZE = 35;
const EMPTY_ARRAY = [];

const toolItems = [
  { id: "select", label: "Select", icon: "select" },
  { id: "add", label: "Add room", icon: "add" },
  { id: "space", label: "Add space", icon: "plan" },
  { id: "hallway", label: "Add hall", icon: "wall" },
];

const roomStatusOptions = ["Operational", "Needs repair", "Under repair", "Restricted", "Planned"];
const roomSpaceOptions = ["Operating space", "Common area", "Support space", "Private quarters", "Defensive space", "Storage", "Exterior", "Other"];
const layoutObjectTypes = [
  { id: "space", label: "Operating space", defaultName: "Operating space", color: "#efe9dc", w: 210, h: 145 },
  { id: "hallway", label: "Hallway", defaultName: "Hallway", color: "#e7e3da", w: 170, h: 55 },
  { id: "stairs", label: "Stairs / landing", defaultName: "Stairs", color: "#deddd5", w: 115, h: 115 },
  { id: "utility", label: "Utility space", defaultName: "Utility space", color: "#e8e2d5", w: 150, h: 105 },
];
const layoutObjectTypeMap = new Map(layoutObjectTypes.map((item) => [item.id, item]));

function getFloorId(item) {
  return item.floorId ?? DEFAULT_FLOOR_ID;
}

function isOnFloor(item, floorId) {
  return getFloorId(item) === floorId;
}

function sortFloors(floors) {
  return [...floors].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function getFirstSelection(rooms, layoutObjects, floorId) {
  const room = rooms.find((item) => !item.hidden && isOnFloor(item, floorId));
  if (room) return { type: "room", id: room.id };

  const layoutObject = layoutObjects.find((item) => isOnFloor(item, floorId));
  if (layoutObject) return { type: "layoutObject", id: layoutObject.id };

  return null;
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1000)}`;
}

function snap(value) {
  return Math.round(value / 5) * 5;
}

function clampItemToCanvas(item, minSize) {
  const w = Math.max(minSize, Math.min(CANVAS_WIDTH, Number(item.w) || minSize));
  const h = Math.max(minSize, Math.min(CANVAS_HEIGHT, Number(item.h) || minSize));
  return {
    ...item,
    w: snap(Math.min(w, CANVAS_WIDTH)),
    h: snap(Math.min(h, CANVAS_HEIGHT)),
    x: snap(Math.max(0, Math.min(CANVAS_WIDTH - w, Number(item.x) || 0))),
    y: snap(Math.max(0, Math.min(CANVAS_HEIGHT - h, Number(item.y) || 0))),
  };
}

function itemArea(item) {
  if (item.shape === "round") return Math.PI * (item.w / 2) * (item.h / 2);
  return item.w * item.h;
}

function isTextEntryTarget(target) {
  const tag = target?.tagName;
  return target?.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function Furniture({ room }) {
  const centerX = room.x + room.w / 2;
  const centerY = room.y + room.h / 2;
  const deskW = Math.min(105, room.w * 0.38);
  const deskH = Math.min(45, room.h * 0.24);

  if (room.facility === "Gardens") {
    return (
      <g className="furniture">
        <circle cx={centerX} cy={centerY} r={Math.min(38, room.h * 0.17)} />
        <circle cx={centerX} cy={centerY} r={Math.min(27, room.h * 0.12)} />
        <path d={`M${centerX - 18} ${centerY}h36M${centerX} ${centerY - 18}v36`} />
      </g>
    );
  }

  if (["Vault", "Armory & Defenses", "Secure Holding"].includes(room.facility)) {
    return (
      <g className="furniture">
        <circle cx={centerX} cy={centerY} r={Math.min(32, room.h * 0.18)} />
        <circle cx={centerX} cy={centerY} r={Math.min(22, room.h * 0.12)} />
        <path d={`M${centerX - 16} ${centerY - 16}l32 32M${centerX + 16} ${centerY - 16}l-32 32`} />
      </g>
    );
  }

  if (room.facility === "Library") {
    const shelfHeight = Math.max(34, room.h - 60);
    return (
      <g className="furniture">
        <rect x={room.x + 15} y={room.y + 30} width="15" height={shelfHeight} />
        <rect x={room.x + room.w - 30} y={room.y + 30} width="15" height={shelfHeight} />
        <path d={`M${room.x + 18} ${room.y + 52}h9M${room.x + 18} ${room.y + 76}h9M${room.x + room.w - 27} ${room.y + 52}h9M${room.x + room.w - 27} ${room.y + 76}h9`} />
        <rect x={centerX - deskW / 2} y={centerY - deskH / 2} width={deskW} height={deskH} rx="3" />
      </g>
    );
  }

  if (room.facility === "Guest Rooms" && room.w > 170) {
    return (
      <g className="furniture">
        <rect x={room.x + 25} y={room.y + 28} width="48" height="72" rx="3" />
        <rect x={room.x + room.w - 73} y={room.y + 28} width="48" height="72" rx="3" />
        <path d={`M${room.x + 25} ${room.y + 48}h48M${room.x + room.w - 73} ${room.y + 48}h48`} />
        <circle cx={centerX} cy={centerY + 5} r="20" />
      </g>
    );
  }

  if (room.facility === "Workshop") {
    return (
      <g className="furniture">
        <rect x={room.x + 25} y={room.y + 28} width="24" height={room.h - 56} />
        <rect x={centerX - deskW / 2} y={centerY - deskH / 2} width={deskW} height={deskH} rx="3" />
        <circle cx={centerX - deskW / 2 - 12} cy={centerY} r="8" />
        <circle cx={centerX + deskW / 2 + 12} cy={centerY} r="8" />
      </g>
    );
  }

  if (room.w < 130 || room.h < 90) return null;
  return (
    <g className="furniture">
      <rect x={centerX - deskW / 2} y={centerY - deskH / 2} width={deskW} height={deskH} rx="3" />
      <path d={`M${centerX - deskW / 3} ${centerY - deskH / 2 - 8}v-8h${deskW / 1.5}v8`} />
      <path d={`M${centerX - deskW / 3} ${centerY + deskH / 2 + 8}v8h${deskW / 1.5}v-8`} />
    </g>
  );
}

function ItemShape({ item, className, inset = 0, fill }) {
  if (item.shape === "round") {
    return (
      <ellipse
        className={className}
        cx={item.x + item.w / 2}
        cy={item.y + item.h / 2}
        rx={Math.max(1, item.w / 2 - inset)}
        ry={Math.max(1, item.h / 2 - inset)}
        fill={fill}
      />
    );
  }
  return (
    <rect
      className={className}
      x={item.x + inset}
      y={item.y + inset}
      width={Math.max(1, item.w - inset * 2)}
      height={Math.max(1, item.h - inset * 2)}
      fill={fill}
    />
  );
}

function ResizeHandles({ item, onResize }) {
  const handles = [
    ["nw", item.x, item.y],
    ["ne", item.x + item.w, item.y],
    ["sw", item.x, item.y + item.h],
    ["se", item.x + item.w, item.y + item.h],
  ];

  return handles.map(([handle, x, y]) => (
    <rect
      className="floor-room__handle"
      key={handle}
      x={x - 6}
      y={y - 6}
      width="12"
      height="12"
      rx="1"
      onPointerDown={(event) => onResize(event, handle)}
    />
  ));
}

const FloorLayoutObject = memo(function FloorLayoutObject({ item, selected, onSelect, onResize }) {
  const type = layoutObjectTypeMap.get(item.kind) ?? layoutObjectTypeMap.get("space");
  const labelSize = item.w < 90 ? 12 : item.w < 170 ? 16 : 20;

  return (
    <g
      className={selected ? `floor-room floor-room--selected floor-object floor-object--${item.kind} floor-object--selected` : `floor-room floor-object floor-object--${item.kind}`}
      onPointerDown={(event) => onSelect(event, "layoutObject", item)}
      role="button"
      tabIndex="0"
      aria-label={`${item.name}, ${type.label}, ${item.shape === "round" ? "round" : "rectangular"}`}
    >
      <ItemShape className="floor-room__surface" item={item} fill={item.color ?? type.color} />
      <ItemShape className="floor-room__wall" item={item} />
      {item.w > 80 && item.h > 38 ? (
        <text className="floor-room__label" x={item.x + item.w / 2} y={item.y + item.h / 2 + labelSize / 3} fontSize={labelSize}>
          {item.name}
        </text>
      ) : null}
      {selected ? <ResizeHandles item={item} onResize={(event, handle) => onResize(event, "layoutObject", item, handle)} /> : null}
    </g>
  );
});

const FloorRoom = memo(function FloorRoom({ room, selected, onSelect, onResize }) {
  const labelSize = room.w < 150 ? 16 : room.w < 250 ? 20 : 25;
  const isRound = room.shape === "round";
  const clipId = `room-clip-${room.id}`;

  return (
    <g
      className={selected ? "floor-room floor-room--selected" : "floor-room"}
      onPointerDown={(event) => onSelect(event, "room", room)}
      role="button"
      tabIndex="0"
      aria-label={`${room.name}, ${isRound ? "round" : "rectangular"} room, ${room.facility}, tier ${room.tier}`}
    >
      {isRound ? <defs><clipPath id={clipId}><ItemShape item={room} inset={6} /></clipPath></defs> : null}
      <ItemShape className="floor-room__surface" item={room} fill={room.color} />
      {room.w > 90 && room.h > 80 ? <ItemShape className="floor-room__inner-line" item={room} inset={9} /> : null}
      <ItemShape className="floor-room__wall" item={room} />
      <g clipPath={isRound ? `url(#${clipId})` : undefined}><Furniture room={room} /></g>
      <path className="floor-room__door" d={`M${room.x + room.w * 0.44} ${room.y + room.h}h${room.w * 0.12}`} />
      <text className="floor-room__label" x={room.x + room.w / 2} y={room.y + room.h * 0.72} fontSize={labelSize}>
        {room.name}
      </text>
      {selected ? <ResizeHandles item={room} onResize={(event, handle) => onResize(event, "room", room, handle)} /> : null}
    </g>
  );
});

function ToolButton({ item, active, onClick, compact = false }) {
  return (
    <button
      className={active ? "tool-button tool-button--active" : "tool-button"}
      onClick={onClick}
      title={item.label}
      aria-pressed={active}
    >
      <Icon name={item.icon} size={19} />
      {compact ? null : <span>{item.label}</span>}
    </button>
  );
}

function InspectorField({ label, children, className = "" }) {
  return (
    <div className={`inspector-field ${className}`.trim()}>
      <span>{label}</span>
      <div>{children}</div>
    </div>
  );
}

export function PlanEditor({ state, updateState, onToast }) {
  const rooms = state.rooms ?? EMPTY_ARRAY;
  const layoutObjects = state.layoutObjects ?? EMPTY_ARRAY;
  const floors = useMemo(() => sortFloors(state.floors?.length ? state.floors : [{ id: DEFAULT_FLOOR_ID, name: "Ground Floor", order: 0 }]), [state.floors]);
  const activeFloorId = floors.some((floor) => floor.id === state.activeFloorId) ? state.activeFloorId : floors[0]?.id ?? DEFAULT_FLOOR_ID;
  const activeFloor = floors.find((floor) => floor.id === activeFloorId) ?? floors[0];
  const planRooms = useMemo(() => rooms.filter((room) => !room.hidden && isOnFloor(room, activeFloorId)), [activeFloorId, rooms]);
  const planObjects = useMemo(() => layoutObjects.filter((item) => isOnFloor(item, activeFloorId)), [activeFloorId, layoutObjects]);
  const [selection, setSelection] = useState({ type: "room", id: "archive" });
  const [tool, setTool] = useState("select");
  const [zoom, setZoom] = useState(1);
  const [editing, setEditing] = useState(false);
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [interaction, setInteraction] = useState(null);
  const svgRef = useRef(null);

  const selectedRoom = useMemo(
    () => (selection?.type === "room" ? rooms.find((room) => room.id === selection.id) ?? null : null),
    [rooms, selection],
  );
  const selectedLayoutObject = useMemo(
    () => (selection?.type === "layoutObject" ? layoutObjects.find((item) => item.id === selection.id) ?? null : null),
    [layoutObjects, selection],
  );
  const selectedItem = selectedRoom ?? selectedLayoutObject;
  const selectedType = selectedRoom ? "room" : selectedLayoutObject ? "layoutObject" : null;
  const selectedFloorId = selectedItem ? getFloorId(selectedItem) : activeFloorId;
  const selectedCatalog = facilityCatalog.find((item) => item.name === selectedRoom?.facility);
  const maxTier = selectedCatalog?.maxTier ?? 4;

  const currentSnapshot = useMemo(
    () => ({ rooms, layoutObjects, floors, activeFloorId }),
    [activeFloorId, floors, layoutObjects, rooms],
  );

  const applyPlanPatch = useCallback(
    (patch) => {
      updateState((current) => ({ ...current, ...patch }));
    },
    [updateState],
  );

  const commitPlanPatch = useCallback(
    (patch) => {
      setPast((current) => [...current.slice(-29), currentSnapshot]);
      setFuture([]);
      applyPlanPatch(patch);
    },
    [applyPlanPatch, currentSnapshot],
  );

  useEffect(() => {
    if (state.activeFloorId === activeFloorId) return;
    applyPlanPatch({ activeFloorId });
  }, [activeFloorId, applyPlanPatch, state.activeFloorId]);

  useEffect(() => {
    const selectionIsVisible =
      selection?.type === "room"
        ? planRooms.some((room) => room.id === selection.id)
        : selection?.type === "layoutObject"
          ? planObjects.some((item) => item.id === selection.id)
          : false;

    if (selectionIsVisible) return;
    setSelection(getFirstSelection(rooms, layoutObjects, activeFloorId));
  }, [activeFloorId, layoutObjects, planObjects, planRooms, rooms, selection]);

  const viewBox = useMemo(() => {
    const width = CANVAS_WIDTH / zoom;
    const height = CANVAS_HEIGHT / zoom;
    return {
      x: (CANVAS_WIDTH - width) / 2,
      y: (CANVAS_HEIGHT - height) / 2,
      width,
      height,
      string: `${(CANVAS_WIDTH - width) / 2} ${(CANVAS_HEIGHT - height) / 2} ${width} ${height}`,
    };
  }, [zoom]);

  const pointerToCanvas = useCallback(
    (event) => {
      const bounds = svgRef.current.getBoundingClientRect();
      return {
        x: viewBox.x + ((event.clientX - bounds.left) / bounds.width) * viewBox.width,
        y: viewBox.y + ((event.clientY - bounds.top) / bounds.height) * viewBox.height,
      };
    },
    [viewBox],
  );

  const beginMove = useCallback(
    (event, type, item) => {
      event.stopPropagation();
      setSelection({ type, id: item.id });
      if (tool !== "select") return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setInteraction({
        type: "move",
        itemType: type,
        itemId: item.id,
        start: pointerToCanvas(event),
        origin: item,
        startSnapshot: currentSnapshot,
      });
    },
    [currentSnapshot, pointerToCanvas, tool],
  );

  const beginResize = useCallback(
    (event, type, item, handle) => {
      event.stopPropagation();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setSelection({ type, id: item.id });
      setInteraction({
        type: "resize",
        itemType: type,
        itemId: item.id,
        handle,
        start: pointerToCanvas(event),
        origin: item,
        startSnapshot: currentSnapshot,
      });
    },
    [currentSnapshot, pointerToCanvas],
  );

  const handlePointerMove = useCallback(
    (event) => {
      if (!interaction) return;
      const point = pointerToCanvas(event);
      const dx = point.x - interaction.start.x;
      const dy = point.y - interaction.start.y;
      const origin = interaction.origin;
      const minSize = interaction.itemType === "room" ? MIN_ROOM_SIZE : MIN_LAYOUT_SIZE;
      let nextItem;

      if (interaction.type === "move") {
        nextItem = clampItemToCanvas({
          ...origin,
          x: origin.x + dx,
          y: origin.y + dy,
        }, minSize);
      } else {
        let x = origin.x;
        let y = origin.y;
        let w = origin.w;
        let h = origin.h;
        if (interaction.handle.includes("e")) w = Math.max(minSize, origin.w + dx);
        if (interaction.handle.includes("s")) h = Math.max(minSize, origin.h + dy);
        if (interaction.handle.includes("w")) {
          x = Math.min(origin.x + origin.w - minSize, origin.x + dx);
          w = origin.w + (origin.x - x);
        }
        if (interaction.handle.includes("n")) {
          y = Math.min(origin.y + origin.h - minSize, origin.y + dy);
          h = origin.h + (origin.y - y);
        }
        nextItem = clampItemToCanvas({ ...origin, x, y, w, h }, minSize);
      }

      if (interaction.itemType === "room") {
        applyPlanPatch({ rooms: rooms.map((room) => (room.id === interaction.itemId ? nextItem : room)) });
      } else {
        applyPlanPatch({ layoutObjects: layoutObjects.map((item) => (item.id === interaction.itemId ? nextItem : item)) });
      }
    },
    [applyPlanPatch, interaction, layoutObjects, pointerToCanvas, rooms],
  );

  const finishInteraction = useCallback(() => {
    if (!interaction) return;
    setPast((current) => [...current.slice(-29), interaction.startSnapshot]);
    setFuture([]);
    setInteraction(null);
  }, [interaction]);

  useEffect(() => {
    if (!interaction) return undefined;
    const end = () => finishInteraction();
    window.addEventListener("pointerup", end, { once: true });
    return () => window.removeEventListener("pointerup", end);
  }, [finishInteraction, interaction]);

  const addRoom = useCallback(
    (point = { x: 320, y: 260 }) => {
      const id = makeId("room");
      const room = clampItemToCanvas({
        id,
        name: "New room",
        facility: "Unassigned",
        tier: 0,
        status: "Planned",
        shape: "rect",
        floorId: activeFloorId,
        spaceType: "Operating space",
        visibility: "Members",
        skill: "—",
        capacity: 4,
        upkeep: 0,
        upgradeCost: 20,
        upgradeWeeks: 1,
        x: point.x - 90,
        y: point.y - 65,
        w: 180,
        h: 130,
        color: "#ece9e2",
      }, MIN_ROOM_SIZE);
      commitPlanPatch({ rooms: [...rooms, room] });
      setSelection({ type: "room", id });
      setTool("select");
      setEditing(true);
      onToast("Room added to the current floor");
    },
    [activeFloorId, commitPlanPatch, onToast, rooms],
  );

  const addLayoutObject = useCallback(
    (kind, point = { x: 340, y: 290 }) => {
      const template = layoutObjectTypeMap.get(kind) ?? layoutObjectTypeMap.get("space");
      const id = makeId(kind);
      const item = clampItemToCanvas({
        id,
        name: template.defaultName,
        kind: template.id,
        floorId: activeFloorId,
        shape: "rect",
        x: point.x - template.w / 2,
        y: point.y - template.h / 2,
        w: template.w,
        h: template.h,
        color: template.color,
      }, MIN_LAYOUT_SIZE);
      commitPlanPatch({ layoutObjects: [...layoutObjects, item] });
      setSelection({ type: "layoutObject", id });
      setTool("select");
      setEditing(true);
      onToast(`${template.label} added to the current floor`);
    },
    [activeFloorId, commitPlanPatch, layoutObjects, onToast],
  );

  const handleCanvasPointerDown = (event) => {
    if (tool === "add") addRoom(pointerToCanvas(event));
    if (tool === "space" || tool === "hallway") addLayoutObject(tool, pointerToCanvas(event));
  };

  const undo = () => {
    if (!past.length) return;
    const previous = past[past.length - 1];
    setFuture((current) => [currentSnapshot, ...current].slice(0, 30));
    setPast((current) => current.slice(0, -1));
    applyPlanPatch(previous);
  };

  const redo = () => {
    if (!future.length) return;
    const next = future[0];
    setPast((current) => [...current, currentSnapshot].slice(-30));
    setFuture((current) => current.slice(1));
    applyPlanPatch(next);
  };

  const updateRoom = useCallback(
    (patch) => {
      if (!selectedRoom) return;
      updateState((current) => ({
        ...current,
        rooms: current.rooms.map((room) => (room.id === selectedRoom.id ? { ...room, ...patch } : room)),
      }));
    },
    [selectedRoom, updateState],
  );

  const updateLayoutObject = useCallback(
    (patch) => {
      if (!selectedLayoutObject) return;
      updateState((current) => ({
        ...current,
        layoutObjects: (current.layoutObjects ?? []).map((item) => (item.id === selectedLayoutObject.id ? { ...item, ...patch } : item)),
      }));
    },
    [selectedLayoutObject, updateState],
  );

  const updateSelectedGeometry = (patch) => {
    if (!selectedItem) return;
    const minSize = selectedType === "room" ? MIN_ROOM_SIZE : MIN_LAYOUT_SIZE;
    const nextItem = clampItemToCanvas({ ...selectedItem, ...patch }, minSize);
    const geometry = { x: nextItem.x, y: nextItem.y, w: nextItem.w, h: nextItem.h };
    if (selectedType === "room") updateRoom(geometry);
    if (selectedType === "layoutObject") updateLayoutObject(geometry);
  };

  const moveSelectedToFloor = (floorId) => {
    if (!selectedItem || !selectedType) return;
    updateState((current) => {
      if (selectedType === "room") {
        return {
          ...current,
          activeFloorId: floorId,
          rooms: current.rooms.map((room) => (room.id === selectedItem.id ? { ...room, floorId } : room)),
        };
      }
      return {
        ...current,
        activeFloorId: floorId,
        layoutObjects: (current.layoutObjects ?? []).map((item) => (item.id === selectedItem.id ? { ...item, floorId } : item)),
      };
    });
  };

  const selectFacility = (facilityName) => {
    if (!selectedRoom) return;
    const facility = facilityCatalog.find((item) => item.name === facilityName);
    updateRoom({
      facility: facilityName,
      skill: facility?.skill ?? "—",
      tier: Math.max(selectedRoom.tier, facility?.startingTier ?? 0),
    });
  };

  const startUpgrade = () => {
    if (!selectedRoom) return;
    const projectId = `project-${Date.now()}`;
    updateState((current) => ({
      ...current,
      projects: [
        ...current.projects,
        {
          id: projectId,
          name: `${selectedRoom.name} tier ${selectedRoom.tier + 1}`,
          type: "Upgrade",
          roomId: selectedRoom.id,
          progress: 0,
          total: selectedRoom.upgradeWeeks,
          cost: selectedRoom.upgradeCost,
          owner: "Unassigned",
          status: "Planned",
        },
      ],
    }));
    onToast("Upgrade added to the downtime board");
  };

  const removeSelected = useCallback(() => {
    if (!selectedItem || !selectedType) return;

    if (selectedType === "room") {
      const nextRooms = rooms.filter((room) => room.id !== selectedItem.id);
      commitPlanPatch({ rooms: nextRooms });
      setSelection(getFirstSelection(nextRooms, layoutObjects, activeFloorId));
      onToast("Room removed");
      return;
    }

    const nextLayoutObjects = layoutObjects.filter((item) => item.id !== selectedItem.id);
    commitPlanPatch({ layoutObjects: nextLayoutObjects });
    setSelection(getFirstSelection(rooms, nextLayoutObjects, activeFloorId));
    onToast("Layout object removed");
  }, [activeFloorId, commitPlanPatch, layoutObjects, onToast, rooms, selectedItem, selectedType]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== "Delete") return;
      if (isTextEntryTarget(event.target)) return;
      if (!selectedItem) return;
      event.preventDefault();
      removeSelected();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [removeSelected, selectedItem]);

  const addFloor = () => {
    const id = makeId("floor");
    const nextFloors = [...floors, { id, name: `Floor ${floors.length + 1}`, order: floors.length }];
    commitPlanPatch({ floors: nextFloors, activeFloorId: id });
    setSelection(null);
    onToast("New floor added");
  };

  const activeFloorIsEmpty = !planRooms.length && !planObjects.length;
  const removeActiveFloor = () => {
    if (floors.length <= 1 || !activeFloorIsEmpty) return;
    const nextFloors = floors
      .filter((floor) => floor.id !== activeFloorId)
      .map((floor, index) => ({ ...floor, order: index }));
    const nextActiveFloorId = nextFloors[0]?.id ?? DEFAULT_FLOOR_ID;
    commitPlanPatch({ floors: nextFloors, activeFloorId: nextActiveFloorId });
    setSelection(getFirstSelection(rooms, layoutObjects, nextActiveFloorId));
    onToast("Empty floor removed");
  };

  const changeLayoutObjectKind = (kind) => {
    const template = layoutObjectTypeMap.get(kind) ?? layoutObjectTypeMap.get("space");
    updateLayoutObject({ kind, name: selectedLayoutObject?.name || template.defaultName, color: template.color });
  };

  const planArea = useMemo(
    () => Math.round([...planRooms, ...planObjects].reduce((sum, item) => sum + itemArea(item), 0) / 76.3),
    [planObjects, planRooms],
  );

  return (
    <div className="plan-editor">
      <div className="plan-editor__toolbar" aria-label="Floor plan tools">
        <div className="toolbar-group toolbar-group--tools">
          {toolItems.map((item) => (
            <ToolButton key={item.id} item={item} active={tool === item.id} onClick={() => setTool(item.id)} />
          ))}
        </div>
        <div className="toolbar-group toolbar-group--floors">
          <select className="tool-button floor-select" value={activeFloorId} onChange={(event) => applyPlanPatch({ activeFloorId: event.target.value })} aria-label="Choose floor">
            {floors.map((floor) => <option key={floor.id} value={floor.id}>{floor.name}</option>)}
          </select>
          <button className="tool-button tool-button--icon" onClick={addFloor} aria-label="Add floor">
            <Icon name="plus" size={18} />
          </button>
          <button
            className="tool-button tool-button--icon"
            onClick={removeActiveFloor}
            disabled={floors.length <= 1 || !activeFloorIsEmpty}
            title={activeFloorIsEmpty ? "Remove this empty floor" : "Delete or move objects before removing this floor"}
            aria-label="Remove empty floor"
          >
            <Icon name="trash" size={17} />
          </button>
        </div>
        <div className="toolbar-group">
          <button className="tool-button tool-button--icon" onClick={undo} disabled={!past.length} aria-label="Undo">
            <Icon name="undo" size={19} />
          </button>
          <button className="tool-button tool-button--icon" onClick={redo} disabled={!future.length} aria-label="Redo">
            <Icon name="redo" size={19} />
          </button>
        </div>
        <div className="toolbar-group toolbar-group--zoom">
          <button className="tool-button tool-button--icon" onClick={() => setZoom((value) => Math.max(0.65, value - 0.1))} aria-label="Zoom out">
            <Icon name="minus" size={18} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button className="tool-button tool-button--icon" onClick={() => setZoom((value) => Math.min(1.65, value + 0.1))} aria-label="Zoom in">
            <Icon name="plus" size={18} />
          </button>
        </div>
      </div>

      <div className="plan-editor__body">
        <main className="canvas-wrap">
          <svg
            className={tool !== "select" ? "floor-canvas floor-canvas--add" : "floor-canvas"}
            ref={svgRef}
            viewBox={viewBox.string}
            preserveAspectRatio="xMidYMin meet"
            onPointerMove={handlePointerMove}
            onPointerLeave={finishInteraction}
            aria-label={`Interactive stronghold floor plan, ${activeFloor?.name ?? "current floor"}`}
          >
            <defs>
              <pattern id="minor-grid" width="15" height="15" patternUnits="userSpaceOnUse">
                <path d="M15 0H0V15" fill="none" stroke="#d9d5cb" strokeWidth="0.7" />
              </pattern>
              <pattern id="major-grid" width="75" height="75" patternUnits="userSpaceOnUse">
                <rect width="75" height="75" fill="url(#minor-grid)" />
                <path d="M75 0H0V75" fill="none" stroke="#c8c2b7" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="#f7f4ee" onPointerDown={handleCanvasPointerDown} />
            <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="url(#major-grid)" pointerEvents="none" />
            <g className="north-mark" transform="translate(24 28)">
              <text x="0" y="0">N</text>
              <path d="m0 8-6 12h12z" />
            </g>
            {planObjects.map((item) => (
              <FloorLayoutObject
                key={item.id}
                item={item}
                selected={selection?.type === "layoutObject" && item.id === selection.id}
                onSelect={beginMove}
                onResize={beginResize}
              />
            ))}
            {planRooms.map((room) => (
              <FloorRoom
                key={room.id}
                room={room}
                selected={selection?.type === "room" && room.id === selection.id}
                onSelect={beginMove}
                onResize={beginResize}
              />
            ))}
          </svg>
          {tool === "add" ? <div className="canvas-hint">Click anywhere to place a room</div> : null}
          {tool === "space" ? <div className="canvas-hint">Click anywhere to place an operating space</div> : null}
          {tool === "hallway" ? <div className="canvas-hint">Click anywhere to place a hallway</div> : null}
        </main>

        {selectedItem ? (
          <aside className="inspector">
            <div className="inspector__grabber" />
            <div className="inspector__header">
              <div>
                {editing ? (
                  <input
                    className="inspector__title-input"
                    value={selectedItem.name}
                    onChange={(event) => (selectedType === "room" ? updateRoom({ name: event.target.value }) : updateLayoutObject({ name: event.target.value }))}
                    aria-label="Selected object name"
                  />
                ) : (
                  <h2>{selectedItem.name}</h2>
                )}
                {selectedRoom ? <p>{selectedRoom.facility} · Tier {selectedRoom.tier}</p> : <p>{layoutObjectTypeMap.get(selectedLayoutObject.kind)?.label ?? "Layout object"} · {activeFloor?.name}</p>}
              </div>
              <div className="inspector__header-actions">
                <button className="button button--secondary" onClick={() => setEditing((value) => !value)}>
                  <Icon name="edit" size={17} />
                  {editing ? "Done" : `Edit ${selectedType === "room" ? "room" : "object"}`}
                </button>
                <button className="icon-button" onClick={() => setEditing(false)} aria-label="Close editing"><Icon name="close" size={19} /></button>
              </div>
            </div>
            <div className="inspector__tags">
              {selectedRoom ? (
                <>
                  <span className={`status-tag status-tag--${selectedRoom.status.toLowerCase().replace(/\s+/g, "-")}`}>{selectedRoom.status}</span>
                  <span className="status-tag status-tag--neutral">{selectedRoom.visibility}</span>
                </>
              ) : (
                <>
                  <span className="status-tag status-tag--neutral">{layoutObjectTypeMap.get(selectedLayoutObject.kind)?.label ?? "Layout object"}</span>
                  <span className="status-tag status-tag--neutral">{floors.find((floor) => floor.id === selectedFloorId)?.name ?? "Floor"}</span>
                </>
              )}
            </div>
            <div className="inspector__fields">
              <InspectorField label="Floor">
                <select value={selectedFloorId} onChange={(event) => moveSelectedToFloor(event.target.value)} disabled={!editing} aria-label="Selected object floor">
                  {floors.map((floor) => <option key={floor.id} value={floor.id}>{floor.name}</option>)}
                </select>
              </InspectorField>
              {selectedRoom ? (
                <>
                  <InspectorField label="Facility">
                    <select value={selectedRoom.facility} onChange={(event) => selectFacility(event.target.value)} disabled={!editing}>
                      <option>Unassigned</option>
                      {facilityCatalog.map((item) => <option key={item.id}>{item.name}</option>)}
                    </select>
                  </InspectorField>
                  <InspectorField label="Space use">
                    <select value={selectedRoom.spaceType ?? "Operating space"} onChange={(event) => updateRoom({ spaceType: event.target.value })} disabled={!editing} aria-label="Room space type">
                      {roomSpaceOptions.map((type) => <option key={type}>{type}</option>)}
                    </select>
                  </InspectorField>
                  <InspectorField label="Shape">
                    <select value={selectedRoom.shape ?? "rect"} onChange={(event) => updateRoom({ shape: event.target.value })} disabled={!editing} aria-label="Room shape">
                      <option value="rect">Rectangle</option>
                      <option value="round">Round / oval</option>
                    </select>
                  </InspectorField>
                  <InspectorField label="Status">
                    <select value={selectedRoom.status} onChange={(event) => updateRoom({ status: event.target.value })} disabled={!editing} aria-label="Room status">
                      {roomStatusOptions.map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </InspectorField>
                </>
              ) : (
                <>
                  <InspectorField label="Object type">
                    <select value={selectedLayoutObject.kind} onChange={(event) => changeLayoutObjectKind(event.target.value)} disabled={!editing} aria-label="Layout object type">
                      {layoutObjectTypes.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
                    </select>
                  </InspectorField>
                  <InspectorField label="Shape">
                    <select value={selectedLayoutObject.shape ?? "rect"} onChange={(event) => updateLayoutObject({ shape: event.target.value })} disabled={!editing} aria-label="Layout object shape">
                      <option value="rect">Rectangle</option>
                      <option value="round">Round / oval</option>
                    </select>
                  </InspectorField>
                </>
              )}
              <InspectorField label="Size">
                <div className="dimension-pair">
                  <input type="number" min={selectedType === "room" ? MIN_ROOM_SIZE : MIN_LAYOUT_SIZE} value={selectedItem.w} onChange={(event) => updateSelectedGeometry({ w: Number(event.target.value) })} disabled={!editing} aria-label="Selected object width" />
                  <input type="number" min={selectedType === "room" ? MIN_ROOM_SIZE : MIN_LAYOUT_SIZE} value={selectedItem.h} onChange={(event) => updateSelectedGeometry({ h: Number(event.target.value) })} disabled={!editing} aria-label="Selected object depth" />
                </div>
              </InspectorField>
              {selectedRoom ? (
                <>
                  <InspectorField label="Associated skill" className="inspector-field--mobile">
                    <strong>{selectedRoom.skill}</strong>
                  </InspectorField>
                  <InspectorField label="Capacity">
                    <input type="number" min="0" value={selectedRoom.capacity} onChange={(event) => updateRoom({ capacity: Number(event.target.value) })} disabled={!editing} />
                  </InspectorField>
                  <InspectorField label="Tier">
                    <div className="stepper">
                      <button onClick={() => updateRoom({ tier: Math.max(0, selectedRoom.tier - 1) })} disabled={!editing || selectedRoom.tier <= 0}><Icon name="minus" size={14} /></button>
                      <strong>{selectedRoom.tier}</strong>
                      <button onClick={() => updateRoom({ tier: Math.min(maxTier, selectedRoom.tier + 1) })} disabled={!editing || selectedRoom.tier >= maxTier}><Icon name="plus" size={14} /></button>
                    </div>
                  </InspectorField>
                  <InspectorField label="Upkeep">
                    <span>{selectedRoom.upkeep} gp / week</span>
                  </InspectorField>
                  <InspectorField label="Upgrade" className="inspector-field--mobile">
                    <span>{selectedRoom.upgradeCost} gp · {selectedRoom.upgradeWeeks} {selectedRoom.upgradeWeeks === 1 ? "week" : "weeks"}</span>
                  </InspectorField>
                  <InspectorField label="Dependency">
                    <span>{selectedCatalog?.dependsOn ?? "None"}</span>
                  </InspectorField>
                  <InspectorField label="Linked bonus">
                    <span>{selectedRoom.tier >= 3 ? "Assistive resources +2" : selectedRoom.tier >= 1 ? "Assistive resources +1" : "Not unlocked"}</span>
                  </InspectorField>
                </>
              ) : null}
            </div>
            <div className="inspector__actions">
              {selectedRoom ? (
                <button className="button button--primary" onClick={startUpgrade} disabled={selectedRoom.tier >= maxTier}>
                  <Icon name="upgrade" size={17} />
                  {selectedRoom.tier >= maxTier ? "Maximum tier" : "Start upgrade"}
                </button>
              ) : null}
              {editing ? (
                <button className="button button--danger-link" onClick={removeSelected}>
                  <Icon name="trash" size={16} /> Remove {selectedType === "room" ? "room" : "object"}
                </button>
              ) : null}
              <p className="inspector__hint">Tip: select a room, hallway, or space and press Delete to remove it.</p>
            </div>
            <div className="layers">
              <div className="layers__header">
                <strong>{activeFloor?.name ?? "Current floor"}</strong>
                <button className="icon-button" onClick={() => addRoom()} aria-label="Add room"><Icon name="plus" size={18} /></button>
              </div>
              <div className="layers__list">
                {planRooms.map((room) => (
                  <button className={selection?.type === "room" && room.id === selection.id ? "layer-row layer-row--active" : "layer-row"} key={room.id} onClick={() => setSelection({ type: "room", id: room.id })}>
                    <Icon name="plan" size={16} />
                    <span>{room.name}</span>
                    <Icon name="lock" size={14} />
                  </button>
                ))}
                {planObjects.map((item) => (
                  <button className={selection?.type === "layoutObject" && item.id === selection.id ? "layer-row layer-row--active" : "layer-row"} key={item.id} onClick={() => setSelection({ type: "layoutObject", id: item.id })}>
                    <Icon name={item.kind === "hallway" ? "wall" : "plan"} size={16} />
                    <span>{item.name}</span>
                    <Icon name="lock" size={14} />
                  </button>
                ))}
                {!planRooms.length && !planObjects.length ? <p className="layers__empty">This floor is empty. Add a room, space, or hallway.</p> : null}
              </div>
            </div>
          </aside>
        ) : (
          <aside className="inspector inspector--empty">
            <div className="inspector__grabber" />
            <div className="inspector__header">
              <div>
                <h2>{activeFloor?.name ?? "Current floor"}</h2>
                <p>No objects on this floor yet.</p>
              </div>
            </div>
            <div className="inspector__actions">
              <button className="button button--primary" onClick={() => addRoom()}><Icon name="plus" size={17} /> Add room</button>
              <button className="button button--secondary" onClick={() => addLayoutObject("space")}><Icon name="plan" size={17} /> Add operating space</button>
              <button className="button button--secondary" onClick={() => addLayoutObject("hallway")}><Icon name="wall" size={17} /> Add hallway</button>
            </div>
          </aside>
        )}
      </div>
      <footer className="plan-status">
        <span className="plan-status__ok"><Icon name="check" size={14} /></span>
        <span>{activeFloor?.name ?? "Current floor"}</span>
        <span>·</span>
        <span>{planRooms.length} rooms</span>
        <span>·</span>
        <span>{planObjects.length} layout objects</span>
        <span>·</span>
        <span>{planArea.toLocaleString()} sq ft</span>
        <span>·</span>
        <span className="plan-status__saved">Autosaved</span>
      </footer>
    </div>
  );
}
