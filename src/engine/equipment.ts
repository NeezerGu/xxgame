import type { GameState, EquippedState, EquipmentInventoryState } from "./types";
import { AFFIX_DEFINITIONS, EQUIPMENT_BLUEPRINTS, findAffixDefinition, findEquipmentBlueprint, type EquipmentSlot } from "./data/equipment";

const RARITY_MULTIPLIER: Record<string, number> = {
  common: 1,
  uncommon: 1.1,
  rare: 1.25,
  epic: 1.4
};

export function getRarityMultiplier(rarity: string): number {
  return RARITY_MULTIPLIER[rarity] ?? 1;
}

export function createEmptyEquipmentInventory(): EquipmentInventoryState {
  return {
    items: {},
    nextId: 1
  };
}

export function createEmptyEquipped(): EquippedState {
  return {
    weapon: null,
    armor: null,
    ring: null,
    amulet: null
  };
}

export function getEquipmentModifiers(state: GameState): {
  productionMult: number;
  contractSpeedMult: number;
  offlineCapBonusMs: number;
} {
  const equipped = state.equipped ?? createEmptyEquipped();
  const inventory = state.equipmentInventory ?? createEmptyEquipmentInventory();

  let productionMult = 1;
  let contractSpeedMult = 1;
  let offlineCapBonusMs = 0;

  (Object.keys(equipped) as EquipmentSlot[]).forEach((slot) => {
    const instanceId = equipped[slot];
    if (!instanceId) return;

    const instance = inventory.items[instanceId];
    if (!instance) return;

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

export function equipItem(state: GameState, instanceId: string): GameState {
  const inventory = state.equipmentInventory ?? createEmptyEquipmentInventory();
  const target = inventory.items[instanceId];
  if (!target) {
    return state;
  }

  const equipped = state.equipped ?? createEmptyEquipped();
  if (equipped[target.slot] === instanceId) {
    return state;
  }

  const updatedEquipped: EquippedState = {
    ...equipped,
    [target.slot]: instanceId
  };

  return {
    ...state,
    equipped: updatedEquipped
  };
}

export function unequipSlot(state: GameState, slot: EquipmentSlot): GameState {
  const equipped = state.equipped ?? createEmptyEquipped();
  if (equipped[slot] === null) {
    return state;
  }

  const updatedEquipped: EquippedState = {
    ...equipped,
    [slot]: null
  };

  return {
    ...state,
    equipped: updatedEquipped
  };
}

export function listEquippedInstances(state: GameState) {
  const inventory = state.equipmentInventory ?? createEmptyEquipmentInventory();
  const equipped = state.equipped ?? createEmptyEquipped();
  return (Object.keys(equipped) as EquipmentSlot[]).map((slot) => {
    const instanceId = equipped[slot];
    return instanceId ? inventory.items[instanceId] ?? null : null;
  });
}

export function ensureEquipmentDefaults(state: GameState): GameState {
  return {
    ...state,
    equipmentInventory: state.equipmentInventory ?? createEmptyEquipmentInventory(),
    equipped: state.equipped ?? createEmptyEquipped()
  };
}

export function summarizeInventory(state: GameState) {
  const inventory = state.equipmentInventory ?? createEmptyEquipmentInventory();
  return {
    blueprints: EQUIPMENT_BLUEPRINTS,
    affixes: AFFIX_DEFINITIONS,
    items: inventory.items
  };
}
