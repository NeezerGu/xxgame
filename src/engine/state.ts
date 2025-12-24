import { findUpgrade } from "./data/upgrades";
import type { GameState } from "./types";
import { initializeUpgradesRecord } from "./utils";
import { createInitialContractsState, refreshContractFromDefinition } from "./contracts";

export const BASE_PRODUCTION = 1;

export function calculateProduction(state: GameState): GameState {
  const additiveBonus = Object.entries(state.upgrades).reduce((total, [id, level]) => {
    const upgrade = findUpgrade(id as Parameters<typeof findUpgrade>[0]);
    if (upgrade.effect.type === "add") {
      return total + upgrade.effect.amount * level;
    }
    return total;
  }, 0);

  const multiplier = Object.entries(state.upgrades).reduce((total, [id, level]) => {
    const upgrade = findUpgrade(id as Parameters<typeof findUpgrade>[0]);
    if (upgrade.effect.type === "mult") {
      return total * Math.pow(upgrade.effect.factor, level);
    }
    return total;
  }, 1);

  const basePerSecond = BASE_PRODUCTION;
  const perSecond = (basePerSecond + additiveBonus) * multiplier;

  return {
    ...state,
    production: {
      basePerSecond,
      additiveBonus,
      multiplier,
      perSecond
    }
  };
}

export function resetState(state: GameState): GameState {
  const reset: GameState = {
    ...state,
    resources: {
      essence: 0,
      insight: state.resources.insight,
      research: 0,
      reputation: 0
    },
    upgrades: initializeUpgradesRecord(),
    lastFocusAtMs: null,
    contracts: createInitialContractsState(state.contracts.maxSlots)
  };
  return calculateProduction(reset);
}

export function syncContractDefinitions(state: GameState): GameState {
  const updatedSlots = state.contracts.slots.map((slot) => refreshContractFromDefinition(slot));
  return {
    ...state,
    contracts: {
      ...state.contracts,
      slots: updatedSlots
    }
  };
}
