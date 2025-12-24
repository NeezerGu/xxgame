import { describe, expect, it } from "vitest";
import { applyAction, tick, FOCUS_COOLDOWN_MS, FOCUS_GAIN } from "./sim";
import { computeOfflineProgress } from "./offline";
import { createInitialState, deserialize, SCHEMA_VERSION } from "./save";
import { getContractProgress } from "./contracts";
import { calculateProduction } from "./state";

const APPROX_EPSILON = 1e-9;

function statesAreClose(a: number, b: number, epsilon: number = APPROX_EPSILON) {
  expect(Math.abs(a - b)).toBeLessThanOrEqual(epsilon);
}

describe("simulation determinism", () => {
  it("produces the same output for identical inputs", () => {
    const initial = createInitialState(0);
    const dt = 1000;

    const resultA = tick(initial, dt);
    const resultB = tick(initial, dt);

    statesAreClose(resultA.resources.essence, resultB.resources.essence);
    statesAreClose(resultA.production.perSecond, resultB.production.perSecond);
  });
});

describe("upgrades", () => {
  it("buying an upgrade reduces essence and increases production", () => {
    const base = createInitialState(0);
    const starting = {
      ...base,
      resources: { ...base.resources, essence: 100 }
    };

    const updated = applyAction(starting, { type: "buyUpgrade", upgradeId: "spark" });

    expect(updated.resources.essence).toBeCloseTo(90);
    expect(updated.production.perSecond).toBeGreaterThan(starting.production.perSecond);
  });
});

describe("insight bonuses", () => {
  it("scales production based on accumulated insight", () => {
    const base = createInitialState(0);
    const withInsight = calculateProduction({
      ...base,
      resources: { ...base.resources, insight: 10 }
    });

    expect(withInsight.production.perSecond).toBeGreaterThan(base.production.perSecond);
  });
});

describe("focus action", () => {
  it("respects cooldown before granting essence again", () => {
    const initial = createInitialState(0);
    const first = applyAction(initial, { type: "focus", performedAtMs: 0 });
    const second = applyAction(first, { type: "focus", performedAtMs: FOCUS_COOLDOWN_MS / 2 });
    const third = applyAction(second, { type: "focus", performedAtMs: FOCUS_COOLDOWN_MS + 10 });

    expect(first.resources.essence).toBeGreaterThan(initial.resources.essence);
    expect(second.resources.essence).toBe(first.resources.essence);
    expect(third.resources.essence).toBeCloseTo(first.resources.essence + FOCUS_GAIN);
  });
});

describe("offline progress", () => {
  it("caps applied offline time at the provided maximum", () => {
    const starting = createInitialState(0);
    const tenHoursMs = 10 * 60 * 60 * 1000;
    const { state, appliedMs } = computeOfflineProgress(starting, 0, tenHoursMs);

    expect(appliedMs).toBe(8 * 60 * 60 * 1000);
    expect(state.resources.essence).toBeCloseTo(28800);
  });
});

describe("contracts", () => {
  it("can accept, progress, and complete to gain rewards", () => {
    const base = createInitialState(0);
    const accepted = applyAction(base, { type: "acceptContract", contractId: "starter-recon" });
    const activeSlot = accepted.contracts.slots.find((slot) => slot.id === "starter-recon");
    expect(activeSlot?.status).toBe("active");

    const progressed = tick(accepted, 12_000);
    const completedSlot = progressed.contracts.slots.find((slot) => slot.id === "starter-recon");
    expect(completedSlot?.status).toBe("completed");
    expect(getContractProgress(completedSlot!)).toBeCloseTo(1);

    const claimed = applyAction(progressed, { type: "completeContract", contractId: "starter-recon" });
    const resetSlot = claimed.contracts.slots.find((slot) => slot.id === "starter-recon");
    expect(resetSlot?.status).toBe("idle");
    expect(claimed.resources.research).toBeGreaterThan(base.resources.research);
    expect(claimed.resources.essence).toBeGreaterThan(base.resources.essence);
  });

  it("progresses during offline simulation", () => {
    const base = createInitialState(0);
    const accepted = applyAction(base, { type: "acceptContract", contractId: "essence-delivery" });
    const { state } = computeOfflineProgress(accepted, 0, 25_000);
    const slot = state.contracts.slots.find((s) => s.id === "essence-delivery");
    expect(slot?.status).toBe("completed");
  });
});

describe("research system", () => {
  it("purchasing research spends currency and applies modifiers", () => {
    const base = createInitialState(0);
    const funded = {
      ...base,
      resources: { ...base.resources, research: 30 }
    };

    const withSpeed = applyAction(funded, { type: "buyResearch", researchId: "contractSpeed" });
    expect(withSpeed.resources.research).toBeCloseTo(24);
    expect(withSpeed.research.nodes.contractSpeed.purchased).toBe(true);

    const withProduction = applyAction(withSpeed, { type: "buyResearch", researchId: "productionBoost" });
    expect(withProduction.production.perSecond).toBeGreaterThan(withSpeed.production.perSecond);

    const withSlot = applyAction(withProduction, { type: "buyResearch", researchId: "extraContractSlot" });
    expect(withSlot.contracts.slots.length).toBeGreaterThan(base.contracts.slots.length);
  });
});

describe("save migration", () => {
  it("upgrades legacy schema to latest and seeds new fields", () => {
    const legacy = {
      schemaVersion: 1,
      savedAtMs: 0,
      state: {
        schemaVersion: 1,
        essence: 10,
        insight: 5,
        production: createInitialState(0).production,
        upgrades: createInitialState(0).upgrades,
        lastFocusAtMs: null
      }
    };

    const migrated = deserialize(JSON.stringify(legacy));
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
    expect(migrated.state.resources.essence).toBe(10);
    expect(migrated.state.resources.research).toBe(0);
    expect(migrated.state.contracts.slots.length).toBeGreaterThanOrEqual(3);
  });

  it("hydrates missing research data when migrating schema v2 saves", () => {
    const legacy = {
      schemaVersion: 2,
      savedAtMs: 0,
      state: {
        ...createInitialState(0),
        schemaVersion: 2
      }
    };
    // @ts-expect-error simulate legacy save without research field
    delete legacy.state.research;

    const migrated = deserialize(JSON.stringify(legacy));
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
    expect(Object.values(migrated.state.research.nodes)).toHaveLength(3);
    expect(migrated.state.contracts.slots.length).toBeGreaterThanOrEqual(3);
  });
});
