export const facilityCatalog = [
  { id: "training", name: "Training Grounds", skill: "—", lore: "—", feat: "—", startingTier: 1, maxTier: 1, special: true },
  { id: "obstacle", name: "Obstacle Course", skill: "Acrobatics", lore: "Gladiatorial", feat: "Fleet", startingTier: 0, maxTier: 4, dependsOn: "Training Grounds" },
  { id: "workout", name: "Workout Area", skill: "Athletics", lore: "Labor", feat: "Shield Block", startingTier: 0, maxTier: 4, dependsOn: "Training Grounds" },
  { id: "library", name: "Library", skill: "Society", lore: "Academia, Legal, Library, Scribing", feat: "Untrained Improvisation", startingTier: 1, maxTier: 4, special: true },
  { id: "arcane", name: "Arcane Laboratory", skill: "Arcana", lore: "Arcane traditions", feat: "Incredible Initiative", startingTier: 0, maxTier: 4, dependsOn: "Library", special: true },
  { id: "chapel", name: "Sanctuary", skill: "Religion", lore: "Chosen faith or philosophy", feat: "Canny Acumen", startingTier: 0, maxTier: 4, dependsOn: "Library", special: true },
  { id: "gardens", name: "Gardens", skill: "Nature", lore: "Local biome", feat: "Diehard", startingTier: 0, maxTier: 4, dependsOn: "Library", special: true },
  { id: "occult", name: "Occult Research Room", skill: "Occultism", lore: "Esoteric traditions", feat: "Breath Control", startingTier: 0, maxTier: 4, dependsOn: "Library", special: true },
  { id: "workshop", name: "Workshop", skill: "Crafting", lore: "Engineering", feat: "Armor Proficiency", startingTier: 0, maxTier: 4 },
  { id: "alchemy", name: "Alchemy Lab", skill: "—", lore: "—", feat: "—", startingTier: 0, maxTier: 1, dependsOn: "Workshop", special: true },
  { id: "smithy", name: "Smithy", skill: "—", lore: "—", feat: "—", startingTier: 0, maxTier: 1, dependsOn: "Workshop", special: true },
  { id: "tinker", name: "Tinkerer’s Bench", skill: "—", lore: "—", feat: "—", startingTier: 0, maxTier: 1, dependsOn: "Workshop", special: true },
  { id: "social", name: "Social Club", skill: "Deception", lore: "Local politics", feat: "Keen Follower", startingTier: 0, maxTier: 4 },
  { id: "guest", name: "Guest Rooms", skill: "Diplomacy", lore: "Chosen culture", feat: "Adopted Ancestry", startingTier: 0, maxTier: 4 },
  { id: "jail", name: "Secure Holding", skill: "Intimidation", lore: "Underworld", feat: "Toughness", startingTier: 1, maxTier: 4 },
  { id: "medical", name: "Medical Ward", skill: "Medicine", lore: "Surgery", feat: "Fast Recovery", startingTier: 0, maxTier: 4, special: true },
  { id: "theatre", name: "Theatre", skill: "Performance", lore: "Theatre", feat: "Hireling Manager", startingTier: 0, maxTier: 4 },
  { id: "hallways", name: "Hallways", skill: "Stealth", lore: "Architecture", feat: "Feather Step", startingTier: 1, maxTier: 4 },
  { id: "stables", name: "Stables & Kennels", skill: "Survival", lore: "Animal keeping", feat: "Ride", startingTier: 0, maxTier: 4 },
  { id: "vault", name: "Vault", skill: "Thievery", lore: "Accounting", feat: "Thorough Search", startingTier: 1, maxTier: 4 },
  { id: "armory", name: "Armory & Defenses", skill: "—", lore: "Warfare", feat: "Weapon Proficiency", startingTier: 1, maxTier: 2, special: true },
  { id: "quarters", name: "Resident Quarters", skill: "—", lore: "Art", feat: "Incredible Investiture", startingTier: 1, maxTier: 2 },
  { id: "kitchen", name: "Kitchen & Pantry", skill: "—", lore: "Cooking", feat: "Supertaster", startingTier: 1, maxTier: 2, special: true },
  { id: "trading", name: "Trading Post", skill: "—", lore: "Mercantile", feat: "Prescient Planner", startingTier: 0, maxTier: 4 },
];

