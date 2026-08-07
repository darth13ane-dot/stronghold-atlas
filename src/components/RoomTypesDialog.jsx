import { useState } from "react";
import { facilityCatalog } from "../data/rules";
import {
  DEFAULT_POLYGON_POINTS,
  DEFAULT_ROOM_TYPE,
  makeId,
  normalizeRoomType,
  ROOM_SPACE_OPTIONS,
  ROOM_STATUS_OPTIONS,
  ROOM_VISIBILITY_OPTIONS,
  roomTypeFromRoom,
} from "../data/rooms";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import "./RoomTypesDialog.css";

function createDraft(room = null) {
  if (room) {
    return roomTypeFromRoom(room, {
      id: makeId("room-type"),
      name: `${room.name} type`,
    });
  }
  return normalizeRoomType({
    ...DEFAULT_ROOM_TYPE,
    id: makeId("room-type"),
    name: "Custom room",
  });
}

function NumberField({ label, value, min = 0, max, onChange }) {
  return (
    <label>
      <span>{label}</span>
      <input type="number" min={min} max={max} step="1" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function roomTypeSwatchStyle(roomType) {
  if (roomType.shape === "round") {
    return { "--room-type-color": roomType.color, borderRadius: "50%" };
  }
  if (roomType.shape === "polygon") {
    const points = roomType.points ?? DEFAULT_POLYGON_POINTS;
    return {
      "--room-type-color": roomType.color,
      clipPath: `polygon(${points.map((point) => `${point.x * 100}% ${point.y * 100}%`).join(", ")})`,
    };
  }
  return { "--room-type-color": roomType.color };
}

export function RoomTypesDialog({
  roomTypes,
  selectedRoom,
  activeFloorName,
  onSave,
  onDelete,
  onPlace,
  onClose,
}) {
  const [draft, setDraft] = useState(() => roomTypes[0] ?? createDraft(selectedRoom));
  const [isNew, setIsNew] = useState(!roomTypes.length);
  const facility = facilityCatalog.find((item) => item.name === draft.facility);
  const maxTier = facility?.maxTier ?? 4;
  const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const setShape = (shape) => setDraft((current) => ({
    ...current,
    shape,
    ...(shape === "polygon" && !current.points ? { points: DEFAULT_POLYGON_POINTS.map((point) => ({ ...point })) } : {}),
  }));

  const selectType = (roomType) => {
    setDraft(roomType);
    setIsNew(false);
  };

  const startNew = (sourceRoom = null) => {
    setDraft(createDraft(sourceRoom));
    setIsNew(true);
  };

  const save = () => {
    const roomType = normalizeRoomType(draft);
    onSave(roomType);
    setDraft(roomType);
    setIsNew(false);
    return roomType;
  };

  const submit = (event) => {
    event.preventDefault();
    save();
  };

  const place = () => {
    const roomType = save();
    onPlace(roomType);
  };

  const remove = () => {
    if (!window.confirm(`Delete the "${draft.name}" room type? Existing rooms will stay on the plan.`)) return;
    onDelete(draft.id);
    const remaining = roomTypes.filter((item) => item.id !== draft.id);
    if (remaining.length) {
      selectType(remaining[0]);
    } else {
      startNew();
    }
  };

  return (
    <Modal title="Room types" className="modal--room-types" onClose={onClose}>
      <div className="room-types-dialog">
        <header className="room-types-dialog__intro">
          <p>Save reusable room defaults, then place copies on any floor.</p>
          <div>
            {selectedRoom ? (
              <button type="button" className="button button--secondary" onClick={() => startNew(selectedRoom)}>
                <Icon name="copy" size={16} /> From selected room
              </button>
            ) : null}
            <button type="button" className="button button--secondary" onClick={() => startNew()}>
              <Icon name="plus" size={16} /> New type
            </button>
          </div>
        </header>

        <div className="room-types-dialog__layout">
          <nav className="room-type-list" aria-label="Saved room types">
            {roomTypes.map((roomType) => (
              <button
                type="button"
                className={!isNew && draft.id === roomType.id ? "room-type-card room-type-card--active" : "room-type-card"}
                key={roomType.id}
                onClick={() => selectType(roomType)}
              >
                <span className="room-type-card__swatch" style={roomTypeSwatchStyle(roomType)} />
                <span><strong>{roomType.name}</strong><small>{roomType.facility}</small></span>
                <Icon name="chevron" size={15} />
              </button>
            ))}
            {!roomTypes.length ? <p>No saved types yet. Create the first one here.</p> : null}
          </nav>

          <form className="room-type-editor" onSubmit={submit}>
            <div className="room-type-editor__grid">
              <label>
                <span>Type name</span>
                <input required value={draft.name} onChange={(event) => set("name", event.target.value)} />
              </label>
              <label>
                <span>Facility</span>
                <select value={draft.facility} onChange={(event) => set("facility", event.target.value)}>
                  <option>Unassigned</option>
                  {facilityCatalog.map((item) => <option key={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label>
                <span>Space use</span>
                <select value={draft.spaceType} onChange={(event) => set("spaceType", event.target.value)}>
                  {ROOM_SPACE_OPTIONS.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label>
                <span>Shape</span>
                <select value={draft.shape} onChange={(event) => setShape(event.target.value)}>
                  <option value="rect">Rectangle</option>
                  <option value="round">Round / oval</option>
                  <option value="polygon">Custom polygon</option>
                </select>
              </label>
              {draft.shape === "polygon" ? (
                <p className="room-type-editor__shape-note">
                  This type keeps its custom outline. Draw a room with the Custom shape tool, then use <strong>From selected room</strong> to reuse an exact outline.
                </p>
              ) : null}
              <label>
                <span>Default status</span>
                <select value={draft.status} onChange={(event) => set("status", event.target.value)}>
                  {ROOM_STATUS_OPTIONS.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label>
                <span>Visibility</span>
                <select value={draft.visibility} onChange={(event) => set("visibility", event.target.value)}>
                  {ROOM_VISIBILITY_OPTIONS.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <NumberField label="Starting tier" min={0} max={maxTier} value={Math.min(draft.tier, maxTier)} onChange={(value) => set("tier", Math.min(maxTier, value))} />
              <NumberField label="Capacity" value={draft.capacity} onChange={(value) => set("capacity", value)} />
              <NumberField label="Weekly upkeep (gp)" value={draft.upkeep} onChange={(value) => set("upkeep", value)} />
              <label>
                <span>Color</span>
                <span className="room-type-color">
                  <input type="color" value={draft.color} onChange={(event) => set("color", event.target.value)} />
                  <code>{draft.color}</code>
                </span>
              </label>
              <NumberField label="Default width" min={70} value={draft.w} onChange={(value) => set("w", value)} />
              <NumberField label="Default depth" min={70} value={draft.h} onChange={(value) => set("h", value)} />
            </div>

            <footer className="room-type-editor__actions">
              {!isNew ? (
                <button type="button" className="button button--danger-link" onClick={remove}>
                  <Icon name="trash" size={16} /> Delete type
                </button>
              ) : <span />}
              <button type="submit" className="button button--secondary">Save type</button>
              <button type="button" className="button button--primary" onClick={place}>
                <Icon name="add" size={16} /> Choose location on {activeFloorName}
              </button>
            </footer>
          </form>
        </div>
      </div>
    </Modal>
  );
}
