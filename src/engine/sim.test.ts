import { describe, expect, it } from "vitest";
import { applyAction, tick, FOCUS_COOLDOWN_MS, FOCUS_GAIN } from "./sim";
import { computeOfflineProgress } from "./offline";
import { createInitialState, deserialize, SCHEMA_VERSION } from "./save";
import { getContractProgress } from "./contracts";
import { calculateProduction } from "./state";
import { calculateInsightGain, ASCEND_THRESHOLD } from "./progression";

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

describe("run stats tracking", () => {
  it("accumulates essence earned during tick and focus", () => {
    const base = createInitialState(0);
    const ticked = tick(base, 1000);
    expect(ticked.runStats.essenceEarned).toBeCloseTo(base.production.perSecond);

    const focused = applyAction(ticked, { type: "focus", performedAtMs: FOCUS_COOLDOWN_MS + 10 });
    expect(focused.runStats.essenceEarned).toBeCloseTo(ticked.runStats.essenceEarned + FOCUS_GAIN);
  });

  it("increments contracts completed and essence from contract rewards", () => {
    const base = createInitialState(0);
    const accepted = applyAction(base, { type: "acceptContract", contractId: "starter-recon" });
    const progressed = tick(accepted, 10_000);
    const claimed = applyAction(progressed, { type: "completeContract", contractId: "starter-recon" });

    expect(claimed.runStats.contractsCompleted).toBe(1);
    expect(claimed.runStats.essenceEarned).toBeCloseTo(progressed.runStats.essenceEarned + 15);
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
    const funded = {
      ...base,
      resources: { ...base.resources, essence: 10 }
    };
    const accepted = applyAction(funded, { type: "acceptContract", contractId: "essence-delivery" });
    const { state } = computeOfflineProgress(accepted, 0, 25_000);
    const slot = state.contracts.slots.find((s) => s.id === "essence-delivery");
    expect(slot?.status).toBe("completed");
  });

  it("does not accept a contract when reputation is insufficient", () => {
    const base = createInitialState(0);
    const attempted = applyAction(base, { type: "acceptContract", contractId: "field-analysis" });
    const slot = attempted.contracts.slots.find((s) => s.id === "field-analysis");
    expect(slot?.status).toBe("idle");
  });

  it("accepts a contract when reputation meets requirement", () => {
    const base = createInitialState(0);
    const withReputation = {
      ...base,
      resources: { ...base.resources, reputation: 20, essence: 40 },
      production: { ...base.production, basePerSecond: 2, perSecond: 2 }
    };
    const accepted = applyAction(withReputation, { type: "acceptContract", contractId: "field-analysis" });
    const slot = accepted.contracts.slots.find((s) => s.id === "field-analysis");
    expect(slot?.status).toBe("active");
  });

  it("does not accept when essence cost is not met", () => {
    const base = createInitialState(0);
    const funded = {
      ...base,
      resources: { ...base.resources, essence: 3 }
    };
    const attempted = applyAction(funded, { type: "acceptContract", contractId: "essence-delivery" });
    const slot = attempted.contracts.slots.find((s) => s.id === "essence-delivery");
    expect(slot?.status).toBe("idle");
    expect(attempted.resources.essence).toBeCloseTo(3);
  });

  it("accepts and deducts cost when constraints are met", () => {
    const base = createInitialState(0);
    const funded = {
      ...base,
      resources: { ...base.resources, reputation: 15, essence: 20 },
      production: { ...base.production, basePerSecond: 2, perSecond: 2 }
    };
    const accepted = applyAction(funded, { type: "acceptContract", contractId: "field-analysis" });
    const slot = accepted.contracts.slots.find((s) => s.id === "field-analysis");
    expect(slot?.status).toBe("active");
    expect(accepted.resources.essence).toBeCloseTo(5);
  });

  it("requires sufficient production rate to accept constrained contracts", () => {
    const base = createInitialState(0);
    const funded = {
      ...base,
      resources: { ...base.resources, reputation: 30, essence: 100 }
    };
    const blocked = applyAction(funded, { type: "acceptContract", contractId: "stabilize-array" });
    const blockedSlot = blocked.contracts.slots.find((s) => s.id === "stabilize-array");
    expect(blockedSlot?.status).toBe("idle");
    expect(blocked.resources.essence).toBeCloseTo(100);

    const boosted = {
      ...funded,
      production: { ...funded.production, basePerSecond: 3, perSecond: 3 }
    };
    const allowed = applyAction(boosted, { type: "acceptContract", contractId: "stabilize-array" });
    const allowedSlot = allowed.contracts.slots.find((s) => s.id === "stabilize-array");
    expect(allowedSlot?.status).toBe("active");
    expect(allowed.resources.essence).toBeCloseTo(70);
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
    expect(withSlot.contracts.maxSlots).toBeGreaterThan(base.contracts.maxSlots);
  });
});

describe("insight gain calculation", () => {
  it("produces deterministic output for identical state", () => {
    const base = createInitialState(0);
    const rich = {
      ...base,
      resources: { ...base.resources, essence: ASCEND_THRESHOLD },
      runStats: { essenceEarned: 1500, contractsCompleted: 3 }
    };

    const first = calculateInsightGain(rich);
    const second = calculateInsightGain(rich);
    expect(first.gain).toBe(second.gain);
    expect(first.essenceTerm).toBeCloseTo(second.essenceTerm);
    expect(first.contractTerm).toBeCloseTo(second.contractTerm);
  });

  it("does not decrease when contracts completed increases", () => {
    const base = createInitialState(0);
    const low = {
      ...base,
      resources: { ...base.resources, essence: ASCEND_THRESHOLD },
      runStats: { essenceEarned: 2000, contractsCompleted: 1 }
    };
    const high = {
      ...low,
      runStats: { essenceEarned: 2000, contractsCompleted: 4 }
    };

    const lowGain = calculateInsightGain(low);
    const highGain = calculateInsightGain(high);
    expect(highGain.gain).toBeGreaterThanOrEqual(lowGain.gain);
  });

  it("does not decrease when essence earned increases", () => {
    const base = createInitialState(0);
    const lower = {
      ...base,
      resources: { ...base.resources, essence: ASCEND_THRESHOLD },
      runStats: { essenceEarned: 500, contractsCompleted: 2 }
    };
    const higher = {
      ...lower,
      runStats: { essenceEarned: 1200, contractsCompleted: 2 }
    };

    const lowerGain = calculateInsightGain(lower);
    const higherGain = calculateInsightGain(higher);
    expect(higherGain.gain).toBeGreaterThanOrEqual(lowerGain.gain);
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

  it("applies defaults for missing run stats data", () => {
    const legacy = {
      schemaVersion: SCHEMA_VERSION,
      savedAtMs: 0,
      state: {
        ...createInitialState(0),
        // @ts-expect-error simulate legacy save without runStats
        runStats: undefined
      }
    };

    const migrated = deserialize(JSON.stringify(legacy));
    expect(migrated.state.runStats.essenceEarned).toBe(0);
    expect(migrated.state.runStats.contractsCompleted).toBe(0);
  });
});
