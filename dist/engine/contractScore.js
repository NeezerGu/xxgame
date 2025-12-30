export const DEFAULT_CONTRACT_WEIGHTS = {
    research: 3,
    reputation: 2,
    essence: 1
};
export function computeContractScore({ rewardResearch, rewardReputation, rewardEssence, rewardHerb, rewardOre, acceptCostEssence, durationMs, weights = DEFAULT_CONTRACT_WEIGHTS }) {
    const durationSec = Math.max(1, durationMs / 1000);
    const netEssence = (rewardEssence ?? 0) + (rewardHerb ?? 0) + (rewardOre ?? 0) - (acceptCostEssence ?? 0);
    const score = (weights.research * (rewardResearch ?? 0) +
        weights.reputation * (rewardReputation ?? 0) +
        weights.essence * netEssence) /
        durationSec;
    return score;
}
