import { describe, expect, it } from "vitest";
import { breakthrough, canBreakthrough, getInitialRealmId } from "./progressionRealm";
import { createInitialState } from "./save";
import { ASCEND_THRESHOLD } from "./progression";
import { applyAction } from "./sim";

describe("realm progression", () => {
  it("blocks breakthrough when requirements are not met", () => {
    const base = createInitialState(0);
    expect(canBreakthrough(base)).toBe(false);
    const attempted = breakthrough(base);
    expect(attempted.realm.current).toBe(getInitialRealmId());
  });

  it("applies breakthrough and unlocks next realm when requirements are satisfied", () => {
    const base = createInitialState(0);
    const prepared = {
      ...base,
      runStats: { essenceEarned: 500, contractsCompleted: 5 },
      resources: { ...base.resources, reputation: 25 }
    };

    expect(canBreakthrough(prepared)).toBe(true);
    const advanced = breakthrough(prepared);
    expect(advanced.realm.current).not.toBe(getInitialRealmId());
    expect(advanced.realm.unlockedTabs).toContain("contracts");
  });

  it("resets realm to initial after ascending", () => {
    const base = createInitialState(0);
    const progressed = breakthrough({
      ...base,
      runStats: { essenceEarned: 500, contractsCompleted: 5 },
      resources: { ...base.resources, reputation: 25 }
    });
    const readyToAscend = {
      ...progressed,
      resources: { ...progressed.resources, essence: ASCEND_THRESHOLD }
    };

    const ascended = applyAction(readyToAscend, { type: "ascend" });
    expect(ascended.realm.current).toBe(getInitialRealmId());
  });
});
