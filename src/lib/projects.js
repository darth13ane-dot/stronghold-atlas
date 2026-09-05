import { facilityCatalog } from "../data/rules.js";
import { getRoomUpgrade } from "../data/rooms.js";

// Complete a project and its room upgrade in the same shared-state transaction.
export function updateProject(state, id, edit) {
  const previous = state.projects.find((project) => project.id === id);
  if (!previous) return state;
  const next = { ...previous, ...(typeof edit === "function" ? edit(previous) : edit) };
  let rooms = state.rooms;
  const alreadyApplied = previous.upgradeApplied || (previous.type === "Upgrade" && previous.status === "Complete");
  if (alreadyApplied) next.upgradeApplied = true;
  if (next.type === "Upgrade" && next.status === "Complete" && previous.status !== "Complete" && !alreadyApplied) {
    rooms = rooms.map((room) => {
      if (room.id !== next.roomId) return room;
      const maxTier = facilityCatalog.find((facility) => facility.name === room.facility)?.maxTier ?? 4;
      const targetTier = Number.isFinite(next.targetTier) ? next.targetTier : room.tier + 1;
      const tier = Math.min(maxTier, Math.max(room.tier, targetTier));
      next.targetTier = tier;
      next.upgradeApplied = true;
      return { ...room, tier, ...getRoomUpgrade(tier, maxTier) };
    });
  }
  const renamed = previous.name !== next.name;
  return {
    ...state,
    rooms,
    projects: state.projects.map((project) => project.id === id ? next : project),
    people: renamed
      ? state.people.map((person) => person.assignment === previous.name ? { ...person, assignment: next.name } : person)
      : state.people,
  };
}
