import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_WEIGHTS = {
  research: 3,
  reputation: 2,
  essence: 1
};

export const DEFAULT_CONFIG = {
  seconds: 600,
  tickMs: 50,
  seed: 1,
  timelineEverySec: 60,
  out: "sim-output.json",
  weights: DEFAULT_WEIGHTS
};

function normalizeConfig(config = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    weights: {
      ...DEFAULT_WEIGHTS,
      ...(config.weights ?? {})
    }
  };
}

function parseArgs(argv) {
  const config = structuredClone(DEFAULT_CONFIG);
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case "--seconds":
        config.seconds = Number(next);
        i += 1;
        break;
      case "--tickMs":
        config.tickMs = Number(next);
        i += 1;
        break;
      case "--seed":
        config.seed = Number(next);
        i += 1;
        break;
      case "--timelineEverySec":
        config.timelineEverySec = Number(next);
        i += 1;
        break;
      case "--out":
        config.out = next;
        i += 1;
        break;
      case "--weightResearch":
        config.weights.research = Number(next);
        i += 1;
        break;
      case "--weightReputation":
        config.weights.reputation = Number(next);
        i += 1;
        break;
      case "--weightEssence":
        config.weights.essence = Number(next);
        i += 1;
        break;
      default:
        break;
    }
  }
  return config;
}

export function runBuild() {
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  execFileSync(npmCmd, ["run", "build:engine"], { stdio: "inherit" });
}

function contractScore(def, weights) {
  const rewardResearch = def.reward.research ?? 0;
  const rewardReputation = def.reward.reputation ?? 0;
  const rewardEssence = def.reward.essence ?? 0;
  const durationSeconds = def.durationMs / 1000;
  const numerator =
    weights.research * rewardResearch +
    weights.reputation * rewardReputation +
    weights.essence * rewardEssence;
  return durationSeconds > 0 ? numerator / durationSeconds : numerator;
}

function canAcceptContract(state, slot, def) {
  if (slot.status !== "idle") return false;
  const requiredReputation = def.requiredReputation ?? 0;
  const requiredEssencePerSecond = def.requiredEssencePerSecond ?? 0;
  const acceptCostEssence = def.acceptCostEssence ?? 0;
  const active = state.contracts.slots.filter((s) => s.status === "active").length;
  if (active >= state.contracts.maxSlots) return false;
  if (state.resources.reputation < requiredReputation) return false;
  if (state.production.perSecond < requiredEssencePerSecond) return false;
  if (state.resources.essence < acceptCostEssence) return false;
  return true;
}

function snapshotState(state, totals, elapsedMs) {
  return {
    tSec: elapsedMs / 1000,
    essence: state.resources.essence,
    eps: state.production.perSecond,
    insight: state.resources.insight,
    reputation: state.resources.reputation,
    researchPoints: state.resources.research,
    contractsActive: state.contracts.slots.filter((slot) => slot.status === "active").length,
    contractsCompletedTotal: totals.contractsCompleted
  };
}

