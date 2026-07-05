import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { facilityCatalog } from "../data/rules";
import { Icon } from "./Icon";

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 850;
const MIN_ROOM_SIZE = 70;

const toolItems = [
  { id: "select", label: "Select", icon: "select" },
  { id: "add", label: "Add room", icon: "add" },
  { id: "wall", label: "Wall", icon: "wall" },
  { id: "door", label: "Door", icon: "door" },
  { id: "text", label: "Text", icon: "text" },
];

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

const FloorRoom = memo(function FloorRoom({ room, selected, onSelect, onResize }) {
  const labelSize = room.w < 150 ? 16 : room.w < 250 ? 20 : 25;
  const handles = [
    ["nw", room.x, room.y],
    ["ne", room.x + room.w, room.y],
    ["sw", room.x, room.y + room.h],
    ["se", room.x + room.w, room.y + room.h],
  ];

  return (
    <g
      className={selected ? "floor-room floor-room--selected" : "floor-room"}
      onPointerDown={(event) => onSelect(event, room)}
      role="button"
      tabIndex="0"
      aria-label={`${room.name}, ${room.facility}, tier ${room.tier}`}
    >
      <rect className="floor-room__surface" x={room.x} y={room.y} width={room.w} height={room.h} fill={room.color} />
      {room.w > 90 && room.h > 80 ? <rect className="floor-room__inner-line" x={room.x + 9} y={room.y + 9} width={room.w - 18} height={room.h - 18} /> : null}
      <rect className="floor-room__wall" x={room.x} y={room.y} width={room.w} height={room.h} />
      <Furniture room={room} />
      <path className="floor-room__door" d={`M${room.x + room.w * 0.44} ${room.y + room.h}h${room.w * 0.12}`} />
      <text className="floor-room__label" x={room.x + room.w / 2} y={room.y + room.h * 0.72} fontSize={labelSize}>
        {room.name}
      </text>
      {selected
        ? handles.map(([handle, x, y]) => (
            <rect
              className="floor-room__handle"
              key={handle}
              x={x - 6}
              y={y - 6}
              width="12"
              height="12"
              rx="1"
              onPointerDown={(event) => onResize(event, room, handle)}
            />
          ))
        : null}
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

function InspectorField({ label, children }) {
  return (
    <div className="inspector-field">
      <span>{label}</span>
      <div>{children}</div>
    </div>
  );
}

export function PlanEditor({ state, updateState, onToast }) {
  const rooms = state.rooms;
  const planRooms = useMemo(() => rooms.filter((room) => !room.hidden), [rooms]);
  const [selectedId, setSelectedId] = useState("archive");
  const [tool, setTool] = useState("select");
  const [zoom, setZoom] = useState(1);
  const [editing, setEditing] = useState(false);
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [interaction, setInteraction] = useState(null);
  const svgRef = useRef(null);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedId) ?? rooms[0],
    [rooms, selectedId],
  );

  const setRooms = useCallback(
    (nextRooms) => {
      updateState((current) => ({ ...current, rooms: nextRooms }));
    },
    [updateState],
  );

  const commitRooms = useCallback(
    (nextRooms) => {
      setPast((current) => [...current.slice(-29), rooms]);
      setFuture([]);
      setRooms(nextRooms);
    },
    [rooms, setRooms],
  );

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
    (event, room) => {
      event.stopPropagation();
      setSelectedId(room.id);
      if (tool !== "select") return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setInteraction({
        type: "move",
        roomId: room.id,
        start: pointerToCanvas(event),
        origin: room,
        startRooms: rooms,
      });
    },
    [pointerToCanvas, rooms, tool],
  );

  const beginResize = useCallback(
    (event, room, handle) => {
      event.stopPropagation();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setInteraction({
        type: "resize",
        roomId: room.id,
        handle,
        start: pointerToCanvas(event),
        origin: room,
        startRooms: rooms,
      });
    },
    [pointerToCanvas, rooms],
  );

  const handlePointerMove = useCallback(
    (event) => {
      if (!interaction) return;
      const point = pointerToCanvas(event);
      const dx = point.x - interaction.start.x;
      const dy = point.y - interaction.start.y;
      const origin = interaction.origin;
      let nextRoom;

      if (interaction.type === "move") {
        nextRoom = {
          ...origin,
          x: Math.round(Math.max(0, Math.min(CANVAS_WIDTH - origin.w, origin.x + dx)) / 5) * 5,
          y: Math.round(Math.max(0, Math.min(CANVAS_HEIGHT - origin.h, origin.y + dy)) / 5) * 5,
        };
      } else {
        let x = origin.x;
        let y = origin.y;
        let w = origin.w;
        let h = origin.h;
        if (interaction.handle.includes("e")) w = Math.max(MIN_ROOM_SIZE, origin.w + dx);
        if (interaction.handle.includes("s")) h = Math.max(MIN_ROOM_SIZE, origin.h + dy);
        if (interaction.handle.includes("w")) {
          x = Math.min(origin.x + origin.w - MIN_ROOM_SIZE, origin.x + dx);
          w = origin.w + (origin.x - x);
        }
        if (interaction.handle.includes("n")) {
          y = Math.min(origin.y + origin.h - MIN_ROOM_SIZE, origin.y + dy);
          h = origin.h + (origin.y - y);
        }
        nextRoom = { ...origin, x: Math.round(x / 5) * 5, y: Math.round(y / 5) * 5, w: Math.round(w / 5) * 5, h: Math.round(h / 5) * 5 };
      }

      setRooms(rooms.map((room) => (room.id === interaction.roomId ? nextRoom : room)));
    },
    [interaction, pointerToCanvas, rooms, setRooms],
  );

  const finishInteraction = useCallback(() => {
    if (!interaction) return;
    setPast((current) => [...current.slice(-29), interaction.startRooms]);
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
      const id = `room-${Date.now()}`;
      const room = {
        id,
        name: "New room",
        facility: "Unassigned",
        tier: 0,
        status: "Planned",
        visibility: "Members",
        skill: "—",
        capacity: 4,
        upkeep: 0,
        upgradeCost: 20,
        upgradeWeeks: 1,
        x: Math.max(0, Math.min(CANVAS_WIDTH - 180, Math.round((point.x - 90) / 5) * 5)),
        y: Math.max(0, Math.min(CANVAS_HEIGHT - 130, Math.round((point.y - 65) / 5) * 5)),
        w: 180,
        h: 130,
        color: "#ece9e2",
      };
      commitRooms([...rooms, room]);
      setSelectedId(id);
      setTool("select");
      setEditing(true);
      onToast("Room added to the plan");
    },
    [commitRooms, onToast, rooms],
  );

  const handleCanvasPointerDown = (event) => {
    if (tool === "add") addRoom(pointerToCanvas(event));
  };

  const undo = () => {
    if (!past.length) return;
    const previous = past[past.length - 1];
    setFuture((current) => [rooms, ...current].slice(0, 30));
    setPast((current) => current.slice(0, -1));
    setRooms(previous);
  };

  const redo = () => {
    if (!future.length) return;
    const next = future[0];
    setPast((current) => [...current, rooms].slice(-30));
    setFuture((current) => current.slice(1));
    setRooms(next);
  };

  const updateRoom = (patch) => {
    setRooms(rooms.map((room) => (room.id === selectedRoom.id ? { ...room, ...patch } : room)));
  };

  const startUpgrade = () => {
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

  const removeRoom = () => {
    if (rooms.length <= 1) return;
    const next = rooms.filter((room) => room.id !== selectedRoom.id);
    commitRooms(next);
    setSelectedId(next[0].id);
    onToast("Room removed");
  };

  const selectFacility = (facilityName) => {
    const facility = facilityCatalog.find((item) => item.name === facilityName);
    updateRoom({
      facility: facilityName,
      skill: facility?.skill ?? "—",
      tier: Math.max(selectedRoom.tier, facility?.startingTier ?? 0),
    });
  };

  const selectedCatalog = facilityCatalog.find((item) => item.name === selectedRoom?.facility);
  const maxTier = selectedCatalog?.maxTier ?? 4;
  const planArea = useMemo(() => Math.round(planRooms.reduce((sum, room) => sum + room.w * room.h, 0) / 76.3), [planRooms]);

  return (
    <div className="plan-editor">
      <div className="plan-editor__toolbar" aria-label="Floor plan tools">
        <div className="toolbar-group toolbar-group--tools">
          {toolItems.map((item) => (
            <ToolButton key={item.id} item={item} active={tool === item.id} onClick={() => (item.id === "add" ? setTool("add") : setTool(item.id))} />
          ))}
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
            className={tool === "add" ? "floor-canvas floor-canvas--add" : "floor-canvas"}
            ref={svgRef}
            viewBox={viewBox.string}
            preserveAspectRatio="xMidYMin meet"
            onPointerMove={handlePointerMove}
            onPointerLeave={finishInteraction}
            aria-label="Interactive stronghold floor plan"
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
            <g className="floor-connectors">
              <rect x="430" y="135" width="45" height="50" />
              <rect x="255" y="275" width="50" height="45" />
              <rect x="600" y="275" width="50" height="45" />
              <rect x="430" y="405" width="45" height="50" />
              <rect x="255" y="545" width="50" height="45" />
              <rect x="600" y="545" width="50" height="45" />
              <rect x="430" y="660" width="85" height="45" />
            </g>
            {planRooms.map((room) => (
              <FloorRoom
                key={room.id}
                room={room}
                selected={room.id === selectedRoom?.id}
                onSelect={beginMove}
                onResize={beginResize}
              />
            ))}
          </svg>
          {tool === "add" ? <div className="canvas-hint">Click anywhere to place a room</div> : null}
        </main>

        {selectedRoom ? (
          <aside className="inspector">
            <div className="inspector__grabber" />
            <div className="inspector__header">
              <div>
                {editing ? (
                  <input className="inspector__title-input" value={selectedRoom.name} onChange={(event) => updateRoom({ name: event.target.value })} aria-label="Room name" />
                ) : (
                  <h2>{selectedRoom.name}</h2>
                )}
                <p>{selectedRoom.facility} · Tier {selectedRoom.tier}</p>
              </div>
              <button className="icon-button" onClick={() => setEditing(false)} aria-label="Close editing">
                <Icon name="close" size={19} />
              </button>
            </div>
            <div className="inspector__tags">
              <span className={`status-tag status-tag--${selectedRoom.status.toLowerCase()}`}>{selectedRoom.status}</span>
              <span className="status-tag status-tag--neutral">{selectedRoom.visibility}</span>
            </div>
            <div className="inspector__fields">
              <InspectorField label="Facility">
                <select value={selectedRoom.facility} onChange={(event) => selectFacility(event.target.value)} disabled={!editing}>
                  <option>Unassigned</option>
                  {facilityCatalog.map((item) => <option key={item.id}>{item.name}</option>)}
                </select>
              </InspectorField>
              <InspectorField label="Associated skill">
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
              <InspectorField label="Upgrade">
                <span>{selectedRoom.upgradeCost} gp · {selectedRoom.upgradeWeeks} {selectedRoom.upgradeWeeks === 1 ? "week" : "weeks"}</span>
              </InspectorField>
              <InspectorField label="Dependency">
                <span>{selectedCatalog?.dependsOn ?? "None"}</span>
              </InspectorField>
              <InspectorField label="Linked bonus">
                <span>{selectedRoom.tier >= 3 ? "Assistive resources +2" : selectedRoom.tier >= 1 ? "Assistive resources +1" : "Not unlocked"}</span>
              </InspectorField>
            </div>
            <div className="inspector__actions">
              <button className="button button--secondary" onClick={() => setEditing((value) => !value)}>
                <Icon name="edit" size={17} />
                {editing ? "Finish editing" : "Edit room"}
              </button>
              <button className="button button--primary" onClick={startUpgrade} disabled={selectedRoom.tier >= maxTier}>
                <Icon name="upgrade" size={17} />
                {selectedRoom.tier >= maxTier ? "Maximum tier" : "Start upgrade"}
              </button>
              {editing ? (
                <button className="button button--danger-link" onClick={removeRoom}>
                  <Icon name="trash" size={16} /> Remove room
                </button>
              ) : null}
            </div>
            <div className="layers">
              <div className="layers__header">
                <strong>Layers</strong>
                <button className="icon-button" onClick={() => addRoom()} aria-label="Add room"><Icon name="plus" size={18} /></button>
              </div>
              <div className="layers__list">
                {planRooms.map((room) => (
                  <button className={room.id === selectedRoom.id ? "layer-row layer-row--active" : "layer-row"} key={room.id} onClick={() => setSelectedId(room.id)}>
                    <Icon name="eye" size={16} />
                    <span>{room.name}</span>
                    <Icon name="lock" size={14} />
                  </button>
                ))}
              </div>
            </div>
          </aside>
        ) : null}
      </div>
      <footer className="plan-status">
        <span className="plan-status__ok"><Icon name="check" size={14} /></span>
        <span>{rooms.length} rooms</span>
        <span>·</span>
        <span>{planArea.toLocaleString()} sq ft</span>
        <span>·</span>
        <span className="plan-status__saved">Autosaved</span>
      </footer>
    </div>
  );
}
