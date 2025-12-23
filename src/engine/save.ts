import { FOCUS_COOLDOWN_MS } from "./sim";
import { calculateProduction } from "./state";
import type { GameState } from "./types";
import { initializeUpgradesRecord } from "./utils";

export const SCHEMA_VERSION = 1;

export function createInitialState(nowMs: number): GameState {
  const base: GameState = {
    schemaVersion: SCHEMA_VERSION,
    essence: 0,
    insight: 0,
    upgrades: initializeUpgradesRecord(),
    lastFocusAtMs: nowMs - FOCUS_COOLDOWN_MS,
    production: {
      basePerSecond: 1,
      additiveBonus: 0,
      multiplier: 1,
      perSecond: 1
    }
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
  const parsed = JSON.parse(serialized) as SerializedSave;
  return migrateToLatest(parsed);
}

export function migrateToLatest(save: SerializedSave): SerializedSave {
  if (save.schemaVersion === SCHEMA_VERSION) {
    return {
      ...save,
      state: applyStateDefaults(save.state)
    };
  }

  // Placeholder for future migrations. For now, we simply align the version if it matches the current structure.
  return {
    ...save,
    schemaVersion: SCHEMA_VERSION,
    state: applyStateDefaults({ ...save.state, schemaVersion: SCHEMA_VERSION })
  };
}

function applyStateDefaults(state: GameState): GameState {
  return calculateProduction({
    ...state,
    lastFocusAtMs: state.lastFocusAtMs ?? -FOCUS_COOLDOWN_MS
  });
}
