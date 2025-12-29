export const RESOURCE_IDS = ["essence", "insight", "research", "reputation", "herb", "ore"];
export function createEmptyResources(initial) {
    return RESOURCE_IDS.reduce((acc, id) => {
        acc[id] = initial?.[id] ?? 0;
        return acc;
    }, {});
}
export function getResource(resources, id) {
    return resources[id] ?? 0;
}
export function addResources(resources, delta) {
    const next = createEmptyResources(resources);
    for (const id of RESOURCE_IDS) {
        next[id] = getResource(next, id) + (delta[id] ?? 0);
    }
    return next;
}
export function canAfford(resources, cost) {
    return Object.entries(cost).every(([key, value]) => {
        const id = key;
        return getResource(resources, id) >= (value ?? 0);
    });
}
export function spendResources(resources, cost) {
    const next = createEmptyResources(resources);
    for (const id of RESOURCE_IDS) {
        const spend = cost[id] ?? 0;
        next[id] = getResource(resources, id) - spend;
    }
    return next;
}
