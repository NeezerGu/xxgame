import { describe, expect, it } from "vitest";
import { createInitialState } from "./save";
import { addResources, getResource } from "./resources";
import { applyUpgradeFacility, createInitialFacilitiesState, getFacilityUpgradeCost } from "./facilities";
import { applyAction, tick } from "./sim";

describe("facilities", () => {
  it("spends essence and raises level when upgrading", () => {
    const base = createInitialState(0);
    const cost = getFacilityUpgradeCost(base, "guildHall");
    const withEssence = {
      ...base,
      resources: addResources(base.resources, { essence: cost })
    };
    const upgraded = applyUpgradeFacility(withEssence, "guildHall");

    expect(upgraded.facilities.guildHall.level).toBe(1);
    expect(getResource(upgraded.resources, "essence")).toBe(0);
  });

  it("guild hall adds commission capacity", () => {
    const base = createInitialState(0);
    const cost = getFacilityUpgradeCost(base, "guildHall");
    const withEssence = {
      ...base,
      resources: addResources(base.resources, { essence: cost })
    };
    const upgraded = applyAction(withEssence, { type: "upgradeFacility", facilityId: "guildHall" });

    expect(upgraded.contracts.maxSlots).toBeGreaterThan(base.contracts.maxSlots);
  });

  it("lab and forge speed multipliers accelerate queues", () => {
    const base = createInitialState(0);
    const baseFacilities = createInitialFacilitiesState();
    const boostedFacilities = createInitialFacilitiesState();
    boostedFacilities.forge.level = 1;
    boostedFacilities.lab.level = 1;

    const forgingQueue = {
      active: {
        blueprintId: "ember-shiv",
        remainingMs: 10_000,
        totalMs: 10_000,
        rarity: "common",
        affixes: []
      },
      lastFinished: null
    };
    const alchemyQueue = {
      active: {
        recipeId: "ember-elixir",
        remainingMs: 10_000,
        totalMs: 10_000
      },
      lastFinished: null
    };

    const baseline = tick(
      { ...base, facilities: baseFacilities, forgingQueue, alchemyQueue },
      1000
    );
    const boosted = tick(
      { ...base, facilities: boostedFacilities, forgingQueue, alchemyQueue },
      1000
    );

    expect(boosted.forgingQueue.active?.remainingMs).toBeLessThan(baseline.forgingQueue.active?.remainingMs ?? 0);
    expect(boosted.alchemyQueue.active?.remainingMs).toBeLessThan(baseline.alchemyQueue.active?.remainingMs ?? 0);
  });
});
