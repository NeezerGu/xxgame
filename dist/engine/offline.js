import { tick } from "./sim";
import { calculateProduction } from "./state";
import { OFFLINE_CAP_MS } from "./data/constants";
import { getEquipmentModifiers } from "./equipment";
import { getFacilityModifiers } from "./facilities";
export function computeOfflineProgress(state, lastSavedAtMs, nowMs, maxMs = OFFLINE_CAP_MS) {
    const elapsedMs = Math.max(0, nowMs - lastSavedAtMs);
    const withProduction = calculateProduction(state);
    const equipmentModifiers = getEquipmentModifiers(withProduction);
    const facilityModifiers = getFacilityModifiers(withProduction);
    const offlineCapMs = Math.max(0, maxMs + equipmentModifiers.offlineCapBonusMs + facilityModifiers.offlineCapBonusMs);
    const effectiveElapsed = elapsedMs * facilityModifiers.offlineEfficiencyMult;
    const appliedMs = Math.min(effectiveElapsed, offlineCapMs);
    if (appliedMs === 0) {
        return { state: withProduction, elapsedMs, appliedMs };
    }
    const updatedState = tick(withProduction, appliedMs);
    return { state: updatedState, elapsedMs, appliedMs };
}
