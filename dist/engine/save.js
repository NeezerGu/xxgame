import { createInitialContractsState, ensureContractSlotCount } from "./contracts";
import { FOCUS_COOLDOWN_MS } from "./sim";
import { calculateProduction } from "./state";
import { initializeUpgradesRecord } from "./utils";
import { applyResearchDefaults, getResearchModifiers, initializeResearchState } from "./research";
import { BASE_CONTRACT_SLOTS } from "./data/constants";
export const SCHEMA_VERSION = 4;
function isLegacySerializedSaveV1(save) {
    return save.schemaVersion === 1 && "state" in save && "essence" in save.state;
}
export function createInitialState(nowMs) {
    const seed = Math.max(1, Math.floor(nowMs % 1000000));
    const base = {
        schemaVersion: SCHEMA_VERSION,
        seed,
        resources: {
            essence: 0,
            insight: 0,
            research: 0,
            reputation: 0
        },
        runStats: {
            essenceEarned: 0,
            contractsCompleted: 0
        },
        research: initializeResearchState(),
        upgrades: initializeUpgradesRecord(),
        lastFocusAtMs: nowMs - FOCUS_COOLDOWN_MS,
        production: {
            basePerSecond: 1,
            additiveBonus: 0,
            multiplier: 1,
            perSecond: 1
        },
        contracts: createInitialContractsState()
    };
    return calculateProduction(base);
}
export function serialize(state, savedAtMs) {
    const payload = {
        schemaVersion: SCHEMA_VERSION,
        savedAtMs,
        state
    };
    return JSON.stringify(payload);
}
export function deserialize(serialized) {
    const parsed = JSON.parse(serialized);
    return migrateToLatest(parsed);
}
export function migrateToLatest(save) {
    if (save.schemaVersion === SCHEMA_VERSION) {
        return {
            ...save,
            state: applyStateDefaults(save.state)
        };
    }
    if (save.schemaVersion === 3) {
        const migratedState = {
            ...save.state,
            schemaVersion: SCHEMA_VERSION
        };
        return {
            schemaVersion: SCHEMA_VERSION,
            savedAtMs: save.savedAtMs ?? Date.now(),
            state: applyStateDefaults(migratedState)
        };
    }
    if (save.schemaVersion === 2) {
        const migratedState = {
            ...save.state,
            schemaVersion: SCHEMA_VERSION
        };
        return {
            schemaVersion: SCHEMA_VERSION,
            savedAtMs: save.savedAtMs ?? Date.now(),
            state: applyStateDefaults(migratedState)
        };
    }
    if (isLegacySerializedSaveV1(save)) {
        const migratedState = {
            schemaVersion: SCHEMA_VERSION,
            seed: Math.max(1, Math.floor(save.savedAtMs % 1000000)),
            resources: {
                essence: save.state.essence ?? 0,
                insight: save.state.insight ?? 0,
                research: 0,
                reputation: 0
            },
            runStats: {
                essenceEarned: 0,
                contractsCompleted: 0
            },
            production: save.state.production,
            upgrades: save.state.upgrades ?? initializeUpgradesRecord(),
            research: initializeResearchState(),
            lastFocusAtMs: save.state.lastFocusAtMs ?? -FOCUS_COOLDOWN_MS,
            contracts: createInitialContractsState()
        };
        return {
            schemaVersion: SCHEMA_VERSION,
            savedAtMs: save.savedAtMs,
            state: applyStateDefaults(migratedState)
        };
    }
    // Unknown future version: best effort align to latest.
    return {
        schemaVersion: SCHEMA_VERSION,
        savedAtMs: "savedAtMs" in save ? save.savedAtMs : Date.now(),
        state: applyStateDefaults({
            ...save.state,
            schemaVersion: SCHEMA_VERSION
        })
    };
}
function applyStateDefaults(state) {
    const research = applyResearchDefaults(state.research);
    const withResources = {
        ...state,
        schemaVersion: SCHEMA_VERSION,
        seed: state.seed ?? 1,
        resources: {
            essence: state.resources?.essence ?? 0,
            insight: state.resources?.insight ?? 0,
            research: state.resources?.research ?? 0,
            reputation: state.resources?.reputation ?? 0
        },
        runStats: {
            essenceEarned: state.runStats?.essenceEarned ?? 0,
            contractsCompleted: state.runStats?.contractsCompleted ?? 0
        },
        contracts: state.contracts
            ? {
                maxSlots: state.contracts.maxSlots ??
                    state.contracts.slots?.length ??
                    createInitialContractsState().maxSlots,
                slots: state.contracts.slots ?? createInitialContractsState().slots
            }
            : createInitialContractsState(),
        research,
        upgrades: state.upgrades ?? initializeUpgradesRecord(),
        lastFocusAtMs: state.lastFocusAtMs ?? -FOCUS_COOLDOWN_MS,
        production: state.production ?? {
            basePerSecond: 1,
            additiveBonus: 0,
            multiplier: 1,
            perSecond: 1
        }
    };
    const desiredSlots = BASE_CONTRACT_SLOTS + getResearchModifiers({ ...withResources, research }).contractSlotsBonus;
    const withContracts = ensureContractSlotCount(withResources, Math.max(desiredSlots, withResources.contracts.maxSlots));
    return calculateProduction(withContracts);
}
