import { describe, expect, it } from "vitest";
import { computeContractScore, DEFAULT_CONTRACT_WEIGHTS } from "./contractScore";

describe("computeContractScore", () => {
  it("prefers shorter duration for same rewards", () => {
    const longer = computeContractScore({
      rewardResearch: 10,
      rewardReputation: 5,
      rewardEssence: 20,
      durationMs: 20_000
    });
    const shorter = computeContractScore({
      rewardResearch: 10,
      rewardReputation: 5,
      rewardEssence: 20,
      durationMs: 10_000
    });

    expect(shorter).toBeGreaterThan(longer);
  });

  it("reduces score when accept cost lowers net essence", () => {
    const withoutCost = computeContractScore({
      rewardEssence: 30,
      rewardResearch: 5,
      rewardReputation: 3,
      acceptCostEssence: 0,
      durationMs: 15_000
    });
    const withCost = computeContractScore({
      rewardEssence: 30,
      rewardResearch: 5,
      rewardReputation: 3,
      acceptCostEssence: 10,
      durationMs: 15_000
    });

    expect(withCost).toBeLessThan(withoutCost);
  });

  it("changes score when weights change", () => {
    const defaultScore = computeContractScore({
      rewardResearch: 6,
      rewardReputation: 2,
      rewardEssence: 10,
      durationMs: 12_000,
      weights: DEFAULT_CONTRACT_WEIGHTS
    });
    const reputationHeavy = computeContractScore({
      rewardResearch: 6,
      rewardReputation: 2,
      rewardEssence: 10,
      durationMs: 12_000,
      weights: { research: 1, reputation: 5, essence: 1 }
    });

    expect(reputationHeavy).not.toBe(defaultScore);
  });
});
