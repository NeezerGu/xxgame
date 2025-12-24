import { createInitialContractsState } from "./contracts";
import { FOCUS_COOLDOWN_MS } from "./sim";
import { calculateProduction } from "./state";
import type { GameState } from "./types";
import { initializeUpgradesRecord } from "./utils";

export const SCHEMA_VERSION = 2;

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

export function createInitialState(nowMs: number): GameState {
  const seed = Math.max(1, Math.floor(nowMs % 1_000_000));
  const base: GameState = {
    schemaVersion: SCHEMA_VERSION,
    seed,
    resources: {
      essence: 0,
      insight: 0,
      research: 0,
      reputation: 0
    },
    upgrades: initializeUpgradesRecord(),
    lastFocusAtMs: nowMs - FOCUS_COOLDOWN_MS,
    production: {
      basePerSecond: 1,
      additiveBonus: 0,
      multiplier: 1,
      perSecond: 1
    },
    contracts: createInitialContractsState()
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

  if (save.schemaVersion === 1) {
    const migratedState: GameState = {
      schemaVersion: SCHEMA_VERSION,
      seed: Math.max(1, Math.floor(save.savedAtMs % 1_000_000)),
      resources: {
        essence: save.state.essence ?? 0,
        insight: save.state.insight ?? 0,
        research: 0,
        reputation: 0
      },
      production: save.state.production,
      upgrades: save.state.upgrades ?? initializeUpgradesRecord(),
      lastFocusAtMs: save.state.lastFocusAtMs ?? -FOCUS_COOLDOWN_MS,
      contracts: createInitialContractsState()
    };
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
  const withResources: GameState = {
    ...state,
    seed: state.seed ?? 1,
    resources: {
      essence: state.resources?.essence ?? 0,
      insight: state.resources?.insight ?? 0,
      research: state.resources?.research ?? 0,
      reputation: state.resources?.reputation ?? 0
    },
    contracts: state.contracts
      ? {
          maxSlots: state.contracts.maxSlots ?? state.contracts.slots.length ?? createInitialContractsState().maxSlots,
          slots: state.contracts.slots ?? createInitialContractsState().slots
        }
      : createInitialContractsState(),
    upgrades: state.upgrades ?? initializeUpgradesRecord(),
    lastFocusAtMs: state.lastFocusAtMs ?? -FOCUS_COOLDOWN_MS
  };

  return calculateProduction(withResources);
}
