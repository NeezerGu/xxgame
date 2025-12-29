import { CONTRACT_DEFINITIONS } from "./data/contracts";
import {
  DISCIPLE_ARCHETYPES,
  DISCIPLE_RECRUIT_COST,
  DISCIPLE_ROLE_EFFECTS,
  findDiscipleArchetype,
  type DiscipleRole
} from "./data/disciples";
import type { AutomationState, ContractSlot, DiscipleInstance, DisciplesState, GameState } from "./types";
import { acceptContract, canAcceptContract, completeContract } from "./contracts";
import { addResources, canAfford, spendResources } from "./resources";
import { computeContractScore, DEFAULT_CONTRACT_WEIGHTS } from "./contractScore";

export interface DiscipleModifiers {
  autoClaimContracts: boolean;
  autoAcceptContracts: boolean;
  forgingSpeedMult: number;
  alchemySpeedMult: number;
  herbPerSecond: number;
  orePerSecond: number;
}

export function createInitialDisciplesState(): DisciplesState {
  return {
    roster: [],
    nextId: 1,
    nextArchetypeIndex: 0
  };
}

export function createInitialAutomationState(): AutomationState {
  return {
    autoAcceptContracts: false,
    autoClaimContracts: false
  };
}

export function recruitDisciple(state: GameState): GameState {
  if (!canAfford(state.resources, DISCIPLE_RECRUIT_COST)) {
    return state;
  }

  const archetype = DISCIPLE_ARCHETYPES[state.disciples.nextArchetypeIndex % DISCIPLE_ARCHETYPES.length];
  const nextId = `${state.disciples.nextId}`;
  const newDisciple: DiscipleInstance = {
    id: nextId,
    archetypeId: archetype.id,
    aptitude: archetype.baseAptitude,
    role: null
  };

  const next: GameState = {
    ...state,
    resources: spendResources(state.resources, DISCIPLE_RECRUIT_COST),
    disciples: {
      roster: [...state.disciples.roster, newDisciple],
      nextId: state.disciples.nextId + 1,
      nextArchetypeIndex: (state.disciples.nextArchetypeIndex + 1) % DISCIPLE_ARCHETYPES.length
    }
  };

  return syncAutomation(next);
}

export function assignDiscipleRole(state: GameState, discipleId: string, role: DiscipleRole | null): GameState {
  const index = state.disciples.roster.findIndex((disciple) => disciple.id === discipleId);
  if (index === -1) {
    return state;
  }
  const current = state.disciples.roster[index];
  if (role && !findDiscipleArchetype(current.archetypeId).rolesAllowed.includes(role)) {
    return state;
  }
  if (current.role === role) {
    return state;
  }

  const nextRoster = state.disciples.roster.slice();
  nextRoster[index] = { ...current, role };

  return syncAutomation({
    ...state,
    disciples: {
      ...state.disciples,
      roster: nextRoster
    }
  });
}

export function getDiscipleModifiers(state: GameState): DiscipleModifiers {
  return state.disciples.roster.reduce<DiscipleModifiers>(
    (acc, disciple) => {
      if (!disciple.role) return acc;
      const effect = DISCIPLE_ROLE_EFFECTS[disciple.role];
      if (!effect) return acc;

      if (effect.autoClaim) acc.autoClaimContracts = true;
      if (effect.autoAccept) acc.autoAcceptContracts = true;
      if (effect.forgingSpeedPerAptitude) {
        acc.forgingSpeedMult += effect.forgingSpeedPerAptitude * disciple.aptitude;
      }
      if (effect.alchemySpeedPerAptitude) {
        acc.alchemySpeedMult += effect.alchemySpeedPerAptitude * disciple.aptitude;
      }
      if (effect.herbPerSecondPerAptitude) {
        acc.herbPerSecond += effect.herbPerSecondPerAptitude * disciple.aptitude;
      }
      if (effect.orePerSecondPerAptitude) {
        acc.orePerSecond += effect.orePerSecondPerAptitude * disciple.aptitude;
      }
      return acc;
    },
    {
      autoClaimContracts: false,
      autoAcceptContracts: false,
      forgingSpeedMult: 1,
      alchemySpeedMult: 1,
      herbPerSecond: 0,
      orePerSecond: 0
    }
  );
}

export function applyDiscipleGathering(state: GameState, dtMs: number, modifiers: DiscipleModifiers): GameState {
  const deltaSeconds = dtMs / 1000;
  const herbGain = modifiers.herbPerSecond * deltaSeconds;
  const oreGain = modifiers.orePerSecond * deltaSeconds;
  if (herbGain === 0 && oreGain === 0) {
    return state;
  }
  return {
    ...state,
    resources: addResources(state.resources, {
      herb: herbGain,
      ore: oreGain
    })
  };
}

export function runDiscipleAutomation(state: GameState, modifiers: DiscipleModifiers): GameState {
  let next = state;
  if (modifiers.autoClaimContracts) {
    next = claimCompletedContracts(next);
  }
  if (modifiers.autoAcceptContracts) {
    next = acceptTopContracts(next);
  }
  return syncAutomation(next);
}

export function syncAutomation(state: GameState): GameState {
  const modifiers = getDiscipleModifiers(state);
  if (
    state.automation.autoAcceptContracts === modifiers.autoAcceptContracts &&
    state.automation.autoClaimContracts === modifiers.autoClaimContracts
  ) {
    return state;
  }

  return {
    ...state,
    automation: {
      autoAcceptContracts: modifiers.autoAcceptContracts,
      autoClaimContracts: modifiers.autoClaimContracts
    }
  };
}

function claimCompletedContracts(state: GameState): GameState {
  let next = state;
  for (const slot of state.contracts.slots) {
    if (slot.status !== "completed") continue;
    const updated = completeContract(next, slot.id);
    if (updated !== next) {
      next = updated;
    }
  }
  return next;
}

function acceptTopContracts(state: GameState): GameState {
  let next = state;
  while (true) {
    const candidates = CONTRACT_DEFINITIONS.flatMap((def) => {
      const slot = findSlot(next, def.id);
      if (!slot || slot.status !== "idle") return [];
      if (!canAcceptContract(next, def.id)) return [];
      return [
        {
          def,
          score: computeContractScore({
            rewardResearch: def.reward.research,
            rewardReputation: def.reward.reputation,
            rewardEssence: def.reward.essence,
            rewardHerb: def.reward.herb,
            rewardOre: def.reward.ore,
            acceptCostEssence: def.acceptCostEssence,
            durationMs: def.durationMs,
            weights: DEFAULT_CONTRACT_WEIGHTS
          })
        }
      ];
    });

    if (candidates.length === 0) {
      return next;
    }

    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.def.id.localeCompare(b.def.id);
    });

    const chosen = candidates[0];
    const updated = acceptContract(next, chosen.def.id);
    if (updated === next) {
      return next;
    }
    next = updated;
  }
}

function findSlot(state: GameState, contractId: string): ContractSlot | undefined {
  return state.contracts.slots.find((slot) => slot.id === contractId);
}
