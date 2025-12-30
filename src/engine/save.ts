import { createInitialContractsState, ensureContractSlotCount } from "./contracts";
import { FOCUS_COOLDOWN_MS } from "./sim";
import { calculateProduction } from "./state";
import type { EquipmentInstance, GameState } from "./types";
import { initializeUpgradesRecord } from "./utils.js";
import { applyResearchDefaults, getResearchModifiers, initializeResearchState } from "./research";
import { BASE_CONTRACT_SLOTS } from "./data/constants";
import { buildRealmState, getInitialRealmId } from "./progressionRealm";
import { createEmptyResources } from "./resources";
import { createEmptyEquipmentInventory, createEmptyEquipped, ensureEquipmentDefaults } from "./equipment";
import { createEmptyForgingQueue } from "./forging";
import { createEmptyAlchemyQueue, createEmptyConsumables } from "./alchemy";
import { createInitialAutomationState, createInitialDisciplesState, syncAutomation } from "./disciples";
import { createInitialExpeditionState, refreshExpeditionUnlocks } from "./expeditions";
import { createDefaultSettings, mergeSettings } from "./settings";
import type { SettingsState } from "./types";
import { applyFacilityDefaults, createInitialFacilitiesState, getFacilityModifiers } from "./facilities";

export const SCHEMA_VERSION = 13;

interface LegacyGameStateV1 {
  schemaVersion: number;
  essence: number;
  insight: number;
  production: GameState["production"];
  upgrades: GameState["upgrades"];
  lastFocusAtMs: number | null;
}

interface LegacySerializedSaveV1 {
  schemaVersion: 1;
  savedAtMs: number;
  state: LegacyGameStateV1;
}

function normalizeResources(resources: Partial<GameState["resources"]> | undefined) {
  return createEmptyResources(resources ?? {});
}

function isLegacySerializedSaveV1(save: SerializedSave | LegacySerializedSaveV1): save is LegacySerializedSaveV1 {
  return save.schemaVersion === 1 && "state" in save && "essence" in save.state;
}

export function createInitialState(nowMs: number): GameState {
  const seed = Math.max(1, Math.floor(nowMs % 1_000_000));
  const defaultSettings: SettingsState = createDefaultSettings();
  const starterEquipment: EquipmentInstance = {
    instanceId: "1",
    blueprintId: "ember-shiv",
    slot: "weapon",
    rarity: "common",
    affixes: [{ affixId: "steady-flow", value: 0.05 }]
  };
  const base: GameState = {
    schemaVersion: SCHEMA_VERSION,
    seed,
    resources: createEmptyResources(),
    runStats: {
      essenceEarned: 0,
      contractsCompleted: 0
    },
    realm: buildRealmState(getInitialRealmId()),
    research: initializeResearchState(),
    upgrades: initializeUpgradesRecord(),
    lastFocusAtMs: nowMs - FOCUS_COOLDOWN_MS,
    production: {
      basePerSecond: 1,
      additiveBonus: 0,
      multiplier: 1,
      perSecond: 1
    },
    contracts: createInitialContractsState(),
    equipmentInventory: {
      ...createEmptyEquipmentInventory(),
      items: { "1": starterEquipment },
      nextId: 2
    },
    disciples: createInitialDisciplesState(),
    automation: createInitialAutomationState(),
    expeditions: createInitialExpeditionState(getInitialRealmId()),
    settings: defaultSettings,
    equipped: createEmptyEquipped(),
    forgingQueue: createEmptyForgingQueue(),
    alchemyQueue: createEmptyAlchemyQueue(),
    consumables: createEmptyConsumables(),
    buffs: [],
    facilities: createInitialFacilitiesState()
  };
  return calculateProduction(base);
}

export interface SerializedSave {
  schemaVersion: number;
  savedAtMs: number;
  state: GameState;
}

export function serialize(state: GameState, savedAtMs: number): string {
  const payload: SerializedSave = {
    schemaVersion: SCHEMA_VERSION,
    savedAtMs,
    state
  };
  return JSON.stringify(payload);
}

export function deserialize(serialized: string): SerializedSave {
  const parsed = JSON.parse(serialized) as SerializedSave | LegacySerializedSaveV1;
  return migrateToLatest(parsed);
}

