import { findUpgrade } from "./data/upgrades";
import { initializeUpgradesRecord } from "./utils";
export const BASE_PRODUCTION = 1;
export function calculateProduction(state) {
    const additiveBonus = Object.entries(state.upgrades).reduce((total, [id, level]) => {
        const upgrade = findUpgrade(id);
        if (upgrade.effect.type === "add") {
            return total + upgrade.effect.amount * level;
        }
        return total;
    }, 0);
    const multiplier = Object.entries(state.upgrades).reduce((total, [id, level]) => {
        const upgrade = findUpgrade(id);
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
export function resetState(state) {
    const reset = {
        ...state,
        essence: 0,
        upgrades: initializeUpgradesRecord(),
        lastFocusAtMs: null
    };
    return calculateProduction(reset);
}
