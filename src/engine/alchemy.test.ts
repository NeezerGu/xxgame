import { describe, expect, it } from "vitest";
import { createInitialState } from "./save";
import { addResources } from "./resources";
import { computeOfflineProgress } from "./offline";
import { calculateProduction } from "./state";
import { consumeItem, createEmptyConsumables, progressAlchemy, startAlchemy } from "./alchemy";
import { findAlchemyRecipe } from "./data/alchemy";

describe("alchemy system", () => {
  it("completes a brew and grants consumables", () => {
    const base = createInitialState(0);
    const withResources = {
      ...base,
      resources: addResources(base.resources, { herb: 50, essence: 100 })
    };
    const started = startAlchemy(withResources, "ember-elixir");
    expect(started.alchemyQueue.active).not.toBeNull();

    const recipe = findAlchemyRecipe("ember-elixir");
    const completed = progressAlchemy(started, recipe.durationMs, 1);
    expect(completed.alchemyQueue.active).toBeNull();
    expect(completed.consumables["ember-elixir"]).toBeGreaterThan(0);
  });

  it("consuming an item applies its buff to production", () => {
    const base = createInitialState(0);
    const inventory = createEmptyConsumables();
    inventory["ember-elixir"] = 1;
    const consumed = consumeItem({ ...base, consumables: inventory }, "ember-elixir");
    const withBuff = calculateProduction(consumed);
    expect(withBuff.production.perSecond).toBeGreaterThan(base.production.perSecond);
  });

  it("offline progress finishes brews and decays buffs", () => {
    const base = createInitialState(0);
    const withResources = {
      ...base,
      resources: addResources(base.resources, { herb: 50, essence: 100 })
    };
    const started = startAlchemy(withResources, "ember-elixir");
    const offlineResult = computeOfflineProgress(started, 0, 30_000).state;
    expect(offlineResult.consumables["ember-elixir"]).toBeGreaterThan(0);

    const buffed = {
      ...offlineResult,
      consumables: { ...offlineResult.consumables, "quicksign-tonic": 0 },
      buffs: [
        {
          id: "quicksign-tonic" as const,
          remainingMs: 10_000,
          effects: { contractSpeedMult: 1.15 }
        }
      ]
    };
    const afterOffline = computeOfflineProgress(buffed, 0, 2_000).state;
    expect(afterOffline.buffs[0]?.remainingMs).toBeLessThan(10_000);
  });
});
