import { BASE_CONTRACT_SLOTS } from "./data/constants";
import { ensureContractSlotCount } from "./contracts";
import { findResearchDefinition, RESEARCH_DEFINITIONS } from "./data/research";
import { getResource } from "./resources";
export function initializeResearchState() {
    const nodes = RESEARCH_DEFINITIONS.reduce((acc, def) => {
        acc[def.id] = { purchased: false };
        return acc;
    }, {});
    return { nodes };
}
export function applyResearchDefaults(research) {
    const defaults = initializeResearchState();
    if (!research) {
        return defaults;
    }
    const mergedNodes = { ...defaults.nodes, ...(research.nodes ?? {}) };
    return { nodes: mergedNodes };
}
export function canBuyResearch(state, id) {
    const def = findResearchDefinition(id);
    const nodes = state.research?.nodes ?? initializeResearchState().nodes;
    const node = nodes[id];
    if (node?.purchased) {
        return false;
    }
    if (!state.realm.unlockedResearchIds.includes(id)) {
        return false;
    }
    if ((def.prerequisites ?? []).some((pre) => !nodes[pre]?.purchased)) {
        return false;
    }
    return getResource(state.resources, "research") >= def.costResearch;
}
export function applyResearchPurchase(state, id) {
    if (!canBuyResearch(state, id)) {
        return state;
    }
    const def = findResearchDefinition(id);
    const mergedResearch = applyResearchDefaults(state.research);
    const updatedResearch = {
        nodes: {
            ...mergedResearch.nodes,
            [id]: { purchased: true }
        }
    };
    const updatedState = {
        ...state,
        research: updatedResearch,
        resources: {
            ...state.resources,
            research: getResource(state.resources, "research") - def.costResearch
        }
    };
    const modifiers = getResearchModifiers(updatedState);
    const desiredSlots = BASE_CONTRACT_SLOTS + modifiers.contractSlotsBonus;
    return ensureContractSlotCount(updatedState, desiredSlots);
}
export function getResearchModifiers(state) {
    let productionMult = 1;
    let contractSpeedMult = 1;
    let contractSlotsBonus = 0;
    const nodes = state.research?.nodes ?? initializeResearchState().nodes;
    RESEARCH_DEFINITIONS.forEach((def) => {
        const node = nodes[def.id];
        if (!node?.purchased)
            return;
        switch (def.effect.type) {
            case "productionMultiplier":
                productionMult *= def.effect.multiplier;
                break;
            case "contractSpeed":
                contractSpeedMult *= def.effect.multiplier;
                break;
            case "contractSlot":
                contractSlotsBonus += def.effect.bonus;
                break;
            default:
                break;
        }
    });
    return { productionMult, contractSpeedMult, contractSlotsBonus };
}