export function migrateToLatest(save: SerializedSave | LegacySerializedSaveV1): SerializedSave {
  if (save.schemaVersion === SCHEMA_VERSION) {
    return {
      ...save,
      state: applyStateDefaults(save.state)
    };
  }

  if (save.schemaVersion === 6) {
    const migratedState: GameState = {
      ...(save as SerializedSave).state,
      schemaVersion: SCHEMA_VERSION
    } as GameState;
    return {
      schemaVersion: SCHEMA_VERSION,
      savedAtMs: (save as SerializedSave).savedAtMs ?? Date.now(),
      state: applyStateDefaults(migratedState)
    };
  }
  if (save.schemaVersion === 7) {
    const migratedState: GameState = {
      ...(save as SerializedSave).state,
      schemaVersion: SCHEMA_VERSION
    } as GameState;
    return {
      schemaVersion: SCHEMA_VERSION,
      savedAtMs: (save as SerializedSave).savedAtMs ?? Date.now(),
      state: applyStateDefaults(migratedState)
    };
  }
  if (save.schemaVersion === 8) {
    const migratedState: GameState = {
      ...(save as SerializedSave).state,
      schemaVersion: SCHEMA_VERSION
    } as GameState;
    return {
      schemaVersion: SCHEMA_VERSION,
      savedAtMs: (save as SerializedSave).savedAtMs ?? Date.now(),
      state: applyStateDefaults(migratedState)
    };
  }
  if (save.schemaVersion === 9) {
    const migratedState: GameState = {
      ...(save as SerializedSave).state,
      schemaVersion: SCHEMA_VERSION
    } as GameState;
    return {
      schemaVersion: SCHEMA_VERSION,
      savedAtMs: (save as SerializedSave).savedAtMs ?? Date.now(),
      state: applyStateDefaults(migratedState)
    };
  }
  if (save.schemaVersion === 10) {
    const migratedState: GameState = {
      ...(save as SerializedSave).state,
      schemaVersion: SCHEMA_VERSION
    } as GameState;
    return {
      schemaVersion: SCHEMA_VERSION,
      savedAtMs: (save as SerializedSave).savedAtMs ?? Date.now(),
      state: applyStateDefaults(migratedState)
    };
  }
  if (save.schemaVersion === 11 || save.schemaVersion === 12) {
    const migratedState: GameState = {
      ...(save as SerializedSave).state,
      schemaVersion: SCHEMA_VERSION
    } as GameState;
    return {
      schemaVersion: SCHEMA_VERSION,
      savedAtMs: (save as SerializedSave).savedAtMs ?? Date.now(),
      state: applyStateDefaults(migratedState)
    };
  }

  if (save.schemaVersion === 5) {
    const migratedState: GameState = {
      ...(save as SerializedSave).state,
      schemaVersion: SCHEMA_VERSION
    } as GameState;
    return {
      schemaVersion: SCHEMA_VERSION,
      savedAtMs: (save as SerializedSave).savedAtMs ?? Date.now(),
      state: applyStateDefaults(migratedState)
    };
  }

  if (save.schemaVersion === 4) {
    const migratedState: GameState = {
      ...(save as SerializedSave).state,
      schemaVersion: SCHEMA_VERSION
    } as GameState;
    return {
      schemaVersion: SCHEMA_VERSION,
      savedAtMs: (save as SerializedSave).savedAtMs ?? Date.now(),
      state: applyStateDefaults(migratedState)
    };
  }

  if (save.schemaVersion === 3) {
    const migratedState: GameState = {
      ...(save as SerializedSave).state,
      schemaVersion: SCHEMA_VERSION
    } as GameState;
    return {
      schemaVersion: SCHEMA_VERSION,
      savedAtMs: (save as SerializedSave).savedAtMs ?? Date.now(),
      state: applyStateDefaults(migratedState)
    };
  }

  if (save.schemaVersion === 2) {
    const migratedState: GameState = {
      ...(save as SerializedSave).state,
      schemaVersion: SCHEMA_VERSION
    } as GameState;
    return {
      schemaVersion: SCHEMA_VERSION,
      savedAtMs: (save as SerializedSave).savedAtMs ?? Date.now(),
      state: applyStateDefaults(migratedState)
    };
  }

  if (isLegacySerializedSaveV1(save)) {
    const migratedState = {
      schemaVersion: SCHEMA_VERSION,
      seed: Math.max(1, Math.floor(save.savedAtMs % 1_000_000)),
      resources: createEmptyResources({
        essence: save.state.essence ?? 0,
        insight: save.state.insight ?? 0,
        research: 0,
        reputation: 0
      }),
      runStats: {
        essenceEarned: 0,
        contractsCompleted: 0
      },
      realm: buildRealmState(getInitialRealmId()),
      production: save.state.production,
      upgrades: save.state.upgrades ?? initializeUpgradesRecord(),
      research: initializeResearchState(),
      lastFocusAtMs: save.state.lastFocusAtMs ?? -FOCUS_COOLDOWN_MS,
      contracts: createInitialContractsState(),
      equipmentInventory: createEmptyEquipmentInventory(),
      equipped: createEmptyEquipped(),
      forgingQueue: createEmptyForgingQueue(),
      expeditions: createInitialExpeditionState(getInitialRealmId()),
      disciples: createInitialDisciplesState(),
      automation: createInitialAutomationState(),
      settings: createDefaultSettings()
    } as unknown as GameState;
    return {
      schemaVersion: SCHEMA_VERSION,
      savedAtMs: save.savedAtMs,
      state: applyStateDefaults(migratedState)
    };
  }

  // Unknown future version: best effort align to latest.
  return {
    schemaVersion: SCHEMA_VERSION,
    savedAtMs: "savedAtMs" in save ? save.savedAtMs : Date.now(),
    state: applyStateDefaults({
      ...(save as SerializedSave).state,
      schemaVersion: SCHEMA_VERSION
    } as GameState)
  };
}

