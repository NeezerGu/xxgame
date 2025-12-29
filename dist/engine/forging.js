import { AFFIX_DEFINITIONS, DISASSEMBLE_REFUND_MULTIPLIER, EQUIPMENT_BLUEPRINTS, FORGING_AFFIX_COUNT, FORGING_RARITY_WEIGHTS, findEquipmentBlueprint } from "./data/equipment";
import { nextRandom } from "./utils/rng";
import { canAfford, addResources, spendResources } from "./resources";
import { calculateProduction } from "./state";
export function createEmptyForgingQueue() {
    return {
        active: null,
        lastFinished: null
    };
}
function rollRarity(seed) {
    const roll = nextRandom(seed);
    const totalWeight = Object.values(FORGING_RARITY_WEIGHTS).reduce((sum, value) => sum + value, 0);
    const target = roll.value * totalWeight;
    let cumulative = 0;
    for (const [rarity, weight] of Object.entries(FORGING_RARITY_WEIGHTS)) {
        cumulative += weight;
        if (target <= cumulative) {
            return { rarity, nextSeed: roll.nextSeed };
        }
    }
    return { rarity: "common", nextSeed: roll.nextSeed };
}
function rollAffixes(count, seed) {
    const pool = [...AFFIX_DEFINITIONS];
    const affixes = [];
    let currentSeed = seed;
    for (let i = 0; i < count && pool.length > 0; i += 1) {
        const pickRoll = nextRandom(currentSeed);
        currentSeed = pickRoll.nextSeed;
        const index = Math.floor(pickRoll.value * pool.length);
        const def = pool.splice(index, 1)[0];
        const valueRoll = nextRandom(currentSeed);
        currentSeed = valueRoll.nextSeed;
        const value = def.min + (def.max - def.min) * valueRoll.value;
        affixes.push({ affixId: def.id, value });
    }
    return { affixes, nextSeed: currentSeed };
}
export function startForging(state, blueprintId) {
    const blueprint = EQUIPMENT_BLUEPRINTS.find((b) => b.id === blueprintId);
    if (!blueprint)
        return state;
    const queue = state.forgingQueue ?? createEmptyForgingQueue();
    if (queue.active)
        return state;
    if (!canAfford(state.resources, blueprint.cost))
        return state;
    let seed = state.seed ?? 1;
    const rarityRoll = rollRarity(seed);
    seed = rarityRoll.nextSeed;
    const affixCount = FORGING_AFFIX_COUNT[rarityRoll.rarity];
    const affixRoll = rollAffixes(affixCount, seed);
    seed = affixRoll.nextSeed;
    const task = {
        blueprintId: blueprint.id,
        remainingMs: blueprint.forgeTimeMs,
        totalMs: blueprint.forgeTimeMs,
        rarity: rarityRoll.rarity,
        affixes: affixRoll.affixes
    };
    return {
        ...state,
        seed,
        resources: spendResources(state.resources, blueprint.cost),
        forgingQueue: {
            ...queue,
            active: task
        }
    };
}
export function progressForging(state, dtMs) {
    const queue = state.forgingQueue ?? createEmptyForgingQueue();
    const active = queue.active;
    if (!active || dtMs <= 0) {
        if (queue !== state.forgingQueue) {
            return {
                ...state,
                forgingQueue: queue
            };
        }
        return state;
    }
    const nextRemaining = Math.max(0, active.remainingMs - dtMs);
    if (nextRemaining > 0) {
        return {
            ...state,
            forgingQueue: {
                ...queue,
                active: {
                    ...active,
                    remainingMs: nextRemaining
                }
            }
        };
    }
    const inventory = state.equipmentInventory;
    const instanceId = `${inventory.nextId}`;
    const blueprint = findEquipmentBlueprint(active.blueprintId);
    const newItem = {
        instanceId,
        blueprintId: blueprint.id,
        slot: blueprint.slot,
        rarity: active.rarity,
        affixes: active.affixes
    };
    return {
        ...state,
        equipmentInventory: {
            items: { ...inventory.items, [instanceId]: newItem },
            nextId: inventory.nextId + 1
        },
        forgingQueue: {
            active: null,
            lastFinished: newItem
        }
    };
}
export function disassembleItem(state, instanceId) {
    const inventory = state.equipmentInventory;
    const target = inventory.items[instanceId];
    if (!target)
        return state;
    const blueprint = findEquipmentBlueprint(target.blueprintId);
    const refundMultiplier = DISASSEMBLE_REFUND_MULTIPLIER[target.rarity] ?? 0;
    const refundOre = Math.round(blueprint.cost.ore * refundMultiplier);
    const nextItems = { ...inventory.items };
    delete nextItems[instanceId];
    const updatedEquipped = { ...state.equipped };
    Object.keys(updatedEquipped).forEach((slot) => {
        if (updatedEquipped[slot] === instanceId) {
            updatedEquipped[slot] = null;
        }
    });
    const nextQueue = state.forgingQueue?.lastFinished?.instanceId === instanceId
        ? { ...(state.forgingQueue ?? createEmptyForgingQueue()), lastFinished: null }
        : state.forgingQueue;
    const updatedState = {
        ...state,
        equipmentInventory: {
            ...inventory,
            items: nextItems
        },
        equipped: updatedEquipped,
        resources: addResources(state.resources, { ore: refundOre }),
        forgingQueue: nextQueue ?? createEmptyForgingQueue()
    };
    return calculateProduction(updatedState);
}
