import { findUpgrade } from "./data/upgrades";
import { INSIGHT_PROD_BONUS_PER_POINT, BASE_CONTRACT_SLOTS } from "./data/constants";
import type { GameState } from "./types";
import { initializeUpgradesRecord } from "./utils";
import { createInitialContractsState, refreshContractFromDefinition } from "./contracts";
import { getResearchModifiers } from "./research";
import { buildRealmState, getInitialRealmId } from "./progressionRealm";
import { addResources, createEmptyResources, getResource } from "./resources";
import { getEquipmentModifiers } from "./equipment";

export const BASE_PRODUCTION = 1;

export function calculateProduction(state: GameState): GameState {
  const additiveBonus = Object.entries(state.upgrades).reduce((total, [id, level]) => {
    const upgrade = findUpgrade(id as Parameters<typeof findUpgrade>[0]);
    if (upgrade.effect.type === "add") {
      return total + upgrade.effect.amount * level;
    }
    return total;
  }, 0);

  const upgradeMultiplier = Object.entries(state.upgrades).reduce((total, [id, level]) => {
    const upgrade = findUpgrade(id as Parameters<typeof findUpgrade>[0]);
    if (upgrade.effect.type === "mult") {
      return total * Math.pow(upgrade.effect.factor, level);
    }
    return total;
  }, 1);

  const researchModifiers = getResearchModifiers(state);
  const equipmentModifiers = getEquipmentModifiers(state);
  const insightMultiplier = 1 + getResource(state.resources, "insight") * INSIGHT_PROD_BONUS_PER_POINT;
  const multiplier = upgradeMultiplier * researchModifiers.productionMult * insightMultiplier * equipmentModifiers.productionMult;

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
    resources: addResources(createEmptyResources(), {
      insight: getResource(state.resources, "insight")
    }),
    runStats: {
      essenceEarned: 0,
      contractsCompleted: 0
    },
    realm: resetStateRealm(),
    research: state.research,
    upgrades: initializeUpgradesRecord(),
    lastFocusAtMs: null,
    contracts: createInitialContractsState(Math.max(BASE_CONTRACT_SLOTS + getResearchModifiers(state).contractSlotsBonus, state.contracts.maxSlots))
  };
  return calculateProduction(reset);
}

export function resetStateRealm(): GameState["realm"] {
  return buildRealmState(getInitialRealmId());
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
