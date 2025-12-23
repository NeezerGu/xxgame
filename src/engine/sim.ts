import { findUpgrade } from "./data/upgrades";
import { ascend } from "./progression";
import { calculateProduction } from "./state";
import type { Action, GameState } from "./types";

const FOCUS_GAIN = 5;

export function tick(state: GameState, dtMs: number): GameState {
  if (dtMs <= 0) {
    return state;
  }

  const perSecond = state.production.perSecond;
  const deltaSeconds = dtMs / 1000;
  const nextEssence = state.essence + perSecond * deltaSeconds;

  return {
    ...state,
    essence: nextEssence
  };
}

export function applyAction(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "focus": {
      return {
        ...state,
        essence: state.essence + FOCUS_GAIN
      };
    }
    case "buyUpgrade": {
      const upgradeDef = findUpgrade(action.upgradeId);
      const currentLevel = state.upgrades[upgradeDef.id] ?? 0;
      const cost = upgradeDef.cost;

      if (state.essence < cost) {
        return state;
      }

      const newUpgrades = {
        ...state.upgrades,
        [upgradeDef.id]: currentLevel + 1
      } as GameState["upgrades"];
      const updated = {
        ...state,
        essence: state.essence - cost,
        upgrades: newUpgrades
      };
      return calculateProduction(updated);
    }
    case "ascend": {
      return calculateProduction(ascend(state));
    }
    default: {
      return state;
    }
  }
}
