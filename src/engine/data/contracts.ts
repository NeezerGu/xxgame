export type ContractId =
  | "starter-recon"
  | "essence-delivery"
  | "lab-support"
  | "field-analysis"
  | "relay-maintenance"
  | "artifact-catalog"
  | "stabilize-array"
  | "sealed-archive"
  | "herb-gathering"
  | "ore-survey";

export interface ContractDefinition {
  id: ContractId;
  nameKey: string;
  descriptionKey: string;
  durationMs: number;
  requiredReputation?: number;
  tier?: number;
  acceptCostEssence?: number;
  requiredEssencePerSecond?: number;
  reward: Partial<Record<import("../types").ResourceId, number>>;
}

export const CONTRACT_DEFINITIONS: ContractDefinition[] = [
  {
    id: "starter-recon",
    nameKey: "contracts.starterRecon.name",
    descriptionKey: "contracts.starterRecon.description",
    durationMs: 10_000,
    requiredReputation: 0,
    tier: 1,
    acceptCostEssence: 0,
    requiredEssencePerSecond: 0,
    reward: {
      research: 2,
      essence: 15,
      reputation: 1
    }
  },
  {
    id: "essence-delivery",
    nameKey: "contracts.essenceDelivery.name",
    descriptionKey: "contracts.essenceDelivery.description",
    durationMs: 20_000,
    requiredReputation: 0,
    tier: 1,
    acceptCostEssence: 5,
    requiredEssencePerSecond: 0.5,
    reward: {
      research: 3,
      essence: 40,
      reputation: 1
    }
  },
  {
    id: "lab-support",
    nameKey: "contracts.labSupport.name",
    descriptionKey: "contracts.labSupport.description",
    durationMs: 30_000,
    requiredReputation: 0,
    tier: 1,
    acceptCostEssence: 8,
    requiredEssencePerSecond: 1,
    reward: {
      research: 7,
      essence: 55,
      reputation: 2
    }
  },
  {
    id: "field-analysis",
    nameKey: "contracts.fieldAnalysis.name",
    descriptionKey: "contracts.fieldAnalysis.description",
    durationMs: 28_000,
    requiredReputation: 10,
    tier: 2,
    acceptCostEssence: 15,
    requiredEssencePerSecond: 1.5,
    reward: {
      research: 16,
      essence: 45,
      reputation: 4
    }
  },
  {
    id: "relay-maintenance",
    nameKey: "contracts.relayMaintenance.name",
    descriptionKey: "contracts.relayMaintenance.description",
    durationMs: 32_000,
    requiredReputation: 10,
    tier: 2,
    acceptCostEssence: 18,
    requiredEssencePerSecond: 1.5,
    reward: {
      research: 10,
      essence: 95,
      reputation: 3
    }
  },
  {
    id: "artifact-catalog",
    nameKey: "contracts.artifactCatalog.name",
    descriptionKey: "contracts.artifactCatalog.description",
    durationMs: 36_000,
    requiredReputation: 10,
    tier: 2,
    acceptCostEssence: 22,
    requiredEssencePerSecond: 2,
    reward: {
      research: 18,
      essence: 40,
      reputation: 5
    }
  },
  {
    id: "stabilize-array",
    nameKey: "contracts.stabilizeArray.name",
    descriptionKey: "contracts.stabilizeArray.description",
    durationMs: 45_000,
    requiredReputation: 25,
    tier: 3,
    acceptCostEssence: 30,
    requiredEssencePerSecond: 2.5,
    reward: {
      research: 20,
      essence: 100,
      reputation: 7
    }
  },
  {
    id: "sealed-archive",
    nameKey: "contracts.sealedArchive.name",
    descriptionKey: "contracts.sealedArchive.description",
    durationMs: 55_000,
    requiredReputation: 50,
    tier: 4,
    acceptCostEssence: 40,
    requiredEssencePerSecond: 3,
    reward: {
      research: 28,
      essence: 130,
      reputation: 12
    }
  },
  {
    id: "herb-gathering",
    nameKey: "contracts.herbGathering.name",
    descriptionKey: "contracts.herbGathering.description",
    durationMs: 35_000,
    requiredReputation: 15,
    tier: 2,
    acceptCostEssence: 10,
    requiredEssencePerSecond: 1.5,
    reward: {
      research: 8,
      essence: 25,
      herb: 15,
      reputation: 3
    }
  },
  {
    id: "ore-survey",
    nameKey: "contracts.oreSurvey.name",
    descriptionKey: "contracts.oreSurvey.description",
    durationMs: 42_000,
    requiredReputation: 25,
    tier: 3,
    acceptCostEssence: 18,
    requiredEssencePerSecond: 2,
    reward: {
      research: 12,
      essence: 35,
      ore: 10,
      reputation: 4
    }
  }
];

export function findContractDefinition(id: ContractId): ContractDefinition {
  const def = CONTRACT_DEFINITIONS.find((item) => item.id === id);
  if (!def) {
    throw new Error(`Unknown contract id: ${id}`);
  }
  return def;
}
