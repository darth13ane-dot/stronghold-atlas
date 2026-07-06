export const seedRooms = [
  { id: "courtyard", name: "Courtyard", facility: "Gardens", tier: 1, status: "Operational", visibility: "Public", skill: "Nature", capacity: 20, upkeep: 10, upgradeCost: 50, upgradeWeeks: 1, x: 155, y: 45, w: 275, h: 230, color: "#e9eadf" },
  { id: "hall", name: "Great Hall", facility: "Social Club", tier: 1, status: "Operational", visibility: "Public", skill: "Deception", capacity: 24, upkeep: 20, upgradeCost: 50, upgradeWeeks: 1, x: 475, y: 45, w: 300, h: 230, color: "#ece7de" },
  { id: "workshop", name: "Workshop", facility: "Workshop", tier: 1, status: "Operational", visibility: "Members", skill: "Crafting", capacity: 6, upkeep: 20, upgradeCost: 50, upgradeWeeks: 1, x: 125, y: 320, w: 305, h: 225, color: "#e7e2d9" },
  { id: "archive", name: "Archive", facility: "Library", tier: 2, status: "Operational", visibility: "Public", skill: "Society", capacity: 8, upkeep: 20, upgradeCost: 150, upgradeWeeks: 2, x: 475, y: 320, w: 300, h: 225, color: "#f1ede5" },
  { id: "guest", name: "Guest Rooms", facility: "Guest Rooms", tier: 1, status: "Operational", visibility: "Members", skill: "Diplomacy", capacity: 8, upkeep: 10, upgradeCost: 50, upgradeWeeks: 1, x: 140, y: 590, w: 290, h: 190, color: "#eeebe5" },
  { id: "vault", name: "Vault", facility: "Vault", tier: 1, status: "Restricted", visibility: "Private", skill: "Thievery", capacity: 3, upkeep: 10, upgradeCost: 50, upgradeWeeks: 1, x: 515, y: 590, w: 245, h: 190, color: "#dad9d2" },
  { id: "kitchen", name: "Kitchen", facility: "Kitchen & Pantry", tier: 1, status: "Operational", visibility: "Members", skill: "—", capacity: 8, upkeep: 10, upgradeCost: 300, upgradeWeeks: 2, x: 0, y: 0, w: 160, h: 90, color: "#e9e3d9", hidden: true },
  { id: "medical", name: "Medical", facility: "Medical Ward", tier: 1, status: "Operational", visibility: "Members", skill: "Medicine", capacity: 5, upkeep: 10, upgradeCost: 50, upgradeWeeks: 1, x: 0, y: 0, w: 160, h: 90, color: "#e5e9e5", hidden: true },
  { id: "stables", name: "Stables", facility: "Stables & Kennels", tier: 0, status: "Planned", visibility: "Members", skill: "Survival", capacity: 10, upkeep: 0, upgradeCost: 20, upgradeWeeks: 1, x: 0, y: 0, w: 160, h: 90, color: "#ebe5d8", hidden: true },
  { id: "quarters", name: "Quarters", facility: "Resident Quarters", tier: 1, status: "Operational", visibility: "Private", skill: "—", capacity: 6, upkeep: 10, upgradeCost: 300, upgradeWeeks: 2, x: 0, y: 0, w: 160, h: 90, color: "#ece8e1", hidden: true },
  { id: "armory", name: "Armory", facility: "Armory & Defenses", tier: 1, status: "Operational", visibility: "Restricted", skill: "—", capacity: 4, upkeep: 10, upgradeCost: 300, upgradeWeeks: 2, x: 0, y: 0, w: 160, h: 90, color: "#dfe0dc", hidden: true },
  { id: "office", name: "Office", facility: "Unassigned", tier: 0, status: "Operational", visibility: "Private", skill: "Society", capacity: 3, upkeep: 0, upgradeCost: 20, upgradeWeeks: 1, x: 0, y: 0, w: 160, h: 90, color: "#edeae4", hidden: true },
];

export const seedState = {
  schemaVersion: 2,
  name: "The Waystation",
  level: 6,
  week: 12,
  treasury: 1860,
  condition: {
    status: "Needs attention",
    notes: "The north wall needs a structural survey; all other essential areas are operating normally.",
  },
  rooms: seedRooms,
  projects: [
    { id: "p1", name: "Archive shelving", type: "Upgrade", roomId: "archive", progress: 1, total: 2, cost: 150, owner: "Mara", status: "In progress" },
    { id: "p2", name: "North wall survey", type: "Repair", roomId: "courtyard", progress: 0, total: 1, cost: 6, owner: "Ivo", status: "Planned" },
  ],
  people: [
    { id: "r1", name: "Mara Venn", initials: "MV", role: "Steward", assignment: "Administer", color: "#a85a3e" },
    { id: "r2", name: "Ivo Hale", initials: "IH", role: "Foreperson", assignment: "North wall survey", color: "#496e63" },
    { id: "r3", name: "Tamsin Ro", initials: "TR", role: "Researcher", assignment: "Archive shelving", color: "#6c647b" },
    { id: "r4", name: "Guest", initials: "G", role: "Viewer", assignment: "Unassigned", color: "#66737a" },
  ],
};
