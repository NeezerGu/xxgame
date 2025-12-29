import { BASE_CONTRACT_SLOTS } from "./data/constants";
import { CONTRACT_DEFINITIONS, findContractDefinition } from "./data/contracts";
import { addResources, getResource, spendResources } from "./resources";
const DEFAULT_CONTRACT_SLOTS = BASE_CONTRACT_SLOTS;
export function createInitialContractsState(maxSlots = DEFAULT_CONTRACT_SLOTS) {
    const slots = CONTRACT_DEFINITIONS.map((def) => ({
        id: def.id,
        nameKey: def.nameKey,
        descriptionKey: def.descriptionKey,
        durationMs: def.durationMs,
        reward: def.reward,
        elapsedMs: 0,
        status: "idle"
    }));
    return {
        slots,
        maxSlots: Math.min(maxSlots, CONTRACT_DEFINITIONS.length)
    };
}
export function acceptContract(state, contractId) {
    const slotIndex = state.contracts.slots.findIndex((slot) => slot.id === contractId);
    if (slotIndex === -1) {
        return state;
    }
    const slot = state.contracts.slots[slotIndex];
    const activeSlots = state.contracts.slots.filter((s) => s.status === "active").length;
    const def = findContractDefinition(contractId);
    const requiredReputation = def.requiredReputation ?? 0;
    const requiredEssencePerSecond = def.requiredEssencePerSecond ?? 0;
    const acceptCostEssence = def.acceptCostEssence ?? 0;
    if (!state.realm.unlockedContractIds.includes(contractId)) {
        return state;
    }
    if (getResource(state.resources, "reputation") < requiredReputation) {
        return state;
    }
    if (state.production.perSecond < requiredEssencePerSecond) {
        return state;
    }
    if (getResource(state.resources, "essence") < acceptCostEssence) {
        return state;
    }
    if (activeSlots >= state.contracts.maxSlots) {
        return state;
    }
    if (slot.status !== "idle") {
        return state;
    }
    const updatedSlot = {
        ...slot,
        status: "active",
        elapsedMs: 0
    };
    return {
        ...state,
        resources: spendResources(state.resources, { essence: acceptCostEssence }),
        contracts: replaceSlot(state.contracts, slotIndex, updatedSlot)
    };
}
export function progressContracts(state, dtMs, contractSpeedMult = 1) {
    if (dtMs <= 0)
        return state;
    const effectiveDtMs = dtMs * contractSpeedMult;
    let changed = false;
    const updatedSlots = state.contracts.slots.map((slot) => {
        if (slot.status !== "active")
            return slot;
        const nextElapsed = Math.min(slot.elapsedMs + effectiveDtMs, slot.durationMs);
        const isCompleted = nextElapsed >= slot.durationMs;
        const nextStatus = isCompleted ? "completed" : "active";
        if (nextElapsed === slot.elapsedMs && slot.status === nextStatus) {
            return slot;
        }
        changed = true;
        const updatedSlot = {
            ...slot,
            elapsedMs: nextElapsed,
            status: nextStatus
        };
        return updatedSlot;
    });
    if (!changed)
        return state;
    return {
        ...state,
        contracts: {
            ...state.contracts,
            slots: updatedSlots
        }
    };
}
export function completeContract(state, contractId) {
    const slotIndex = state.contracts.slots.findIndex((slot) => slot.id === contractId);
    if (slotIndex === -1) {
        return state;
    }
    const slot = state.contracts.slots[slotIndex];
    if (slot.status !== "completed") {
        return state;
    }
    const reward = slot.reward;
    const updatedResources = addResources(state.resources, reward);
    const resetSlot = {
        ...slot,
        elapsedMs: 0,
        status: "idle"
    };
    return {
        ...state,
        resources: updatedResources,
        runStats: {
            ...state.runStats,
            essenceEarned: state.runStats.essenceEarned + (reward.essence ?? 0),
            contractsCompleted: state.runStats.contractsCompleted + 1
        },
        contracts: replaceSlot(state.contracts, slotIndex, resetSlot)
    };
}
export function getContractProgress(slot) {
    if (slot.durationMs === 0)
        return 1;
    return Math.min(1, slot.elapsedMs / slot.durationMs);
}
export function refreshContractFromDefinition(slot) {
    const def = findContractDefinition(slot.id);
    return {
        id: def.id,
        nameKey: def.nameKey,
        descriptionKey: def.descriptionKey,
        durationMs: def.durationMs,
        reward: def.reward,
        elapsedMs: 0,
        status: "idle"
    };
}
export function ensureContractSlotCount(state, desiredMaxSlots) {
    const clampedDesired = Math.min(desiredMaxSlots, CONTRACT_DEFINITIONS.length);
    const withAllDefinitions = ensureAllDefinitionsPresent(state.contracts);
    if (clampedDesired <= withAllDefinitions.maxSlots) {
        if (withAllDefinitions === state.contracts) {
            return state;
        }
        return {
            ...state,
            contracts: withAllDefinitions
        };
    }
    return {
        ...state,
        contracts: {
            ...withAllDefinitions,
            maxSlots: Math.max(withAllDefinitions.maxSlots, clampedDesired)
        }
    };
}
function replaceSlot(contracts, index, slot) {
    const nextSlots = contracts.slots.slice();
    nextSlots[index] = slot;
    return {
        ...contracts,
        slots: nextSlots
    };
}
function ensureAllDefinitionsPresent(contracts) {
    const existingIds = new Set(contracts.slots.map((slot) => slot.id));
    const missingDefs = CONTRACT_DEFINITIONS.filter((def) => !existingIds.has(def.id));
    if (missingDefs.length === 0) {
        return contracts;
    }
    const newSlots = missingDefs.map((def) => ({
        id: def.id,
        nameKey: def.nameKey,
        descriptionKey: def.descriptionKey,
        durationMs: def.durationMs,
        reward: def.reward,
        elapsedMs: 0,
        status: "idle"
    }));
    return {
        ...contracts,
        slots: [...contracts.slots, ...newSlots]
    };
}
