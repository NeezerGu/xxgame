export type UpgradeId = "spark" | "amplify";

export interface UpgradeDefinition {
  id: UpgradeId;
  nameKey: string;
  descriptionKey: string;
  cost: number;
  effect:
    | { type: "add"; amount: number }
    | { type: "mult"; factor: number };
}

export const UPGRADE_DEFINITIONS: UpgradeDefinition[] = [
  {
    id: "spark",
    nameKey: "upgrade.spark.name",
    descriptionKey: "upgrade.spark.description",
    cost: 10,
    effect: { type: "add", amount: 0.5 }
  },
  {
    id: "amplify",
    nameKey: "upgrade.amplify.name",
    descriptionKey: "upgrade.amplify.description",
    cost: 50,
    effect: { type: "mult", factor: 1.5 }
  }
];

export function findUpgrade(id: UpgradeId): UpgradeDefinition {
  const upgrade = UPGRADE_DEFINITIONS.find((item) => item.id === id);
  if (!upgrade) {
    throw new Error(`Unknown upgrade id: ${id}`);
  }
  return upgrade;
}
