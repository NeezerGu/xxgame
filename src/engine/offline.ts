import { tick } from "./sim";
import { calculateProduction } from "./state";
import type { GameState } from "./types";
import { OFFLINE_CAP_MS } from "./data/constants";
import { getEquipmentModifiers } from "./equipment";

export interface OfflineResult {
  state: GameState;
  elapsedMs: number;
  appliedMs: number;
}

export function computeOfflineProgress(
  state: GameState,
  lastSavedAtMs: number,
  nowMs: number,
  maxMs: number = OFFLINE_CAP_MS
): OfflineResult {
  const elapsedMs = Math.max(0, nowMs - lastSavedAtMs);
  const withProduction = calculateProduction(state);
  const equipmentModifiers = getEquipmentModifiers(withProduction);
  const offlineCapMs = Math.max(0, maxMs + equipmentModifiers.offlineCapBonusMs);
  const appliedMs = Math.min(elapsedMs, offlineCapMs);

  if (appliedMs === 0) {
    return { state: withProduction, elapsedMs, appliedMs };
  }

  const updatedState = tick(withProduction, appliedMs);
  return { state: updatedState, elapsedMs, appliedMs };
}
