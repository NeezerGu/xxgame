import { tick } from "./sim";
import { calculateProduction } from "./state";
import { OFFLINE_CAP_MS } from "./data/constants";
export function computeOfflineProgress(state, lastSavedAtMs, nowMs, maxMs = OFFLINE_CAP_MS) {
    const elapsedMs = Math.max(0, nowMs - lastSavedAtMs);
    const appliedMs = Math.min(elapsedMs, maxMs);
    if (appliedMs === 0) {
        return { state, elapsedMs, appliedMs };
    }
    const updatedState = tick(calculateProduction(state), appliedMs);
    return { state: updatedState, elapsedMs, appliedMs };
}
