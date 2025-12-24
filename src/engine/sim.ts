import { acceptContract, completeContract, progressContracts } from "./contracts";
import { ascend } from "./progression";
import { calculateProduction } from "./state";
import type { Action, GameState } from "./types";
import { findUpgrade } from "./data/upgrades";
import { applyResearchPurchase, getResearchModifiers } from "./research";

export const FOCUS_GAIN = 5;
export const FOCUS_COOLDOWN_MS = 3000;

export function tick(state: GameState, dtMs: number): GameState {
  if (dtMs <= 0) {
    return state;
  }

  const perSecond = state.production.perSecond;
  const deltaSeconds = dtMs / 1000;
  const nextEssence = state.resources.essence + perSecond * deltaSeconds;
  const researchModifiers = getResearchModifiers(state);

  const withResources: GameState = {
    ...state,
    resources: {
      ...state.resources,
      essence: nextEssence
    }
  };

  return progressContracts(withResources, dtMs, researchModifiers.contractSpeedMult);
}

export function applyAction(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "focus": {
      if (!canFocus(state, action.performedAtMs)) {
        return state;
      }

      return {
        ...state,
        resources: {
          ...state.resources,
          essence: state.resources.essence + FOCUS_GAIN
        },
        lastFocusAtMs: action.performedAtMs
      };
    }
    case "buyUpgrade": {
      const upgradeDef = findUpgrade(action.upgradeId);
      const currentLevel = state.upgrades[upgradeDef.id] ?? 0;
      const cost = upgradeDef.cost;

      if (state.resources.essence < cost) {
        return state;
      }

      const newUpgrades = {
        ...state.upgrades,
        [upgradeDef.id]: currentLevel + 1
      } as GameState["upgrades"];
      const updated = {
        ...state,
        resources: {
          ...state.resources,
          essence: state.resources.essence - cost
        },
        upgrades: newUpgrades
      };
      return calculateProduction(updated);
    }
    case "ascend": {
      return calculateProduction(ascend(state));
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
