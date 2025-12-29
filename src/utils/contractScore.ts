export type ContractScoreWeights = {
  research: number;
  reputation: number;
  essence: number;
};

export const DEFAULT_CONTRACT_WEIGHTS: ContractScoreWeights = {
  research: 3,
  reputation: 2,
  essence: 1
};

interface ComputeContractScoreParams {
  rewardResearch?: number;
  rewardReputation?: number;
  rewardEssence?: number;
  rewardHerb?: number;
  rewardOre?: number;
  acceptCostEssence?: number;
  durationMs: number;
  weights?: ContractScoreWeights;
}

export function computeContractScore({
  rewardResearch,
  rewardReputation,
  rewardEssence,
  rewardHerb,
  rewardOre,
  acceptCostEssence,
  durationMs,
  weights = DEFAULT_CONTRACT_WEIGHTS
}: ComputeContractScoreParams): number {
  const durationSec = Math.max(1, durationMs / 1000);
  const netEssence =
    (rewardEssence ?? 0) + (rewardHerb ?? 0) + (rewardOre ?? 0) - (acceptCostEssence ?? 0);

  const score =
    (weights.research * (rewardResearch ?? 0) +
      weights.reputation * (rewardReputation ?? 0) +
      weights.essence * netEssence) /
    durationSec;

  return score;
}
