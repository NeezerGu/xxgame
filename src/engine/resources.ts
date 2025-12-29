import type { ResourceId, ResourcesState } from "./types";

export const RESOURCE_IDS: ResourceId[] = ["essence", "insight", "research", "reputation", "herb", "ore"];

export function createEmptyResources(initial?: Partial<ResourcesState>): ResourcesState {
  return RESOURCE_IDS.reduce((acc, id) => {
    acc[id] = initial?.[id] ?? 0;
    return acc;
  }, {} as ResourcesState);
}

export function getResource(resources: ResourcesState, id: ResourceId): number {
  return resources[id] ?? 0;
}

export function addResources(
  resources: ResourcesState,
  delta: Partial<Record<ResourceId, number>>
): ResourcesState {
  const next = createEmptyResources(resources);
  for (const id of RESOURCE_IDS) {
    next[id] = getResource(next, id) + (delta[id] ?? 0);
  }
  return next;
}

export function canAfford(resources: ResourcesState, cost: Partial<Record<ResourceId, number>>): boolean {
  return Object.entries(cost).every(([key, value]) => {
    const id = key as ResourceId;
    return getResource(resources, id) >= (value ?? 0);
  });
}

export function spendResources(resources: ResourcesState, cost: Partial<Record<ResourceId, number>>): ResourcesState {
  const next = createEmptyResources(resources);
  for (const id of RESOURCE_IDS) {
    const spend = cost[id] ?? 0;
    next[id] = getResource(resources, id) - spend;
  }
  return next;
}
