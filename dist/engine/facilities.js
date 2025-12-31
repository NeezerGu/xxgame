import { FACILITY_DEFINITIONS, findFacilityDefinition } from "./data/facilities";
import { getResource, spendResources } from "./resources";
export function createInitialFacilitiesState() {
    return FACILITY_DEFINITIONS.reduce((acc, def) => {
        acc[def.id] = { level: 0 };
        return acc;
    }, {});
}
export function applyFacilityDefaults(facilities) {
    const defaults = createInitialFacilitiesState();
    if (!facilities) {
        return defaults;
    }
    return FACILITY_DEFINITIONS.reduce((acc, def) => {
        acc[def.id] = facilities[def.id] ?? defaults[def.id];
        return acc;
    }, {});
}
export function getFacilityUpgradeCost(state, facilityId) {
    const def = findFacilityDefinition(facilityId);
    const level = state.facilities?.[facilityId]?.level ?? 0;
    return Math.floor(def.baseCostEssence * Math.pow(def.costGrowth, level));
}
export function canUpgradeFacility(state, facilityId) {
    const def = findFacilityDefinition(facilityId);
    const level = state.facilities?.[facilityId]?.level ?? 0;
    if (level >= def.maxLevel) {
        return false;
    }
    const cost = getFacilityUpgradeCost(state, facilityId);
    return getResource(state.resources, "essence") >= cost;
}
export function applyUpgradeFacility(state, facilityId) {
    if (!canUpgradeFacility(state, facilityId)) {
        return state;
    }
    const def = findFacilityDefinition(facilityId);
    const facilities = applyFacilityDefaults(state.facilities);
    const currentLevel = facilities[facilityId]?.level ?? 0;
    const cost = getFacilityUpgradeCost(state, facilityId);
    const nextFacilities = {
        ...facilities,
        [facilityId]: { level: Math.min(def.maxLevel, currentLevel + 1) }
    };
    const updated = {
        ...state,
        resources: spendResources(state.resources, { essence: cost }),
        facilities: nextFacilities
    };
    return {
        ...updated,
        facilities: nextFacilities
    };
}
export function getFacilityModifiers(state) {
    const facilities = applyFacilityDefaults(state.facilities);
    const base = {
        contractSlotsBonus: 0,
        reputationGainMult: 1,
        contractCostDiscount: 0,
        alchemySpeedMult: 1,
        buffDurationMult: 1,
        forgingSpeedMult: 1,
        disassembleYieldMult: 1,
        offlineCapBonusMs: 0,
        offlineEfficiencyMult: 1
    };
    for (const def of FACILITY_DEFINITIONS) {
        const level = facilities[def.id]?.level ?? 0;
        for (let i = 0; i < level && i < def.effectsByLevel.length; i += 1) {
            applyEffects(base, def.effectsByLevel[i] ?? {});
        }
    }
    return base;
}
export function getFacilityEffectTotals(definition, level) {
    const base = {
        contractSlotsBonus: 0,
        reputationGainMult: 1,
        contractCostDiscount: 0,
        alchemySpeedMult: 1,
        buffDurationMult: 1,
        forgingSpeedMult: 1,
        disassembleYieldMult: 1,
        offlineCapBonusMs: 0,
        offlineEfficiencyMult: 1
    };
    for (let i = 0; i < level && i < definition.effectsByLevel.length; i += 1) {
        applyEffects(base, definition.effectsByLevel[i] ?? {});
    }
    return base;
}
function applyEffects(target, effect) {
    if (effect.contractSlotsBonus) {
        target.contractSlotsBonus += effect.contractSlotsBonus;
    }
    if (effect.reputationGainMult) {
        target.reputationGainMult *= effect.reputationGainMult;
    }
    if (effect.contractCostDiscount) {
        target.contractCostDiscount += effect.contractCostDiscount;
    }
    if (effect.alchemySpeedMult) {
        target.alchemySpeedMult *= effect.alchemySpeedMult;
    }
    if (effect.buffDurationMult) {
        target.buffDurationMult *= effect.buffDurationMult;
    }
    if (effect.forgingSpeedMult) {
        target.forgingSpeedMult *= effect.forgingSpeedMult;
    }
    if (effect.disassembleYieldMult) {
        target.disassembleYieldMult *= effect.disassembleYieldMult;
    }
    if (effect.offlineCapBonusMs) {
        target.offlineCapBonusMs += effect.offlineCapBonusMs;
    }
    if (effect.offlineEfficiencyMult) {
        target.offlineEfficiencyMult *= effect.offlineEfficiencyMult;
    }
}
