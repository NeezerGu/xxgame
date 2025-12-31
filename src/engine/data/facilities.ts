export type FacilityId = "guildHall" | "lab" | "forge" | "archive";

export interface FacilityEffects {
  contractSlotsBonus?: number;
  reputationGainMult?: number;
  contractCostDiscount?: number;
  alchemySpeedMult?: number;
  buffDurationMult?: number;
  forgingSpeedMult?: number;
  disassembleYieldMult?: number;
  offlineCapBonusMs?: number;
  offlineEfficiencyMult?: number;
}

export interface FacilityDefinition {
  id: FacilityId;
  nameKey: string;
  descriptionKey: string;
  baseCostEssence: number;
  costGrowth: number;
  maxLevel: number;
  effectsByLevel: FacilityEffects[];
}

export const FACILITY_DEFINITIONS: FacilityDefinition[] = [
  {
    id: "guildHall",
    nameKey: "facilities.guildHall.name",
    descriptionKey: "facilities.guildHall.description",
    baseCostEssence: 120,
    costGrowth: 1.6,
    maxLevel: 4,
    effectsByLevel: [
      { contractSlotsBonus: 1, reputationGainMult: 1.1, contractCostDiscount: 0.05 },
      { reputationGainMult: 1.05, contractCostDiscount: 0.05 },
      { contractSlotsBonus: 1, reputationGainMult: 1.05, contractCostDiscount: 0.05 },
      { reputationGainMult: 1.05, contractCostDiscount: 0.05 }
    ]
  },
  {
    id: "lab",
    nameKey: "facilities.lab.name",
    descriptionKey: "facilities.lab.description",
    baseCostEssence: 90,
    costGrowth: 1.55,
    maxLevel: 3,
    effectsByLevel: [
      { alchemySpeedMult: 1.12, buffDurationMult: 1.05 },
      { alchemySpeedMult: 1.12, buffDurationMult: 1.05 },
      { alchemySpeedMult: 1.15, buffDurationMult: 1.1 }
    ]
  },
  {
    id: "forge",
    nameKey: "facilities.forge.name",
    descriptionKey: "facilities.forge.description",
    baseCostEssence: 110,
    costGrowth: 1.6,
    maxLevel: 3,
    effectsByLevel: [
      { forgingSpeedMult: 1.12, disassembleYieldMult: 1.05 },
      { forgingSpeedMult: 1.12, disassembleYieldMult: 1.05 },
      { forgingSpeedMult: 1.15, disassembleYieldMult: 1.08 }
    ]
  },
  {
    id: "archive",
    nameKey: "facilities.archive.name",
    descriptionKey: "facilities.archive.description",
    baseCostEssence: 150,
    costGrowth: 1.5,
    maxLevel: 2,
    effectsByLevel: [
      { offlineCapBonusMs: 30 * 60 * 1000, offlineEfficiencyMult: 1.05 },
      { offlineCapBonusMs: 30 * 60 * 1000, offlineEfficiencyMult: 1.05 }
    ]
  }
];

export function findFacilityDefinition(id: FacilityId): FacilityDefinition {
  const def = FACILITY_DEFINITIONS.find((item) => item.id === id);
  if (!def) {
    throw new Error(`Unknown facility id: ${id}`);
  }
  return def;
}
