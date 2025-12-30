import { CONSUMABLE_DEFINITIONS, findAlchemyRecipe, findConsumableDefinition } from "./data/alchemy";
import { canAfford, spendResources } from "./resources";
export function createEmptyAlchemyQueue() {
    return {
        active: null,
        lastFinished: null
    };
}
export function createEmptyConsumables(initial = {}) {
    return CONSUMABLE_DEFINITIONS.reduce((acc, def) => {
        acc[def.id] = initial[def.id] ?? 0;
        return acc;
    }, { ...initial });
}
export function getBuffModifiers(state) {
    return (state.buffs ?? []).reduce((acc, buff) => {
        if (buff.effects.productionMult !== undefined) {
            acc.productionMult *= buff.effects.productionMult;
        }
        if (buff.effects.contractSpeedMult !== undefined) {
            acc.contractSpeedMult *= buff.effects.contractSpeedMult;
        }
        return acc;
    }, { productionMult: 1, contractSpeedMult: 1 });
}
export function isRecipeUnlocked(state, recipeId) {
    const recipe = findAlchemyRecipe(recipeId);
    if (recipe.alwaysUnlocked)
        return true;
    return state.realm.unlockedRecipeIds.includes(recipeId);
}
export function startAlchemy(state, recipeId) {
    const queue = state.alchemyQueue ?? createEmptyAlchemyQueue();
    if (queue.active)
        return state;
    const recipe = findAlchemyRecipe(recipeId);
    if (!isRecipeUnlocked(state, recipeId))
        return state;
    if (!canAfford(state.resources, recipe.cost))
        return state;
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
export function progressAlchemy(state, dtMs, speedMult = 1) {
    const queue = state.alchemyQueue ?? createEmptyAlchemyQueue();
    const active = queue.active;
    if (!active || dtMs <= 0) {
        if (state.alchemyQueue === queue)
            return state;
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
    const nextInventory = {
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
export function tickBuffs(state, dtMs) {
    if (!state.buffs || state.buffs.length === 0 || dtMs <= 0) {
        if (!state.buffs) {
            return { state: { ...state, buffs: [] }, changed: false };
        }
        return { state, changed: false };
    }
    let changed = false;
    const nextBuffs = [];
    for (const buff of state.buffs) {
        const remaining = buff.remainingMs - dtMs;
        if (remaining > 0) {
            nextBuffs.push({ ...buff, remainingMs: remaining });
            if (!changed && remaining !== buff.remainingMs) {
                changed = true;
            }
        }
        else {
            changed = true;
        }
    }
    if (!changed && nextBuffs.length === state.buffs.length) {
        return { state, changed: false };
    }
    return { state: { ...state, buffs: nextBuffs }, changed: true };
}
export function consumeItem(state, itemId) {
    const def = findConsumableDefinition(itemId);
    const inventory = state.consumables ?? createEmptyConsumables();
    const count = inventory[itemId] ?? 0;
    if (count <= 0)
        return state;
    const nextBuffs = [
        ...(state.buffs ?? []),
        { id: itemId, remainingMs: def.durationMs, effects: def.effects }
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
export function hasActiveBuff(state, itemId) {
    return (state.buffs ?? []).some((buff) => buff.id === itemId && buff.remainingMs > 0);
}
