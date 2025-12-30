import type { ResourceId } from "../types";

export type ConsumableId = "ember-elixir" | "quicksign-tonic" | "balanced-draught";
export type AlchemyRecipeId = "ember-elixir" | "quicksign-tonic" | "balanced-draught";

export interface ConsumableDefinition {
  id: ConsumableId;
  nameKey: string;
  descriptionKey: string;
  durationMs: number;
  effects: {
    productionMult?: number;
    contractSpeedMult?: number;
  };
}

export interface AlchemyRecipeDefinition {
  id: AlchemyRecipeId;
  nameKey: string;
  descriptionKey: string;
  durationMs: number;
  cost: Partial<Record<ResourceId, number>>;
  result: {
    itemId: ConsumableId;
    quantity: number;
  };
  alwaysUnlocked?: boolean;
}

export const CONSUMABLE_DEFINITIONS: ConsumableDefinition[] = [
  {
    id: "ember-elixir",
    nameKey: "alchemy.item.emberElixir.name",
    descriptionKey: "alchemy.item.emberElixir.description",
    durationMs: 60_000,
    effects: {
      productionMult: 1.12
    }
  },
  {
    id: "quicksign-tonic",
    nameKey: "alchemy.item.quicksignTonic.name",
    descriptionKey: "alchemy.item.quicksignTonic.description",
    durationMs: 60_000,
    effects: {
      contractSpeedMult: 1.15
    }
  },
  {
    id: "balanced-draught",
    nameKey: "alchemy.item.balancedDraught.name",
    descriptionKey: "alchemy.item.balancedDraught.description",
    durationMs: 90_000,
    effects: {
      productionMult: 1.05,
      contractSpeedMult: 1.05
    }
  }
];

export const ALCHEMY_RECIPES: AlchemyRecipeDefinition[] = [
  {
    id: "ember-elixir",
    nameKey: "alchemy.recipe.emberElixir.name",
    descriptionKey: "alchemy.recipe.emberElixir.description",
    durationMs: 20_000,
    cost: { herb: 8, essence: 25 },
    result: { itemId: "ember-elixir", quantity: 1 },
    alwaysUnlocked: true
  },
  {
    id: "quicksign-tonic",
    nameKey: "alchemy.recipe.quicksignTonic.name",
    descriptionKey: "alchemy.recipe.quicksignTonic.description",
    durationMs: 25_000,
    cost: { herb: 10, essence: 35 },
    result: { itemId: "quicksign-tonic", quantity: 1 }
  },
  {
    id: "balanced-draught",
    nameKey: "alchemy.recipe.balancedDraught.name",
    descriptionKey: "alchemy.recipe.balancedDraught.description",
    durationMs: 30_000,
    cost: { herb: 15, essence: 40 },
    result: { itemId: "balanced-draught", quantity: 1 }
  }
];

export function findAlchemyRecipe(id: AlchemyRecipeId): AlchemyRecipeDefinition {
  const recipe = ALCHEMY_RECIPES.find((item) => item.id === id);
  if (!recipe) {
    throw new Error(`Unknown alchemy recipe: ${id}`);
  }
  return recipe;
}

export function findConsumableDefinition(id: ConsumableId): ConsumableDefinition {
  const def = CONSUMABLE_DEFINITIONS.find((item) => item.id === id);
  if (!def) {
    throw new Error(`Unknown consumable id: ${id}`);
  }
  return def;
}
