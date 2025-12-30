import { AFFIX_DEFINITIONS, EQUIPMENT_BLUEPRINTS, findAffixDefinition, findEquipmentBlueprint } from "./data/equipment";
const RARITY_MULTIPLIER = {
    common: 1,
    uncommon: 1.1,
    rare: 1.25,
    epic: 1.4
};
export function getRarityMultiplier(rarity) {
    return RARITY_MULTIPLIER[rarity] ?? 1;
}
export function createEmptyEquipmentInventory() {
    return {
        items: {},
        nextId: 1
    };
}
export function createEmptyEquipped() {
    return {
        weapon: null,
        armor: null,
        ring: null,
        amulet: null
    };
}
export function getEquipmentModifiers(state) {
    const equipped = state.equipped ?? createEmptyEquipped();
    const inventory = state.equipmentInventory ?? createEmptyEquipmentInventory();
    let productionMult = 1;
    let contractSpeedMult = 1;
    let offlineCapBonusMs = 0;
    Object.keys(equipped).forEach((slot) => {
        const instanceId = equipped[slot];
        if (!instanceId)
            return;
        const instance = inventory.items[instanceId];
        if (!instance)
            return;
        const blueprint = findEquipmentBlueprint(instance.blueprintId);
        const rarityFactor = getRarityMultiplier(instance.rarity);
        productionMult *= 1 + blueprint.basePower * rarityFactor;
        (instance.affixes ?? []).forEach((affixInstance) => {
            const def = findAffixDefinition(affixInstance.affixId);
            const scaledValue = affixInstance.value * rarityFactor;
            switch (def.type) {
                case "productionMult":
                    productionMult *= 1 + scaledValue;
                    break;
                case "contractSpeedMult":
                    contractSpeedMult *= 1 + scaledValue;
                    break;
                case "offlineCapBonus":
                    offlineCapBonusMs += scaledValue;
                    break;
                default:
                    break;
            }
        });
    });
    return { productionMult, contractSpeedMult, offlineCapBonusMs };
}
export function equipItem(state, instanceId) {
    const inventory = state.equipmentInventory ?? createEmptyEquipmentInventory();
    const target = inventory.items[instanceId];
    if (!target) {
        return state;
    }
    const equipped = state.equipped ?? createEmptyEquipped();
    if (equipped[target.slot] === instanceId) {
        return state;
    }
    const updatedEquipped = {
        ...equipped,
        [target.slot]: instanceId
    };
    return {
        ...state,
        equipped: updatedEquipped
    };
}
export function unequipSlot(state, slot) {
    const equipped = state.equipped ?? createEmptyEquipped();
    if (equipped[slot] === null) {
        return state;
    }
    const updatedEquipped = {
        ...equipped,
        [slot]: null
    };
    return {
        ...state,
        equipped: updatedEquipped
    };
}
export function listEquippedInstances(state) {
    const inventory = state.equipmentInventory ?? createEmptyEquipmentInventory();
    const equipped = state.equipped ?? createEmptyEquipped();
    return Object.keys(equipped).map((slot) => {
        const instanceId = equipped[slot];
        return instanceId ? inventory.items[instanceId] ?? null : null;
    });
}
export function ensureEquipmentDefaults(state) {
    return {
        ...state,
        equipmentInventory: state.equipmentInventory ?? createEmptyEquipmentInventory(),
        equipped: state.equipped ?? createEmptyEquipped()
    };
}
export function summarizeInventory(state) {
    const inventory = state.equipmentInventory ?? createEmptyEquipmentInventory();
    return {
        blueprints: EQUIPMENT_BLUEPRINTS,
        affixes: AFFIX_DEFINITIONS,
        items: inventory.items
    };
}
