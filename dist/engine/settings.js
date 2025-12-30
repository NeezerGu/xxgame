export function createDefaultSettings() {
    return {
        autoClaimContracts: true,
        autoAcceptMode: "recommended",
        autoAlchemy: false,
        autoForging: true
    };
}
export function mergeSettings(current, patch) {
    return {
        ...(current ?? createDefaultSettings()),
        ...patch
    };
}
