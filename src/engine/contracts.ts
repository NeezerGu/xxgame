import { BASE_CONTRACT_SLOTS } from "./data/constants";
import { CONTRACT_DEFINITIONS, findContractDefinition, type ContractId } from "./data/contracts";
import type { ContractsState, ContractSlot, GameState } from "./types";
import { addResources, getResource, spendResources } from "./resources";
import { getFacilityModifiers } from "./facilities";

const DEFAULT_CONTRACT_SLOTS = BASE_CONTRACT_SLOTS;

export function createInitialContractsState(maxSlots: number = DEFAULT_CONTRACT_SLOTS): ContractsState {
  const slots: ContractSlot[] = CONTRACT_DEFINITIONS.map((def) => ({
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

export function acceptContract(state: GameState, contractId: ContractId): GameState {
  const slotIndex = state.contracts.slots.findIndex((slot) => slot.id === contractId);
  if (slotIndex === -1) {
    return state;
  }

  const slot = state.contracts.slots[slotIndex];
  const def = findContractDefinition(contractId);
  if (!canAcceptContract(state, contractId)) {
    return state;
  }

  const updatedSlot: ContractSlot = {
    ...slot,
    status: "active",
    elapsedMs: 0
  };

  const facilityModifiers = getFacilityModifiers(state);
  const cost = getDiscountedAcceptCost(def.acceptCostEssence ?? 0, facilityModifiers.contractCostDiscount);

  return {
    ...state,
    resources: spendResources(state.resources, { essence: cost }),
    contracts: replaceSlot(state.contracts, slotIndex, updatedSlot)
  };
}

export function canAcceptContract(state: GameState, contractId: ContractId): boolean {
  const slotIndex = state.contracts.slots.findIndex((slot) => slot.id === contractId);
  if (slotIndex === -1) {
    return false;
  }
  const slot = state.contracts.slots[slotIndex];
  const activeSlots = state.contracts.slots.filter((s) => s.status === "active").length;
  const def = findContractDefinition(contractId);
  const requiredReputation = def.requiredReputation ?? 0;
  const requiredEssencePerSecond = def.requiredEssencePerSecond ?? 0;
  const facilityModifiers = getFacilityModifiers(state);
  const acceptCostEssence = getDiscountedAcceptCost(def.acceptCostEssence ?? 0, facilityModifiers.contractCostDiscount);

  if (!state.realm.unlockedContractIds.includes(contractId)) {
    return false;
  }
  if (getResource(state.resources, "reputation") < requiredReputation) {
    return false;
  }
  if (state.production.perSecond < requiredEssencePerSecond) {
    return false;
  }
  if (getResource(state.resources, "essence") < acceptCostEssence) {
    return false;
  }
  if (activeSlots >= state.contracts.maxSlots) {
    return false;
  }
  if (slot.status !== "idle") {
    return false;
  }

  return true;
}

export function progressContracts(state: GameState, dtMs: number, contractSpeedMult: number = 1): GameState {
  if (dtMs <= 0) return state;

  const effectiveDtMs = dtMs * contractSpeedMult;

  let changed = false;
  const updatedSlots = state.contracts.slots.map((slot) => {
    if (slot.status !== "active") return slot;

    const nextElapsed = Math.min(slot.elapsedMs + effectiveDtMs, slot.durationMs);
    const isCompleted = nextElapsed >= slot.durationMs;
    const nextStatus: ContractSlot["status"] = isCompleted ? "completed" : "active";

    if (nextElapsed === slot.elapsedMs && slot.status === nextStatus) {
      return slot;
    }

    changed = true;
    const updatedSlot: ContractSlot = {
      ...slot,
      elapsedMs: nextElapsed,
      status: nextStatus
    };
    return updatedSlot;
  });

  if (!changed) return state;

  return {
    ...state,
    contracts: {
      ...state.contracts,
      slots: updatedSlots
    }
  };
}

export function completeContract(state: GameState, contractId: ContractId): GameState {
  const slotIndex = state.contracts.slots.findIndex((slot) => slot.id === contractId);
  if (slotIndex === -1) {
    return state;
  }

  const slot = state.contracts.slots[slotIndex];
  if (slot.status !== "completed") {
    return state;
  }

  const facilityModifiers = getFacilityModifiers(state);
  const reward = applyReputationModifier(slot.reward, facilityModifiers.reputationGainMult);
  const updatedResources = addResources(state.resources, reward);

  const resetSlot: ContractSlot = {
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

export function getContractProgress(slot: ContractSlot): number {
  if (slot.durationMs === 0) return 1;
  return Math.min(1, slot.elapsedMs / slot.durationMs);
}

export function refreshContractFromDefinition(slot: ContractSlot): ContractSlot {
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

export function ensureContractSlotCount(state: GameState, desiredMaxSlots: number): GameState {
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

function replaceSlot(contracts: ContractsState, index: number, slot: ContractSlot): ContractsState {
  const nextSlots = contracts.slots.slice();
  nextSlots[index] = slot;
  return {
    ...contracts,
    slots: nextSlots
  };
}

function getDiscountedAcceptCost(cost: number, discount: number): number {
  const discounted = Math.floor(cost * Math.max(0, 1 - discount));
  return Math.max(0, discounted);
}

function applyReputationModifier(reward: ContractSlot["reward"], reputationGainMult: number): ContractSlot["reward"] {
  if (!reward.reputation) {
    return reward;
  }
  const scaledReputation = Math.floor(reward.reputation * reputationGainMult);
  return { ...reward, reputation: scaledReputation };
}

function ensureAllDefinitionsPresent(contracts: ContractsState): ContractsState {
  const existingIds = new Set(contracts.slots.map((slot) => slot.id));
  const missingDefs = CONTRACT_DEFINITIONS.filter((def) => !existingIds.has(def.id));

  if (missingDefs.length === 0) {
    return contracts;
  }

  const newSlots: ContractSlot[] = missingDefs.map((def) => ({
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
