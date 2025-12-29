import type { EquipmentBlueprintId } from "./equipment";
import type { ExpeditionId, ResourceId, RealmId } from "../types";
export type { ExpeditionId } from "../types";

export type ExpeditionRewardEntry =
  | {
      type: "resource";
      resourceId: ResourceId;
      amount: number;
      weight: number;
    }
  | {
      type: "recipe";
      recipeId: string;
      weight: number;
    }
  | {
      type: "equipment";
      blueprintId: EquipmentBlueprintId;
      weight: number;
    };

export interface ExpeditionDefinition {
  id: ExpeditionId;
  nameKey: string;
  descKey: string;
  durationMs: number;
  staminaCost?: number;
  requiredRealm?: RealmId;
  rewardRolls: number;
  rewardTable: ExpeditionRewardEntry[];
}

export const EXPEDITION_DEFINITIONS: ExpeditionDefinition[] = [
  {
    id: "sunken-archive",
    nameKey: "expeditions.sunkenArchive.name",
    descKey: "expeditions.sunkenArchive.description",
    durationMs: 45_000,
    rewardRolls: 2,
    rewardTable: [
      { type: "resource", resourceId: "herb", amount: 30, weight: 5 },
      { type: "resource", resourceId: "ore", amount: 20, weight: 5 },
      { type: "resource", resourceId: "essence", amount: 120, weight: 3 },
      { type: "recipe", recipeId: "elixir-glowroot", weight: 2 }
    ]
  },
  {
    id: "shimmering-reef",
    nameKey: "expeditions.shimmeringReef.name",
    descKey: "expeditions.shimmeringReef.description",
    durationMs: 55_000,
    requiredRealm: "ember-handler",
    rewardRolls: 2,
    rewardTable: [
      { type: "resource", resourceId: "herb", amount: 50, weight: 5 },
      { type: "resource", resourceId: "essence", amount: 150, weight: 4 },
      { type: "recipe", recipeId: "tideglass-draft", weight: 2 },
      { type: "equipment", blueprintId: "glyph-charm", weight: 1 }
    ]
  },
  {
    id: "ember-crater",
    nameKey: "expeditions.emberCrater.name",
    descKey: "expeditions.emberCrater.description",
    durationMs: 60_000,
    requiredRealm: "artisan-adept",
    rewardRolls: 3,
    rewardTable: [
      { type: "resource", resourceId: "ore", amount: 60, weight: 5 },
      { type: "resource", resourceId: "essence", amount: 180, weight: 4 },
      { type: "equipment", blueprintId: "ember-shiv", weight: 2 },
      { type: "recipe", recipeId: "emberglass-tonic", weight: 1 }
    ]
  },
  {
    id: "mist-labyrinth",
    nameKey: "expeditions.mistLabyrinth.name",
    descKey: "expeditions.mistLabyrinth.description",
    durationMs: 70_000,
    requiredRealm: "array-keeper",
    rewardRolls: 3,
    rewardTable: [
      { type: "resource", resourceId: "herb", amount: 70, weight: 4 },
      { type: "resource", resourceId: "ore", amount: 70, weight: 4 },
      { type: "resource", resourceId: "essence", amount: 200, weight: 3 },
      { type: "equipment", blueprintId: "woven-ward", weight: 2 },
      { type: "recipe", recipeId: "veilweave-potion", weight: 1 }
    ]
  },
  {
    id: "skyforge-span",
    nameKey: "expeditions.skyforgeSpan.name",
    descKey: "expeditions.skyforgeSpan.description",
    durationMs: 80_000,
    requiredRealm: "forgemaster",
    rewardRolls: 3,
    rewardTable: [
      { type: "resource", resourceId: "ore", amount: 90, weight: 5 },
      { type: "resource", resourceId: "essence", amount: 220, weight: 3 },
      { type: "equipment", blueprintId: "circuit-band", weight: 2 },
      { type: "recipe", recipeId: "skyforge-tincture", weight: 1 }
    ]
  },
  {
    id: "hollow-spire",
    nameKey: "expeditions.hollowSpire.name",
    descKey: "expeditions.hollowSpire.description",
    durationMs: 95_000,
    requiredRealm: "domain-seeker",
    rewardRolls: 4,
    rewardTable: [
      { type: "resource", resourceId: "herb", amount: 110, weight: 4 },
      { type: "resource", resourceId: "ore", amount: 110, weight: 4 },
      { type: "resource", resourceId: "essence", amount: 260, weight: 3 },
      { type: "equipment", blueprintId: "glyph-charm", weight: 2 },
      { type: "recipe", recipeId: "spireheart-draught", weight: 1 }
    ]
  }
];

export function findExpeditionDefinition(id: ExpeditionId): ExpeditionDefinition {
  const def = EXPEDITION_DEFINITIONS.find((item) => item.id === id);
  if (!def) {
    throw new Error(`Unknown expedition id: ${id}`);
  }
  return def;
}
