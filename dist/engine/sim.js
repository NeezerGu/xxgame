import { acceptContract, completeContract, progressContracts } from "./contracts";
import { ascend } from "./progression";
import { calculateProduction } from "./state";
import { findUpgrade, getUpgradeCost } from "./data/upgrades";
import { applyResearchPurchase, getResearchModifiers } from "./research";
export const FOCUS_GAIN = 5;
export const FOCUS_COOLDOWN_MS = 3000;
export function tick(state, dtMs) {
    if (dtMs <= 0) {
        return state;
    }
    const perSecond = state.production.perSecond;
    const deltaSeconds = dtMs / 1000;
    const deltaEssence = perSecond * deltaSeconds;
    const nextEssence = state.resources.essence + deltaEssence;
    const researchModifiers = getResearchModifiers(state);
    const withResources = {
        ...state,
        resources: {
            ...state.resources,
            essence: nextEssence
        },
        runStats: {
            ...state.runStats,
            essenceEarned: state.runStats.essenceEarned + deltaEssence
        }
    };
    return progressContracts(withResources, dtMs, researchModifiers.contractSpeedMult);
}
export function applyAction(state, action) {
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
            if (state.resources.essence < cost) {
                return state;
            }
            const newUpgrades = {
                ...state.upgrades,
                [upgradeDef.id]: currentLevel + 1
            };
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
function canFocus(state, performedAtMs) {
    if (state.lastFocusAtMs === null) {
        return true;
    }
    return performedAtMs - state.lastFocusAtMs >= FOCUS_COOLDOWN_MS;
}
