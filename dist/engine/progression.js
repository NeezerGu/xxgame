import { resetState } from "./state";
import { INSIGHT_GAIN_A, INSIGHT_GAIN_B, INSIGHT_GAIN_C } from "./data/constants";
export const ASCEND_THRESHOLD = 1000;
export function canAscend(state, threshold = ASCEND_THRESHOLD) {
    return state.resources.essence >= threshold;
}
export function calculateInsightGain(state, threshold = ASCEND_THRESHOLD) {
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
export function ascend(state, threshold = ASCEND_THRESHOLD) {
    if (!canAscend(state, threshold)) {
        return state;
    }
    const { gain } = calculateInsightGain(state, threshold);
    const reset = resetState(state);
    return {
        ...reset,
        resources: {
            ...reset.resources,
            insight: state.resources.insight + gain
        }
    };
}
