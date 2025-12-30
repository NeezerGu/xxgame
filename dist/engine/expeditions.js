import { EXPEDITION_DEFINITIONS, findExpeditionDefinition } from "./data/expeditions";
import { REALM_DEFINITIONS } from "./data/realms";
import { nextRandom } from "./utils/rng";
import { addResources } from "./resources";
import { AFFIX_DEFINITIONS, FORGING_AFFIX_COUNT, FORGING_RARITY_WEIGHTS, findEquipmentBlueprint } from "./data/equipment";
import { calculateProduction } from "./state";
const EVENT_INTERVAL_MS = 10000;
export function createInitialExpeditionState(currentRealm) {
    return {
        active: null,
        lastResult: null,
        unlockedExpeditions: initializeUnlockedExpeditions(currentRealm)
    };
}
export function initializeUnlockedExpeditions(currentRealm) {
    const map = {};
    for (const def of EXPEDITION_DEFINITIONS) {
        if (!def.requiredRealm) {
            map[def.id] = true;
        }
        else {
            map[def.id] = currentRealm ? isRealmAtLeast(currentRealm, def.requiredRealm) : false;
        }
    }
    return map;
}
export function refreshExpeditionUnlocks(state, realmId) {
    const nextUnlocked = { ...state.expeditions.unlockedExpeditions };
    for (const def of EXPEDITION_DEFINITIONS) {
        if (!def.requiredRealm) {
            nextUnlocked[def.id] = true;
            continue;
        }
        if (isRealmAtLeast(realmId, def.requiredRealm)) {
            nextUnlocked[def.id] = true;
        }
    }
    if (sameUnlocks(nextUnlocked, state.expeditions.unlockedExpeditions)) {
        return state;
    }
    return {
        ...state,
        expeditions: {
            ...state.expeditions,
            unlockedExpeditions: nextUnlocked
        }
    };
}
export function startExpedition(state, expeditionId, discipleId) {
    if (state.expeditions.active) {
        return state;
    }
    const def = findExpeditionDefinition(expeditionId);
    if (!state.expeditions.unlockedExpeditions[expeditionId]) {
        return state;
    }
    if (def.requiredRealm && !isRealmAtLeast(state.realm.current, def.requiredRealm)) {
        return state;
    }
    const rosterValid = !discipleId || state.disciples.roster.some((d) => d.id === discipleId);
    if (!rosterValid) {
        return state;
    }
    const active = {
        expeditionId,
        remainingMs: def.durationMs,
        totalMs: def.durationMs,
        log: [],
        discipleId: discipleId ?? null,
        nextEventMs: Math.min(EVENT_INTERVAL_MS, def.durationMs),
        rewardRollsRemaining: def.rewardRolls
    };
    return {
        ...state,
        expeditions: {
            ...state.expeditions,
            active,
            lastResult: null
        }
    };
}
export function progressExpedition(state, dtMs) {
    const active = state.expeditions.active;
    if (!active || dtMs <= 0) {
        return state;
    }
    let nextState = state;
    let nextActive = { ...active };
    let nextSeed = state.seed;
    let remainingDt = dtMs;
    while (remainingDt > 0 && nextActive.remainingMs > 0) {
        if (nextActive.nextEventMs > remainingDt) {
            nextActive.remainingMs = Math.max(0, nextActive.remainingMs - remainingDt);
            nextActive.nextEventMs = Math.max(0, nextActive.nextEventMs - remainingDt);
            remainingDt = 0;
            break;
        }
        // advance to event time
        const step = nextActive.nextEventMs;
        nextActive.remainingMs = Math.max(0, nextActive.remainingMs - step);
        remainingDt -= step;
        nextActive.nextEventMs = 0;
        if (nextActive.remainingMs > 0) {
            const eventResult = applyExpeditionEvent(nextState, nextActive, nextSeed);
            nextState = eventResult.state;
            nextActive = eventResult.active;
            nextSeed = eventResult.seed;
        }
    }
    if (nextActive.remainingMs > 0) {
        return {
            ...nextState,
            seed: nextSeed,
            expeditions: {
                ...nextState.expeditions,
                active: nextActive
            }
        };
    }
    const completion = resolveExpedition(nextState, nextActive, nextSeed);
    return calculateProduction({
        ...completion.state,
        seed: completion.seed,
        expeditions: {
            ...nextState.expeditions,
            active: null,
            lastResult: completion.result
        }
    });
}
function resolveExpedition(state, active, seed) {
    const def = findExpeditionDefinition(active.expeditionId);
    const rewards = [];
    let nextSeed = seed;
    let nextState = state;
    const rolls = Math.max(1, active.rewardRollsRemaining);
    for (let i = 0; i < rolls; i += 1) {
        const rewardRoll = pickReward(def.rewardTable, nextSeed);
        nextSeed = rewardRoll.nextSeed;
        let reward = rewardRoll.reward;
        if (reward.type === "resource") {
            nextState = {
                ...nextState,
                resources: addResources(nextState.resources, { [reward.resourceId]: reward.amount })
            };
        }
        else if (reward.type === "recipe") {
            if (!nextState.realm.unlockedRecipeIds.includes(reward.recipeId)) {
                nextState = {
                    ...nextState,
                    realm: {
                        ...nextState.realm,
                        unlockedRecipeIds: [...nextState.realm.unlockedRecipeIds, reward.recipeId]
                    }
                };
            }
        }
        else if (reward.type === "equipment") {
            const equipmentResult = grantEquipmentReward(nextState, reward.blueprintId, nextSeed);
            nextState = equipmentResult.state;
            nextSeed = equipmentResult.seed;
            reward = equipmentResult.reward;
        }
        rewards.push(reward);
    }
    const resultLog = [...active.log, "expeditions.event.complete"];
    const result = {
        expeditionId: active.expeditionId,
        rewards,
        log: resultLog
    };
    return { state: nextState, result, seed: nextSeed };
}
function pickReward(table, seed) {
    const totalWeight = table.reduce((sum, entry) => sum + entry.weight, 0);
    const roll = nextRandom(seed);
    let acc = 0;
    for (const entry of table) {
        acc += entry.weight;
        if (roll.value * totalWeight <= acc) {
            return { reward: normalizeReward(entry), nextSeed: roll.nextSeed };
        }
    }
    return { reward: normalizeReward(table[table.length - 1]), nextSeed: roll.nextSeed };
}
function normalizeReward(entry) {
    if (entry.type === "resource") {
        return { type: "resource", resourceId: entry.resourceId, amount: entry.amount };
    }
    if (entry.type === "recipe") {
        return { type: "recipe", recipeId: entry.recipeId };
    }
    return { type: "equipment", blueprintId: entry.blueprintId, instanceId: "", rarity: "common" };
}
function rollEquipmentRarity(seed) {
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
function rollEquipmentAffixes(count, seed) {
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
function grantEquipmentReward(state, blueprintId, seed) {
    const blueprint = findEquipmentBlueprint(blueprintId);
    const rarityRoll = rollEquipmentRarity(seed);
    const affixCount = FORGING_AFFIX_COUNT[rarityRoll.rarity];
    const affixRoll = rollEquipmentAffixes(affixCount, rarityRoll.nextSeed);
    const inventory = state.equipmentInventory;
    const instanceId = `${inventory.nextId}`;
    const newItem = {
        instanceId,
        blueprintId: blueprint.id,
        slot: blueprint.slot,
        rarity: rarityRoll.rarity,
        affixes: affixRoll.affixes
    };
    return {
        reward: { type: "equipment", blueprintId: blueprint.id, instanceId, rarity: rarityRoll.rarity },
        seed: affixRoll.nextSeed,
        state: {
            ...state,
            equipmentInventory: {
                items: { ...inventory.items, [instanceId]: newItem },
                nextId: inventory.nextId + 1
            }
        }
    };
}
function applyExpeditionEvent(state, active, seed) {
    const eventPool = [
        {
            logKey: "expeditions.event.shortcut",
            apply: (s, a) => ({
                state: s,
                active: {
                    ...a,
                    remainingMs: Math.max(0, a.remainingMs - 5000)
                }
            })
        },
        {
            logKey: "expeditions.event.detour",
            apply: (s, a) => ({
                state: s,
                active: {
                    ...a,
                    remainingMs: a.remainingMs + 5000
                }
            })
        },
        {
            logKey: "expeditions.event.cache",
            apply: (s, a) => ({
                state: s,
                active: {
                    ...a,
                    rewardRollsRemaining: a.rewardRollsRemaining + 1
                }
            })
        },
        {
            logKey: "expeditions.event.steady",
            apply: (s, a) => ({ state: s, active: a })
        }
    ];
    const roll = nextRandom(seed);
    const index = Math.floor(roll.value * eventPool.length);
    const outcome = eventPool[index] ?? eventPool[eventPool.length - 1];
    const discipleRole = active.discipleId
        ? state.disciples.roster.find((d) => d.id === active.discipleId)?.role
        : null;
    const mitigation = discipleRole === "contractClerk" || discipleRole === "gatherer";
    const amplified = discipleRole === "smith" || discipleRole === "alchemist";
    let nextActive = { ...active, log: [...active.log, outcome.logKey] };
    let nextState = state;
    const applied = outcome.apply(nextState, nextActive);
    nextState = applied.state;
    nextActive = applied.active;
    if (mitigation && outcome.logKey === "expeditions.event.detour") {
        nextActive.remainingMs = Math.max(0, nextActive.remainingMs - 2000);
        nextActive.log = [...nextActive.log, "expeditions.event.mitigated"];
    }
    if (amplified && outcome.logKey === "expeditions.event.cache") {
        nextActive.rewardRollsRemaining += 1;
        nextActive.log = [...nextActive.log, "expeditions.event.boosted"];
    }
    nextActive.nextEventMs = EVENT_INTERVAL_MS;
    return { state: nextState, active: nextActive, seed: roll.nextSeed };
}
function isRealmAtLeast(current, target) {
    const order = REALM_DEFINITIONS.map((r) => r.id);
    const currentIndex = order.indexOf(current);
    const targetIndex = order.indexOf(target);
    if (targetIndex === -1)
        return true;
    if (currentIndex === -1)
        return false;
    return currentIndex >= targetIndex;
}
function sameUnlocks(a, b) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
        if (a[key] !== b[key]) {
            return false;
        }
    }
    return true;
}
