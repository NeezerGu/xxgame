import { tick } from "./sim";
import { calculateProduction } from "./state";
import type { GameState } from "./types";
import { OFFLINE_CAP_MS } from "./data/constants";

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
  const appliedMs = Math.min(elapsedMs, maxMs);

  if (appliedMs === 0) {
    return { state, elapsedMs, appliedMs };
  }

  const updatedState = tick(calculateProduction(state), appliedMs);
  return { state: updatedState, elapsedMs, appliedMs };
}
