export type ContractId = "starter-recon" | "essence-delivery" | "lab-support" | "field-analysis";

export interface ContractDefinition {
  id: ContractId;
  nameKey: string;
  descriptionKey: string;
  durationMs: number;
  reward: {
    essence?: number;
    research?: number;
    reputation?: number;
  };
}

export const CONTRACT_DEFINITIONS: ContractDefinition[] = [
  {
    id: "starter-recon",
    nameKey: "contracts.starterRecon.name",
    descriptionKey: "contracts.starterRecon.description",
    durationMs: 10_000,
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
    reward: {
      research: 4,
      essence: 30,
      reputation: 1
    }
  },
  {
    id: "lab-support",
    nameKey: "contracts.labSupport.name",
    descriptionKey: "contracts.labSupport.description",
    durationMs: 30_000,
    reward: {
      research: 8,
      essence: 45,
      reputation: 2
    }
  },
  {
    id: "field-analysis",
    nameKey: "contracts.fieldAnalysis.name",
    descriptionKey: "contracts.fieldAnalysis.description",
    durationMs: 25_000,
    reward: {
      research: 10,
      essence: 60,
      reputation: 2
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
