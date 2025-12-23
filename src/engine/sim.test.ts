import { describe, expect, it } from "vitest";
import { applyAction, tick } from "./sim";
import { computeOfflineProgress } from "./offline";
import { createInitialState } from "./save";

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

    statesAreClose(resultA.essence, resultB.essence);
    statesAreClose(resultA.production.perSecond, resultB.production.perSecond);
  });
});

describe("upgrades", () => {
  it("buying an upgrade reduces essence and increases production", () => {
    const starting = { ...createInitialState(0), essence: 100 };

    const updated = applyAction(starting, { type: "buyUpgrade", upgradeId: "spark" });

    expect(updated.essence).toBeCloseTo(90);
    expect(updated.production.perSecond).toBeGreaterThan(starting.production.perSecond);
  });
});

describe("offline progress", () => {
  it("caps applied offline time at the provided maximum", () => {
    const starting = createInitialState(0);
    const tenHoursMs = 10 * 60 * 60 * 1000;
    const { state, appliedMs } = computeOfflineProgress(starting, 0, tenHoursMs);

    expect(appliedMs).toBe(8 * 60 * 60 * 1000);
    expect(state.essence).toBeCloseTo(28800);
  });
});