function applyStateDefaults(state: GameState): GameState {
  const withEquipment = ensureEquipmentDefaults(state);
  const withStarterEquipment = seedStarterEquipment(withEquipment);
  const forgingQueue = withStarterEquipment.forgingQueue ?? createEmptyForgingQueue();
  const research = applyResearchDefaults(withStarterEquipment.research);
  const realm = buildRealmState(withStarterEquipment.realm?.current ?? getInitialRealmId(), withStarterEquipment.realm);
  const disciples = withStarterEquipment.disciples ?? createInitialDisciplesState();
  const automation = withStarterEquipment.automation ?? createInitialAutomationState();
  const expeditions = withStarterEquipment.expeditions ?? createInitialExpeditionState(realm.current);
  const settings: SettingsState = mergeSettings(withStarterEquipment.settings, {});
  const alchemyQueue = withStarterEquipment.alchemyQueue ?? createEmptyAlchemyQueue();
  const consumables = createEmptyConsumables(withStarterEquipment.consumables);
  const buffs = withStarterEquipment.buffs ?? [];
  const facilities = applyFacilityDefaults(withStarterEquipment.facilities);
  const withResources: GameState = {
    ...withStarterEquipment,
    schemaVersion: SCHEMA_VERSION,
    seed: withStarterEquipment.seed ?? 1,
    resources: normalizeResources(withStarterEquipment.resources),
    runStats: {
      essenceEarned: withStarterEquipment.runStats?.essenceEarned ?? 0,
      contractsCompleted: withStarterEquipment.runStats?.contractsCompleted ?? 0
    },
    realm,
    contracts: withStarterEquipment.contracts
      ? {
          maxSlots:
            withStarterEquipment.contracts.maxSlots ??
            withStarterEquipment.contracts.slots?.length ??
            createInitialContractsState().maxSlots,
          slots: withStarterEquipment.contracts.slots ?? createInitialContractsState().slots
        }
      : createInitialContractsState(),
    research,
    upgrades: withStarterEquipment.upgrades ?? initializeUpgradesRecord(),
    lastFocusAtMs: withStarterEquipment.lastFocusAtMs ?? -FOCUS_COOLDOWN_MS,
    production: withStarterEquipment.production ?? {
      basePerSecond: 1,
      additiveBonus: 0,
      multiplier: 1,
      perSecond: 1
    },
    disciples,
    automation,
    expeditions,
    settings,
    forgingQueue,
    alchemyQueue,
    consumables,
    buffs,
    facilities
  };

  const desiredSlots =
    BASE_CONTRACT_SLOTS +
    getResearchModifiers({ ...withResources, research }).contractSlotsBonus +
    getFacilityModifiers({ ...withResources, facilities }).contractSlotsBonus;
  const withContracts = ensureContractSlotCount(
    withResources,
    Math.max(desiredSlots, withResources.contracts.maxSlots)
  );

  const withExpeditions = refreshExpeditionUnlocks({ ...withContracts, expeditions }, withContracts.realm.current);

  return calculateProduction(syncAutomation(withExpeditions));
}

function seedStarterEquipment(state: GameState): GameState {
  const inventory = state.equipmentInventory ?? createEmptyEquipmentInventory();
  if (Object.keys(inventory.items).length > 0) {
    return state;
  }

  const nextId = inventory.nextId ?? 1;
  const instanceId = `${nextId}`;
  const starter: EquipmentInstance = {
    instanceId,
    blueprintId: "ember-shiv",
    slot: "weapon",
    rarity: "common",
    affixes: [{ affixId: "steady-flow", value: 0.05 }]
  };

  return {
    ...state,
    equipmentInventory: {
      items: { ...inventory.items, [instanceId]: starter },
      nextId: nextId + 1
    }
  };
}