export const tierCosts = [
  { tier: 1, dc: 20, cost: 20, weeks: 1, proficiency: "Trained" },
  { tier: 2, dc: 25, cost: 50, weeks: 1, proficiency: "Expert" },
  { tier: 3, dc: 30, cost: 150, weeks: 2, proficiency: "Expert" },
  { tier: 4, dc: 35, cost: 300, weeks: 2, proficiency: "Master" },
];

export const upkeepBands = [
  { levels: "1–4", formula: "None", trade: "—" },
  { levels: "5–8", formula: "10 gp × level", trade: "Tier 1" },
  { levels: "9–12", formula: "20 gp × level", trade: "Tier 2" },
  { levels: "13–16", formula: "30 gp × level", trade: "Tier 3" },
  { levels: "17–20", formula: "40 gp × level", trade: "Tier 4" },
];

export const repairTemplates = [
  { id: "cleanup", name: "Clean up the site", weeks: 2, cost: 0, dc: null, proficiency: "Untrained", specialty: "Any" },
  { id: "grounds", name: "Clear the grounds", weeks: 1, cost: 6, dc: 17, proficiency: "Trained", specialty: "Masonry" },
  { id: "general", name: "Make general repairs", weeks: 2, cost: 14, dc: 17, proficiency: "Trained", specialty: "Woodworking" },
  { id: "access", name: "Rebuild damaged access", weeks: 2, cost: 16, dc: 22, proficiency: "Expert", specialty: "Masonry" },
  { id: "walls", name: "Repair structural walls", weeks: 3, cost: 24, dc: 22, proficiency: "Expert", specialty: "Masonry" },
  { id: "defenses", name: "Restore outer defenses", weeks: 2, cost: 30, dc: 22, proficiency: "Expert", specialty: "Masonry" },
];

export const ruleSections = [
  {
    id: "administer",
    title: "Administer",
    summary: "Once per interval, one character makes a Society check against the higher of stronghold level + 15 or DC 20.",
    bullets: [
      "Critical success: smooth operation for one month, +2 to repair and upgrade checks, up to four trained worker groups.",
      "Success: smooth operation for one week, +1 to repair and upgrade checks, up to three trained worker groups.",
      "Failure: normal operation for one week, up to two trained worker groups.",
      "Critical failure: weekly costs increase by 20%, up to two trained worker groups.",
    ],
  },
  {
    id: "hire",
    title: "Hire help",
    summary: "Workers and specialists can fulfill project requirements. Hired checks succeed, but never critically succeed.",
    bullets: ["Untrained workers: 2 gp per week.", "Trained workers: 10 gp per week.", "Specialist or foreperson: 5 gp or 20% of facility cost, whichever is higher."],
  },
  {
    id: "repairs",
    title: "Basic repairs",
    summary: "Cleanup must finish before other repair or upgrade projects. Each week normally requires a Crafting check.",
    bullets: [
      "Critical success saves half the labor on a one-week task or completes two weeks of a longer task.",
      "Failure increases labor cost by 20%.",
      "Critical failure wastes one week of labor.",
    ],
  },
  {
    id: "upgrade",
    title: "Build or upgrade a facility",
    summary: "Once repairs are complete, facilities are built or improved using their associated skill—or Crafting when none applies.",
    bullets: [
      "Critical success saves 20% and can complete an additional remaining week.",
      "Failure increases that week’s supplies by 20%.",
      "Critical failure wastes the week and half of that week’s supplies.",
      "Multi-week facility work must be completed sequentially.",
    ],
  },
  {
    id: "benefits",
    title: "Stronghold benefits",
    summary: "Built facilities unlock skills, lores, feats, assistive resources, and mission preparation as the stronghold levels.",
    bullets: [
      "Tier 1: +1 assistive resources, lore research, mission training +1, skill training, trained skill feats.",
      "Tier 2: a general feat, mission training +2, expert skill increases and feats.",
      "Tier 3: +2 assistive resources, master skill increases and feats, special mission training.",
      "Tier 4: mission training +3, legendary skill increases and feats.",
    ],
  },
];

