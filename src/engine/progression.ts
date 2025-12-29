import { resetState } from "./state";
import type { GameState } from "./types";
import { INSIGHT_GAIN_A, INSIGHT_GAIN_B, INSIGHT_GAIN_C } from "./data/constants";
import { getResource } from "./resources";

export const ASCEND_THRESHOLD = 1000;

export interface InsightGainBreakdown {
  gain: number;
  essenceTerm: number;
  contractTerm: number;
}

export function canAscend(state: GameState, threshold: number = ASCEND_THRESHOLD): boolean {
  return getResource(state.resources, "essence") >= threshold;
}

export function calculateInsightGain(
  state: GameState,
  threshold: number = ASCEND_THRESHOLD
): InsightGainBreakdown {
  const { essenceEarned, contractsCompleted } = state.runStats;
  const essenceTerm = INSIGHT_GAIN_A * Math.log(1 + essenceEarned / INSIGHT_GAIN_B);
  const contractTerm = INSIGHT_GAIN_C * Math.sqrt(contractsCompleted);
  const rawGain = essenceTerm + contractTerm;
  const meetsAscend = canAscend(state, threshold);
  const gain = meetsAscend ? Math.max(1, Math.floor(rawGain)) : Math.floor(rawGain);

  return {
    gain,
    essenceTerm,
    contractTerm
  };
}

export function ascend(state: GameState, threshold: number = ASCEND_THRESHOLD): GameState {
  if (!canAscend(state, threshold)) {
    return state;
  }

  const { gain } = calculateInsightGain(state, threshold);
  const reset = resetState(state);

  return {
    ...reset,
    resources: {
      ...reset.resources,
      insight: getResource(reset.resources, "insight") + gain
    }
  };
}
