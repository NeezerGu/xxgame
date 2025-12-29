import type { ContractId } from "./contracts";
import type { ResearchId } from "./research";

export type RealmId = "foundation-novice" | "ember-handler" | "artisan-adept" | "array-keeper" | "forgemaster" | "domain-seeker";

export interface RealmRequirement {
  essenceEarned?: number;
  contractsCompleted?: number;
  reputation?: number;
}

export interface RealmUnlocks {
  unlockTabs: string[];
  unlockContractIds?: ContractId[];
  unlockResearchIds?: ResearchId[];
  unlockRecipeIds?: string[];
}

export interface RealmDefinition {
  id: RealmId;
  nameKey: string;
  descriptionKey: string;
  breakthroughRequirement: RealmRequirement;
  unlocks: RealmUnlocks;
}

export const REALM_DEFINITIONS: RealmDefinition[] = [
  {
    id: "foundation-novice",
    nameKey: "realm.foundationNovice.name",
    descriptionKey: "realm.foundationNovice.description",
    breakthroughRequirement: {},
    unlocks: {
      unlockTabs: ["realm", "contracts", "upgrades", "research", "ascend", "dev", "help"],
      unlockContractIds: ["starter-recon", "essence-delivery", "lab-support", "field-analysis", "relay-maintenance", "artifact-catalog", "stabilize-array", "sealed-archive"],
      unlockResearchIds: ["contractSpeed", "productionBoost", "extraContractSlot"],
      unlockRecipeIds: []
    }
  },
  {
    id: "ember-handler",
    nameKey: "realm.emberHandler.name",
    descriptionKey: "realm.emberHandler.description",
    breakthroughRequirement: {
      essenceEarned: 200,
      contractsCompleted: 3
    },
    unlocks: {
      unlockTabs: [],
      unlockContractIds: [],
      unlockResearchIds: [],
      unlockRecipeIds: []
    }
  },
  {
    id: "artisan-adept",
    nameKey: "realm.artisanAdept.name",
    descriptionKey: "realm.artisanAdept.description",
    breakthroughRequirement: {
      contractsCompleted: 6,
      reputation: 20
    },
    unlocks: {
      unlockTabs: [],
      unlockContractIds: [],
      unlockResearchIds: [],
      unlockRecipeIds: []
    }
  },
  {
    id: "array-keeper",
    nameKey: "realm.arrayKeeper.name",
    descriptionKey: "realm.arrayKeeper.description",
    breakthroughRequirement: {
      essenceEarned: 1500,
      contractsCompleted: 10,
      reputation: 50
    },
    unlocks: {
      unlockTabs: [],
      unlockContractIds: [],
      unlockResearchIds: [],
      unlockRecipeIds: []
    }
  },
  {
    id: "forgemaster",
    nameKey: "realm.forgemaster.name",
    descriptionKey: "realm.forgemaster.description",
    breakthroughRequirement: {
      essenceEarned: 4500,
      contractsCompleted: 16,
      reputation: 80
    },
    unlocks: {
      unlockTabs: [],
      unlockContractIds: [],
      unlockResearchIds: [],
      unlockRecipeIds: []
    }
  },
  {
    id: "domain-seeker",
    nameKey: "realm.domainSeeker.name",
    descriptionKey: "realm.domainSeeker.description",
    breakthroughRequirement: {
      essenceEarned: 9000,
      contractsCompleted: 24,
      reputation: 120
    },
    unlocks: {
      unlockTabs: [],
      unlockContractIds: [],
      unlockResearchIds: [],
      unlockRecipeIds: []
    }
  }
];

export function findRealmDefinition(id: RealmId): RealmDefinition {
  const def = REALM_DEFINITIONS.find((item) => item.id === id);
  if (!def) {
    throw new Error(`Unknown realm id: ${id}`);
  }
  return def;
}
