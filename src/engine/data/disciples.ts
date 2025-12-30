export type DiscipleRole = "contractClerk" | "alchemist" | "smith" | "gatherer";

export interface DiscipleArchetypeDefinition {
  id: DiscipleArchetypeId;
  nameKey: string;
  descriptionKey: string;
  baseAptitude: number;
  rolesAllowed: DiscipleRole[];
}

export type DiscipleArchetypeId =
  | "ledger-adept"
  | "furnace-attune"
  | "grove-runner"
  | "array-scribe";

export const DISCIPLE_ARCHETYPES: DiscipleArchetypeDefinition[] = [
  {
    id: "ledger-adept",
    nameKey: "disciples.archetype.ledgerAdept.name",
    descriptionKey: "disciples.archetype.ledgerAdept.description",
    baseAptitude: 0.18,
    rolesAllowed: ["contractClerk", "gatherer"]
  },
  {
    id: "furnace-attune",
    nameKey: "disciples.archetype.furnaceAttune.name",
    descriptionKey: "disciples.archetype.furnaceAttune.description",
    baseAptitude: 0.2,
    rolesAllowed: ["smith", "alchemist"]
  },
  {
    id: "grove-runner",
    nameKey: "disciples.archetype.groveRunner.name",
    descriptionKey: "disciples.archetype.groveRunner.description",
    baseAptitude: 0.16,
    rolesAllowed: ["gatherer", "contractClerk"]
  },
  {
    id: "array-scribe",
    nameKey: "disciples.archetype.arrayScribe.name",
    descriptionKey: "disciples.archetype.arrayScribe.description",
    baseAptitude: 0.14,
    rolesAllowed: ["contractClerk", "alchemist"]
  }
];

export const DISCIPLE_RECRUIT_COST = {
  essence: 120,
  reputation: 10
};

export interface DiscipleRoleEffect {
  autoClaim?: boolean;
  autoAccept?: boolean;
  alchemySpeedPerAptitude?: number;
  forgingSpeedPerAptitude?: number;
  herbPerSecondPerAptitude?: number;
  orePerSecondPerAptitude?: number;
}

export const DISCIPLE_ROLE_EFFECTS: Record<DiscipleRole, DiscipleRoleEffect> = {
  contractClerk: {
    autoClaim: true,
    autoAccept: true
  },
  alchemist: {
    alchemySpeedPerAptitude: 0.15
  },
  smith: {
    forgingSpeedPerAptitude: 0.15
  },
  gatherer: {
    herbPerSecondPerAptitude: 0.05,
    orePerSecondPerAptitude: 0.04
  }
};

export function findDiscipleArchetype(id: DiscipleArchetypeId): DiscipleArchetypeDefinition {
  const def = DISCIPLE_ARCHETYPES.find((item) => item.id === id);
  if (!def) {
    throw new Error(`Unknown disciple archetype: ${id}`);
  }
  return def;
}
