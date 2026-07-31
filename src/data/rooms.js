import { facilityCatalog, tierCosts } from "./rules";

export const ROOM_STATUS_OPTIONS = ["Operational", "Needs repair", "Under repair", "Restricted", "Planned"];
export const ROOM_SPACE_OPTIONS = ["Operating space", "Common area", "Support space", "Private quarters", "Defensive space", "Storage", "Exterior", "Other"];
export const ROOM_VISIBILITY_OPTIONS = ["Public", "Members", "Private", "Restricted"];

const DEFAULT_COLOR = "#ece9e2";
const DEFAULT_FLOOR_ID = "ground";

export const DEFAULT_ROOM_TYPE = Object.freeze({
  id: "room-type-default",
  name: "New room",
  facility: "Unassigned",
  tier: 0,
  status: "Planned",
  shape: "rect",
  spaceType: "Operating space",
  visibility: "Members",
  skill: "—",
  capacity: 4,
  upkeep: 0,
  upgradeCost: 20,
  upgradeWeeks: 1,
  w: 180,
  h: 130,
  color: DEFAULT_COLOR,
});

export function makeId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1000)}`;
}

function toInteger(value, fallback, minimum = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.round(number)) : fallback;
}

export function getRoomUpgrade(tier, maxTier = 4) {
  const currentTier = toInteger(tier, 0);
  if (currentTier >= maxTier) return { upgradeCost: 0, upgradeWeeks: 0 };
  const nextTier = tierCosts.find((item) => item.tier === currentTier + 1);
  return {
    upgradeCost: nextTier?.cost ?? 0,
    upgradeWeeks: nextTier?.weeks ?? 0,
  };
}

export function normalizeRoomType(value = {}, index = 0) {
  const facility = facilityCatalog.find((item) => item.name === value.facility);
  const tier = Math.min(
    facility?.maxTier ?? 4,
    toInteger(value.tier, facility?.startingTier ?? DEFAULT_ROOM_TYPE.tier),
  );
  const upgrade = getRoomUpgrade(tier, facility?.maxTier ?? 4);
  const color = /^#[0-9a-f]{6}$/i.test(value.color ?? "") ? value.color : DEFAULT_COLOR;

  return {
    id: value.id || `room-type-${index + 1}`,
    name: String(value.name ?? "").trim() || DEFAULT_ROOM_TYPE.name,
    facility: facility?.name ?? "Unassigned",
    tier,
    status: ROOM_STATUS_OPTIONS.includes(value.status) ? value.status : DEFAULT_ROOM_TYPE.status,
    shape: value.shape === "round" ? "round" : "rect",
    spaceType: ROOM_SPACE_OPTIONS.includes(value.spaceType) ? value.spaceType : DEFAULT_ROOM_TYPE.spaceType,
    visibility: ROOM_VISIBILITY_OPTIONS.includes(value.visibility) ? value.visibility : DEFAULT_ROOM_TYPE.visibility,
    skill: facility?.skill ?? value.skill ?? DEFAULT_ROOM_TYPE.skill,
    capacity: toInteger(value.capacity, DEFAULT_ROOM_TYPE.capacity),
    upkeep: toInteger(value.upkeep, DEFAULT_ROOM_TYPE.upkeep),
    ...upgrade,
    w: toInteger(value.w, DEFAULT_ROOM_TYPE.w, 70),
    h: toInteger(value.h, DEFAULT_ROOM_TYPE.h, 70),
    color,
  };
}

export function roomTypeFromRoom(room, overrides = {}) {
  return normalizeRoomType({
    ...room,
    id: overrides.id ?? makeId("room-type"),
    name: overrides.name ?? room.name,
    ...overrides,
  });
}

export function roomTypeFromFacility(facility) {
  return normalizeRoomType({
    id: `facility-${facility.id}`,
    name: facility.name,
    facility: facility.name,
    tier: facility.startingTier,
    skill: facility.skill,
  });
}

export function createRoomFromType(roomType = DEFAULT_ROOM_TYPE, options = {}) {
  const type = normalizeRoomType(roomType);
  const roomTypeId = Object.hasOwn(options, "roomTypeId")
    ? options.roomTypeId
    : type.id === DEFAULT_ROOM_TYPE.id
      ? null
      : type.id;

  return {
    id: options.id ?? makeId("room"),
    roomTypeId,
    name: options.name ?? type.name,
    facility: type.facility,
    tier: type.tier,
    status: type.status,
    shape: type.shape,
    floorId: options.floorId ?? DEFAULT_FLOOR_ID,
    spaceType: type.spaceType,
    visibility: type.visibility,
    skill: type.skill,
    capacity: type.capacity,
    upkeep: type.upkeep,
    upgradeCost: type.upgradeCost,
    upgradeWeeks: type.upgradeWeeks,
    x: options.x ?? 320,
    y: options.y ?? 260,
    w: type.w,
    h: type.h,
    color: type.color,
  };
}
