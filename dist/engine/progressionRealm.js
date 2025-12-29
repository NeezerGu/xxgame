import { ensureContractSlotCount } from "./contracts";
import { REALM_DEFINITIONS } from "./data/realms";
import { BASE_CONTRACT_SLOTS } from "./data/constants";
import { getResearchModifiers } from "./research";
import { getResource } from "./resources";
function mergeUnique(...arrays) {
    const merged = arrays.flat().filter((item) => Boolean(item));
    return Array.from(new Set(merged));
}
function accumulateUnlocks(targetRealmId) {
    const unlockTabs = [];
    const unlockContractIds = [];
    const unlockResearchIds = [];
    const unlockRecipeIds = [];
    for (const def of REALM_DEFINITIONS) {
        unlockTabs.push(...(def.unlocks.unlockTabs ?? []));
        unlockContractIds.push(...(def.unlocks.unlockContractIds ?? []));
        unlockResearchIds.push(...(def.unlocks.unlockResearchIds ?? []));
        unlockRecipeIds.push(...(def.unlocks.unlockRecipeIds ?? []));
        if (def.id === targetRealmId)
            break;
    }
    return {
        unlockTabs: Array.from(new Set(unlockTabs)),
        unlockContractIds: Array.from(new Set(unlockContractIds)),
        unlockResearchIds: Array.from(new Set(unlockResearchIds)),
        unlockRecipeIds: Array.from(new Set(unlockRecipeIds))
    };
}
export function getInitialRealmId() {
    return REALM_DEFINITIONS[0].id;
}
export function buildRealmState(targetRealmId = getInitialRealmId(), existing) {
    const targetDef = REALM_DEFINITIONS.find((def) => def.id === targetRealmId) ?? REALM_DEFINITIONS[0];
    const accumulated = accumulateUnlocks(targetDef.id);
    return {
        current: targetDef.id,
        unlockedTabs: mergeUnique(accumulated.unlockTabs, existing?.unlockedTabs),
        unlockedContractIds: mergeUnique(accumulated.unlockContractIds, existing?.unlockedContractIds),
        unlockedResearchIds: mergeUnique(accumulated.unlockResearchIds, existing?.unlockedResearchIds),
        unlockedRecipeIds: mergeUnique(accumulated.unlockRecipeIds, existing?.unlockedRecipeIds)
    };
}
export function getCurrentRealm(state) {
    const def = REALM_DEFINITIONS.find((item) => item.id === state.realm.current) ?? REALM_DEFINITIONS[0];
    return def;
}
export function getNextRealm(state) {
    const currentIndex = REALM_DEFINITIONS.findIndex((item) => item.id === state.realm.current);
    if (currentIndex === -1 || currentIndex >= REALM_DEFINITIONS.length - 1) {
        return null;
    }
    return REALM_DEFINITIONS[currentIndex + 1];
}
export function canBreakthrough(state) {
    const next = getNextRealm(state);
    if (!next)
        return false;
    const requirement = next.breakthroughRequirement;
    if (requirement.essenceEarned !== undefined && state.runStats.essenceEarned < requirement.essenceEarned) {
        return false;
    }
    if (requirement.contractsCompleted !== undefined &&
        state.runStats.contractsCompleted < requirement.contractsCompleted) {
        return false;
    }
    if (requirement.reputation !== undefined && getResource(state.resources, "reputation") < requirement.reputation) {
        return false;
    }
    return true;
}
function applyUnlocks(state, unlocks) {
    const updatedRealm = {
        current: state.realm.current,
        unlockedTabs: mergeUnique(state.realm.unlockedTabs, unlocks.unlockTabs),
        unlockedContractIds: mergeUnique(state.realm.unlockedContractIds, unlocks.unlockContractIds),
        unlockedResearchIds: mergeUnique(state.realm.unlockedResearchIds, unlocks.unlockResearchIds),
        unlockedRecipeIds: mergeUnique(state.realm.unlockedRecipeIds, unlocks.unlockRecipeIds)
    };
    const researchModifiers = getResearchModifiers(state);
    const desiredSlots = BASE_CONTRACT_SLOTS + researchModifiers.contractSlotsBonus;
    const withContracts = ensureContractSlotCount(state, desiredSlots);
    return {
        ...withContracts,
        realm: updatedRealm
    };
}
export function breakthrough(state) {
    if (!canBreakthrough(state)) {
        return state;
    }
    const next = getNextRealm(state);
    if (!next) {
        return state;
    }
    const accumulated = accumulateUnlocks(next.id);
    const updated = applyUnlocks({
        ...state,
        realm: {
            ...state.realm,
            current: next.id
        }
    }, accumulated);
    return updated;
}
