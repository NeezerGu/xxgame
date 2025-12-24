import { resetState } from "./state";
export const ASCEND_THRESHOLD = 1000;
export function canAscend(state, threshold = ASCEND_THRESHOLD) {
    return state.essence >= threshold;
}
export function calculateInsightGain(state, threshold = ASCEND_THRESHOLD) {
    return Math.floor(state.essence / threshold);
}
export function ascend(state, threshold = ASCEND_THRESHOLD) {
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
