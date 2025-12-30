import { tick } from "./sim";
import { calculateProduction } from "./state";
import { OFFLINE_CAP_MS } from "./data/constants";
import { getEquipmentModifiers } from "./equipment";
export function computeOfflineProgress(state, lastSavedAtMs, nowMs, maxMs = OFFLINE_CAP_MS) {
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
