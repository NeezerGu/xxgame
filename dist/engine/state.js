import { findUpgrade } from "./data/upgrades";
import { INSIGHT_PROD_BONUS_PER_POINT, BASE_CONTRACT_SLOTS } from "./data/constants";
import { initializeUpgradesRecord } from "./utils";
import { createInitialContractsState, refreshContractFromDefinition } from "./contracts";
import { getResearchModifiers } from "./research";
export const BASE_PRODUCTION = 1;
export function calculateProduction(state) {
    const additiveBonus = Object.entries(state.upgrades).reduce((total, [id, level]) => {
        const upgrade = findUpgrade(id);
        if (upgrade.effect.type === "add") {
            return total + upgrade.effect.amount * level;
        }
        return total;
    }, 0);
    const upgradeMultiplier = Object.entries(state.upgrades).reduce((total, [id, level]) => {
        const upgrade = findUpgrade(id);
        if (upgrade.effect.type === "mult") {
            return total * Math.pow(upgrade.effect.factor, level);
        }
        return total;
    }, 1);
    const researchModifiers = getResearchModifiers(state);
    const insightMultiplier = 1 + state.resources.insight * INSIGHT_PROD_BONUS_PER_POINT;
    const multiplier = upgradeMultiplier * researchModifiers.productionMult * insightMultiplier;
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
        resources: {
            essence: 0,
            insight: state.resources.insight,
            research: 0,
            reputation: 0
        },
        runStats: {
            essenceEarned: 0,
            contractsCompleted: 0
        },
        research: state.research,
        upgrades: initializeUpgradesRecord(),
        lastFocusAtMs: null,
        contracts: createInitialContractsState(Math.max(BASE_CONTRACT_SLOTS + getResearchModifiers(state).contractSlotsBonus, state.contracts.maxSlots))
    };
    return calculateProduction(reset);
}
export function syncContractDefinitions(state) {
    const updatedSlots = state.contracts.slots.map((slot) => refreshContractFromDefinition(slot));
    return {
        ...state,
        contracts: {
            ...state.contracts,
            slots: updatedSlots
        }
    };
}
