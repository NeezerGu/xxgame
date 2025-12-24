import { BASE_CONTRACT_SLOTS } from "./data/constants";
import { CONTRACT_DEFINITIONS, findContractDefinition, type ContractId } from "./data/contracts";
import type { ContractsState, ContractSlot, GameState } from "./types";

const DEFAULT_CONTRACT_SLOTS = BASE_CONTRACT_SLOTS;

export function createInitialContractsState(maxSlots: number = DEFAULT_CONTRACT_SLOTS): ContractsState {
  const desiredSlots = Math.min(maxSlots, CONTRACT_DEFINITIONS.length);
  const available = CONTRACT_DEFINITIONS.slice(0, desiredSlots);
  const slots: ContractSlot[] = available.map((def) => ({
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
    maxSlots: desiredSlots
  };
}

export function acceptContract(state: GameState, contractId: ContractId): GameState {
  const slotIndex = state.contracts.slots.findIndex((slot) => slot.id === contractId);
  if (slotIndex === -1) {
    return state;
  }

  const slot = state.contracts.slots[slotIndex];
  if (slot.status !== "idle") {
    return state;
  }

  const updatedSlot: ContractSlot = {
    ...slot,
    status: "active",
    elapsedMs: 0
  };

  return {
    ...state,
    contracts: replaceSlot(state.contracts, slotIndex, updatedSlot)
  };
}

export function progressContracts(state: GameState, dtMs: number, contractSpeedMult: number = 1): GameState {
  if (dtMs <= 0) return state;

  const effectiveDtMs = dtMs * contractSpeedMult;

  let changed = false;
  const updatedSlots = state.contracts.slots.map((slot) => {
    if (slot.status !== "active") return slot;

    const nextElapsed = Math.min(slot.elapsedMs + effectiveDtMs, slot.durationMs);
    const isCompleted = nextElapsed >= slot.durationMs;
    changed = changed || nextElapsed !== slot.elapsedMs || isCompleted !== (slot.status === "completed");

    return {
      ...slot,
      elapsedMs: nextElapsed,
      status: isCompleted ? "completed" : "active"
    };
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

  const reward = slot.reward;
  const updatedResources = {
    ...state.resources,
    essence: state.resources.essence + (reward.essence ?? 0),
    research: state.resources.research + (reward.research ?? 0),
    insight: state.resources.insight + (reward.insight ?? 0),
    reputation: state.resources.reputation + (reward.reputation ?? 0)
  };

  const resetSlot: ContractSlot = {
    ...slot,
    elapsedMs: 0,
    status: "idle"
  };

  return {
    ...state,
    resources: updatedResources,
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
  const currentSlots = state.contracts.slots.length;
  if (clampedDesired <= currentSlots && clampedDesired <= state.contracts.maxSlots) {
    return state;
  }

  const targetSlots = Math.max(clampedDesired, currentSlots);
  const needed = Math.max(0, targetSlots - currentSlots);

  const newSlots: ContractSlot[] = CONTRACT_DEFINITIONS.slice(currentSlots, targetSlots).map((def) => ({
    id: def.id,
    nameKey: def.nameKey,
    descriptionKey: def.descriptionKey,
    durationMs: def.durationMs,
    reward: def.reward,
    elapsedMs: 0,
    status: "idle"
  }));

  return {
    ...state,
    contracts: {
      ...state.contracts,
      maxSlots: Math.max(state.contracts.maxSlots, targetSlots),
      slots: [...state.contracts.slots, ...newSlots]
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
