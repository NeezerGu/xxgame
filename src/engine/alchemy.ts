import { CONSUMABLE_DEFINITIONS, findAlchemyRecipe, findConsumableDefinition } from "./data/alchemy";
import type {
  ActiveBuff,
  AlchemyQueueState,
  AlchemyRecipeId,
  ConsumableId,
  ConsumableInventory,
  GameState
} from "./types";
import { canAfford, spendResources } from "./resources";
import { getFacilityModifiers } from "./facilities";

export function createEmptyAlchemyQueue(): AlchemyQueueState {
  return {
    active: null,
    lastFinished: null
  };
}

export function createEmptyConsumables(initial: Partial<ConsumableInventory> = {}): ConsumableInventory {
  return CONSUMABLE_DEFINITIONS.reduce((acc, def) => {
    acc[def.id] = initial[def.id] ?? 0;
    return acc;
  }, { ...initial } as ConsumableInventory);
}

export function getBuffModifiers(state: Pick<GameState, "buffs">): { productionMult: number; contractSpeedMult: number } {
  return (state.buffs ?? []).reduce(
    (acc, buff) => {
      if (buff.effects.productionMult !== undefined) {
        acc.productionMult *= buff.effects.productionMult;
      }
      if (buff.effects.contractSpeedMult !== undefined) {
        acc.contractSpeedMult *= buff.effects.contractSpeedMult;
      }
      return acc;
    },
    { productionMult: 1, contractSpeedMult: 1 }
  );
}

export function isRecipeUnlocked(state: GameState, recipeId: AlchemyRecipeId): boolean {
  const recipe = findAlchemyRecipe(recipeId);
  if (recipe.alwaysUnlocked) return true;
  return state.realm.unlockedRecipeIds.includes(recipeId);
}

export function startAlchemy(state: GameState, recipeId: AlchemyRecipeId): GameState {
  const queue = state.alchemyQueue ?? createEmptyAlchemyQueue();
  if (queue.active) return state;
  const recipe = findAlchemyRecipe(recipeId);
  if (!isRecipeUnlocked(state, recipeId)) return state;
  if (!canAfford(state.resources, recipe.cost)) return state;

  const task = {
    recipeId,
    remainingMs: recipe.durationMs,
    totalMs: recipe.durationMs
  };

  return {
    ...state,
    resources: spendResources(state.resources, recipe.cost),
    alchemyQueue: {
      ...queue,
      active: task
    }
  };
}

export function progressAlchemy(state: GameState, dtMs: number, speedMult: number = 1): GameState {
  const queue = state.alchemyQueue ?? createEmptyAlchemyQueue();
  const active = queue.active;
  if (!active || dtMs <= 0) {
    if (state.alchemyQueue === queue) return state;
    return {
      ...state,
      alchemyQueue: queue
    };
  }

  const nextRemaining = Math.max(0, active.remainingMs - dtMs * speedMult);
  if (nextRemaining > 0) {
    return {
      ...state,
      alchemyQueue: {
        ...queue,
        active: { ...active, remainingMs: nextRemaining }
      }
    };
  }

  const recipe = findAlchemyRecipe(active.recipeId);
  const consumables = state.consumables ?? createEmptyConsumables();
  const currentCount = consumables[recipe.result.itemId] ?? 0;
  const nextInventory: ConsumableInventory = {
    ...consumables,
    [recipe.result.itemId]: currentCount + recipe.result.quantity
  };

  return {
    ...state,
    alchemyQueue: {
      ...queue,
      active: null,
      lastFinished: { itemId: recipe.result.itemId, quantity: recipe.result.quantity }
    },
    consumables: nextInventory
  };
}

export function tickBuffs(state: GameState, dtMs: number): { state: GameState; changed: boolean } {
  if (!state.buffs || state.buffs.length === 0 || dtMs <= 0) {
    if (!state.buffs) {
      return { state: { ...state, buffs: [] }, changed: false };
    }
    return { state, changed: false };
  }

  let changed = false;
  const nextBuffs: ActiveBuff[] = [];
  for (const buff of state.buffs) {
    const remaining = buff.remainingMs - dtMs;
    if (remaining > 0) {
      nextBuffs.push({ ...buff, remainingMs: remaining });
      if (!changed && remaining !== buff.remainingMs) {
        changed = true;
      }
    } else {
      changed = true;
    }
  }

  if (!changed && nextBuffs.length === state.buffs.length) {
    return { state, changed: false };
  }

  return { state: { ...state, buffs: nextBuffs }, changed: true };
}

export function consumeItem(state: GameState, itemId: ConsumableId): GameState {
  const def = findConsumableDefinition(itemId);
  const inventory = state.consumables ?? createEmptyConsumables();
  const count = inventory[itemId] ?? 0;
  if (count <= 0) return state;

  const facilityModifiers = getFacilityModifiers(state);
  const durationMs = Math.round(def.durationMs * facilityModifiers.buffDurationMult);

  const nextBuffs: ActiveBuff[] = [
    ...(state.buffs ?? []),
    { id: itemId, remainingMs: durationMs, effects: def.effects }
  ];

  return {
    ...state,
    consumables: {
      ...inventory,
      [itemId]: count - 1
    },
    buffs: nextBuffs
  };
}

export function hasActiveBuff(state: GameState, itemId: ConsumableId): boolean {
  return (state.buffs ?? []).some((buff) => buff.id === itemId && buff.remainingMs > 0);
}
