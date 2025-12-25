import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runBuild } from "./sim-runner.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENGINE_DIST = resolve(__dirname, "..", "dist", "engine");
const OUTPUT_DIR = resolve(__dirname, "..", "docs", "balance");

async function loadModule(modulePath) {
  const fullPath = resolve(ENGINE_DIST, modulePath);
  return import(pathToFileURL(fullPath).href);
}

function formatUpgradeEffect(effect) {
  if (!effect) return "";
  if (effect.type === "add") {
    return `+${effect.amount}/s`;
  }
  if (effect.type === "mult") {
    return `x${effect.factor}`;
  }
  return "";
}

function formatResearchEffect(effect) {
  switch (effect.type) {
    case "contractSpeed":
      return `speed x${effect.multiplier}`;
    case "productionMultiplier":
      return `prod x${effect.multiplier}`;
    case "contractSlot":
      return `+${effect.bonus} slot(s)`;
    default:
      return "";
  }
}

function renderTable(headers, rows) {
  const headerLine = `| ${headers.join(" | ")} |`;
  const separator = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
  return `${headerLine}\n${separator}\n${body}\n`;
}

async function main() {
  runBuild();

  const {
    OFFLINE_CAP_MS,
    INSIGHT_GAIN_A,
    INSIGHT_GAIN_B,
    INSIGHT_GAIN_C,
    INSIGHT_PROD_BONUS_PER_POINT,
    BASE_CONTRACT_SLOTS
  } = await loadModule("data/constants.js");
  const { UPGRADE_DEFINITIONS } = await loadModule("data/upgrades.js");
  const { RESEARCH_DEFINITIONS } = await loadModule("data/research.js");
  const { CONTRACT_DEFINITIONS } = await loadModule("data/contracts.js");
  const { ASCEND_THRESHOLD } = await loadModule("progression.js");
  const { FOCUS_GAIN, FOCUS_COOLDOWN_MS } = await loadModule("sim.js");

  const balanceJson = {
    constants: {
      ASCEND_THRESHOLD,
      BASE_CONTRACT_SLOTS,
      FOCUS_COOLDOWN_MS,
      FOCUS_GAIN,
      INSIGHT_GAIN_A,
      INSIGHT_GAIN_B,
      INSIGHT_GAIN_C,
      INSIGHT_PROD_BONUS_PER_POINT,
      OFFLINE_CAP_MS
    },
    upgrades: UPGRADE_DEFINITIONS,
    research: RESEARCH_DEFINITIONS,
    contracts: CONTRACT_DEFINITIONS
  };

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const jsonPath = resolve(OUTPUT_DIR, "balance.json");
  writeFileSync(jsonPath, JSON.stringify(balanceJson, null, 2));

  const upgradeRows = UPGRADE_DEFINITIONS.map((u) => [u.id, u.cost, u.effect.type, formatUpgradeEffect(u.effect)]);
  const researchRows = RESEARCH_DEFINITIONS.map((r) => [
    r.id,
    r.costResearch,
    r.effect.type,
    formatResearchEffect(r.effect),
    (r.prerequisites ?? []).join(", ") || "-"
  ]);
  const contractRows = CONTRACT_DEFINITIONS.map((c) => [
    c.id,
    c.durationMs / 1000,
    c.reward.research ?? 0,
    c.reward.reputation ?? 0,
    c.reward.essence ?? 0,
    c.requiredEssencePerSecond ?? 0,
    c.requiredReputation ?? 0
  ]);
  const constantsRows = Object.entries(balanceJson.constants).map(([key, value]) => [key, value]);

  const mdSections = [
    "# 基础平衡表",
    "",
    "## 升级",
    renderTable(["ID", "Cost", "Effect Type", "Effect"], upgradeRows),
    "## 研究",
    renderTable(["ID", "Cost Research", "Effect Type", "Effect", "Prerequisites"], researchRows),
    "## 契约",
    renderTable(
      ["ID", "Duration(s)", "Reward Research", "Reward Reputation", "Reward Essence", "Req EPS", "Req Reputation"],
      contractRows
    ),
    "## 关键常量",
    renderTable(["Key", "Value"], constantsRows)
  ];

  const mdPath = resolve(OUTPUT_DIR, "balance.md");
  writeFileSync(mdPath, mdSections.join("\n"));

  console.log(`Balance data written to:\n- ${jsonPath}\n- ${mdPath}`);
}

main().catch((err) => {
  console.error("balance:dump failed:", err);
  process.exit(1);
});
