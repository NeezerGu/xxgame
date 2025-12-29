import { acceptContract, completeContract, progressContracts } from "./contracts";
import { ascend } from "./progression";
import { calculateProduction } from "./state";
import type { Action, GameState } from "./types";
import { findUpgrade, getUpgradeCost } from "./data/upgrades";
import { applyResearchPurchase, getResearchModifiers } from "./research";
import { breakthrough } from "./progressionRealm";
import { addResources, getResource } from "./resources";
import { equipItem, getEquipmentModifiers, unequipSlot } from "./equipment";

export const FOCUS_GAIN = 5;
export const FOCUS_COOLDOWN_MS = 3000;

export function tick(state: GameState, dtMs: number): GameState {
  if (dtMs <= 0) {
    return state;
  }

  const perSecond = state.production.perSecond;
  const deltaSeconds = dtMs / 1000;
  const deltaEssence = perSecond * deltaSeconds;
  const nextResources = addResources(state.resources, { essence: deltaEssence });
  const researchModifiers = getResearchModifiers(state);
  const equipmentModifiers = getEquipmentModifiers(state);

  const withResources: GameState = {
    ...state,
    resources: nextResources,
    runStats: {
      ...state.runStats,
      essenceEarned: state.runStats.essenceEarned + deltaEssence
    }
  };

  return progressContracts(
    withResources,
    dtMs,
    researchModifiers.contractSpeedMult * equipmentModifiers.contractSpeedMult
  );
}

export function applyAction(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "focus": {
      if (!canFocus(state, action.performedAtMs)) {
        return state;
      }

      return {
        ...state,
        resources: addResources(state.resources, { essence: FOCUS_GAIN }),
        runStats: {
          ...state.runStats,
          essenceEarned: state.runStats.essenceEarned + FOCUS_GAIN
        },
        lastFocusAtMs: action.performedAtMs
      };
    }
    case "buyUpgrade": {
      const upgradeDef = findUpgrade(action.upgradeId);
      const currentLevel = state.upgrades[upgradeDef.id] ?? 0;
      const cost = getUpgradeCost(upgradeDef, currentLevel);

      if (getResource(state.resources, "essence") < cost) {
        return state;
      }

      const newUpgrades = {
        ...state.upgrades,
        [upgradeDef.id]: currentLevel + 1
      } as GameState["upgrades"];
      const updated = {
        ...state,
        resources: addResources(state.resources, { essence: -cost }),
        upgrades: newUpgrades
      };
      return calculateProduction(updated);
    }
    case "ascend": {
      return calculateProduction(ascend(state));
    }
    case "breakthrough": {
      return calculateProduction(breakthrough(state));
    }
    case "acceptContract": {
      return acceptContract(state, action.contractId);
    }
    case "completeContract": {
      return completeContract(state, action.contractId);
    }
    case "buyResearch": {
      const updated = applyResearchPurchase(state, action.researchId);
      return calculateProduction(updated);
    }
    case "equip": {
      const updated = equipItem(state, action.instanceId);
      if (updated === state) {
        return state;
      }
      return calculateProduction(updated);
    }
    case "unequip": {
      const updated = unequipSlot(state, action.slot);
      if (updated === state) {
        return state;
      }
      return calculateProduction(updated);
    }
    default: {
      return state;
    }
  }
}

function canFocus(state: GameState, performedAtMs: number): boolean {
  if (state.lastFocusAtMs === null) {
    return true;
  }
  return performedAtMs - state.lastFocusAtMs >= FOCUS_COOLDOWN_MS;
}
