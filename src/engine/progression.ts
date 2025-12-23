import { resetState } from "./state";
import type { GameState } from "./types";

export const ASCEND_THRESHOLD = 1000;

export function canAscend(state: GameState, threshold: number = ASCEND_THRESHOLD): boolean {
  return state.essence >= threshold;
}

export function calculateInsightGain(state: GameState, threshold: number = ASCEND_THRESHOLD): number {
  return Math.floor(state.essence / threshold);
}

export function ascend(state: GameState, threshold: number = ASCEND_THRESHOLD): GameState {
  if (!canAscend(state, threshold)) {
    return state;
  }

  const gainedInsight = calculateInsightGain(state, threshold);
  const reset = resetState(state);

  return {
    ...reset,
    insight: state.insight + gainedInsight
  };
}