export async function runSim(userConfig = {}) {
  const config = normalizeConfig(userConfig);

  const { tick, applyAction } = await import("../dist/engine/sim.js");
  const { createInitialState } = await import("../dist/engine/save.js");
  const { calculateInsightGain, canAscend } = await import("../dist/engine/progression.js");
  const { canBuyResearch } = await import("../dist/engine/research.js");
  const { canBreakthrough } = await import("../dist/engine/progressionRealm.js");
  const { RESEARCH_DEFINITIONS } = await import("../dist/engine/data/research.js");
  const { UPGRADE_DEFINITIONS } = await import("../dist/engine/data/upgrades.js");
  const { CONTRACT_DEFINITIONS } = await import("../dist/engine/data/contracts.js");

  let state = createInitialState(config.seed);
  const totals = {
    ascends: 0,
    insightGained: 0,
    contractsAccepted: 0,
    contractsCompleted: 0,
    upgradesPurchased: 0,
    researchPurchasedCount: 0
  };

  let elapsedMs = 0;
  const timeline = [];
  const timelineIntervalMs = config.timelineEverySec > 0 ? config.timelineEverySec * 1000 : null;
  if (timelineIntervalMs !== null) {
    timeline.push(snapshotState(state, totals, elapsedMs));
  }

  function completeContracts() {
    for (const slot of state.contracts.slots) {
      if (slot.status !== "completed") continue;
      const nextState = applyAction(state, { type: "completeContract", contractId: slot.id });
      if (nextState !== state) {
        totals.contractsCompleted += 1;
        state = nextState;
      }
    }
  }

  function buyResearchIfPossible() {
    for (const def of RESEARCH_DEFINITIONS) {
      if (canBuyResearch(state, def.id)) {
        const next = applyAction(state, { type: "buyResearch", researchId: def.id });
        if (next !== state) {
          totals.researchPurchasedCount += 1;
          state = next;
        }
      }
    }
  }

  function attemptBreakthrough() {
    while (canBreakthrough(state)) {
      const next = applyAction(state, { type: "breakthrough" });
      if (next === state) {
        break;
      }
      state = next;
    }
  }

  function tryAscend() {
    if (!canAscend(state)) return;
    const { gain } = calculateInsightGain(state);
    if (gain < 1) return;
    const next = applyAction(state, { type: "ascend" });
    if (next !== state) {
      totals.ascends += 1;
      totals.insightGained += gain;
      state = next;
    }
  }

  function buyUpgrades() {
    for (const def of UPGRADE_DEFINITIONS) {
      // Buy until unaffordable to keep deterministic
      while (true) {
        const next = applyAction(state, { type: "buyUpgrade", upgradeId: def.id });
        if (next === state) break;
        totals.upgradesPurchased += 1;
        state = next;
      }
    }
  }

  function fillContracts() {
    while (true) {
      const active = state.contracts.slots.filter((slot) => slot.status === "active").length;
      if (active >= state.contracts.maxSlots) {
        return;
      }

      const idleCandidates = state.contracts.slots
        .filter((slot) => slot.status === "idle")
        .map((slot) => {
          const def = CONTRACT_DEFINITIONS.find((c) => c.id === slot.id);
          return { slot, def };
        })
        .filter(
          (item) => item.def && canAcceptContract(state, item.slot, item.def)
        );

      if (idleCandidates.length === 0) {
        return;
      }

      idleCandidates.sort((a, b) => {
        const scoreDiff = contractScore(b.def, config.weights) - contractScore(a.def, config.weights);
        if (Math.abs(scoreDiff) > 1e-9) {
          return scoreDiff;
        }
        return a.def.id.localeCompare(b.def.id);
      });

      const chosen = idleCandidates[0];
      const next = applyAction(state, { type: "acceptContract", contractId: chosen.def.id });
      if (next === state) {
        return;
      }
      totals.contractsAccepted += 1;
      state = next;
    }
  }

  while (elapsedMs < config.seconds * 1000) {
    completeContracts();
    buyResearchIfPossible();
    attemptBreakthrough();
    tryAscend();
    buyUpgrades();
    fillContracts();

    state = tick(state, config.tickMs);
    elapsedMs += config.tickMs;

    if (timelineIntervalMs !== null && elapsedMs % timelineIntervalMs === 0) {
      timeline.push(snapshotState(state, totals, elapsedMs));
    }
  }

  const purchasedResearch = Object.entries(state.research.nodes)
    .filter(([, node]) => node.purchased)
    .map(([id]) => id);

  const summary = {
    config: {
      seconds: config.seconds,
      tickMs: config.tickMs,
      seed: config.seed,
      timelineEverySec: config.timelineEverySec,
      weights: config.weights
    },
    totals: {
      ascends: totals.ascends,
      insightGained: totals.insightGained,
      contractsAccepted: totals.contractsAccepted,
      contractsCompleted: totals.contractsCompleted,
      upgradesPurchased: totals.upgradesPurchased,
      researchPurchasedCount: totals.researchPurchasedCount
    },
    final: {
      resources: state.resources,
      productionPerSecond: state.production.perSecond,
      reputation: state.resources.reputation,
      researchPoints: state.resources.research,
      insight: state.resources.insight,
      essence: state.resources.essence,
      runStats: state.runStats
    },
    purchasedResearch,
    upgradesLevels: state.upgrades
  };

  return {
    summary,
    timeline
  };
}

async function runFromCli() {
  const config = parseArgs(process.argv.slice(2));
  runBuild();
  const output = await runSim(config);

  const outputPath = resolve(dirname(fileURLToPath(import.meta.url)), "..", config.out);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output, null, 2));
  console.log(`Sim output written to ${outputPath}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runFromCli().catch((error) => {
    console.error("Simulation failed:", error);
    process.exit(1);
  });
}
