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
  const { UPGRADE_DEFINITIONS, getUpgradeCost } = await loadModule("data/upgrades.js");
  const { RESEARCH_DEFINITIONS } = await loadModule("data/research.js");
  const { CONTRACT_DEFINITIONS } = await loadModule("data/contracts.js");
  const {
    EQUIPMENT_BLUEPRINTS,
    AFFIX_DEFINITIONS,
    FORGING_RARITY_WEIGHTS,
    FORGING_AFFIX_COUNT,
    DISASSEMBLE_REFUND_MULTIPLIER
  } = await loadModule("data/equipment.js");
  const { EXPEDITION_DEFINITIONS } = await loadModule("data/expeditions.js");
  const { DISCIPLE_ARCHETYPES, DISCIPLE_RECRUIT_COST, DISCIPLE_ROLE_EFFECTS } = await loadModule("data/disciples.js");
  const { ASCEND_THRESHOLD } = await loadModule("progression.js");
  const { FOCUS_GAIN, FOCUS_COOLDOWN_MS } = await loadModule("sim.js");
  const { RESOURCE_IDS } = await loadModule("resources.js");

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
    contracts: CONTRACT_DEFINITIONS,
    equipmentBlueprints: EQUIPMENT_BLUEPRINTS,
    equipmentAffixes: AFFIX_DEFINITIONS,
    forgingRarityWeights: FORGING_RARITY_WEIGHTS,
    forgingAffixCount: FORGING_AFFIX_COUNT,
    disassembleRefundMultiplier: DISASSEMBLE_REFUND_MULTIPLIER,
    expeditions: EXPEDITION_DEFINITIONS,
    disciples: {
      archetypes: DISCIPLE_ARCHETYPES,
      recruitCost: DISCIPLE_RECRUIT_COST,
      roleEffects: DISCIPLE_ROLE_EFFECTS
    }
  };

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const jsonPath = resolve(OUTPUT_DIR, "balance.json");
  writeFileSync(jsonPath, JSON.stringify(balanceJson, null, 2));

  const upgradeRows = UPGRADE_DEFINITIONS.map((u) => [
    u.id,
    u.baseCost,
    u.costGrowth,
    u.costExponent ?? 1,
    getUpgradeCost(u, 0),
    u.effect.type,
    formatUpgradeEffect(u.effect)
  ]);
  const researchRows = RESEARCH_DEFINITIONS.map((r) => [
    r.id,
    r.costResearch,
    r.effect.type,
    formatResearchEffect(r.effect),
    (r.prerequisites ?? []).join(", ") || "-"
  ]);
  const equipmentBlueprintRows = EQUIPMENT_BLUEPRINTS.map((b) => [
    b.id,
    b.slot,
    b.basePower,
    b.forgeTimeMs,
    b.cost.essence,
    b.cost.ore,
    b.nameKey,
    b.descriptionKey
  ]);
  const equipmentAffixRows = AFFIX_DEFINITIONS.map((a) => [
    a.id,
    a.nameKey,
    a.type,
    a.min,
    a.max
  ]);
  const rarityRows = Object.entries(FORGING_RARITY_WEIGHTS).map(([rarity, weight]) => [rarity, weight]);
  const affixCountRows = Object.entries(FORGING_AFFIX_COUNT).map(([rarity, count]) => [rarity, count]);
  const disassembleRows = Object.entries(DISASSEMBLE_REFUND_MULTIPLIER).map(([rarity, multiplier]) => [
    rarity,
    multiplier
  ]);
  const contractRows = CONTRACT_DEFINITIONS.map((c) => [
    c.id,
    c.durationMs / 1000,
    ...RESOURCE_IDS.map((id) => c.reward[id] ?? 0),
    c.requiredEssencePerSecond ?? 0,
    c.requiredReputation ?? 0
  ]);
  const expeditionRows = EXPEDITION_DEFINITIONS.map((e) => [
    e.id,
    e.durationMs / 1000,
    e.rewardRolls,
    e.staminaCost ?? "-",
    e.requiredRealm ?? "-",
    e.nameKey,
    e.descKey
  ]);
  const discipleRows = DISCIPLE_ARCHETYPES.map((d) => [
    d.id,
    d.baseAptitude,
    d.rolesAllowed.join(", "),
    d.nameKey,
    d.descriptionKey
  ]);
  const discipleEffectRows = Object.entries(DISCIPLE_ROLE_EFFECTS).map(([role, effect]) => [
    role,
    effect.autoClaim ? "yes" : "-",
    effect.autoAccept ? "yes" : "-",
    effect.forgingSpeedPerAptitude ?? 0,
    effect.alchemySpeedPerAptitude ?? 0,
    effect.herbPerSecondPerAptitude ?? 0,
    effect.orePerSecondPerAptitude ?? 0
  ]);
  const constantsRows = Object.entries(balanceJson.constants).map(([key, value]) => [key, value]);

  const mdSections = [
    "# 基础平衡表",
    "",
    "## 升级",
    renderTable(
      ["ID", "Base Cost", "Cost Growth", "Cost Exponent", "Level0 Cost", "Effect Type", "Effect"],
      upgradeRows
    ),
    "## 研究",
    renderTable(["ID", "Cost Research", "Effect Type", "Effect", "Prerequisites"], researchRows),
    "## 契约",
    renderTable(
      ["ID", "Duration(s)", ...RESOURCE_IDS.map((id) => `Reward ${id}`), "Req EPS", "Req Reputation"],
      contractRows
    ),
    "## 历练/秘境",
    renderTable(["ID", "Duration(s)", "Rolls", "Stamina", "Required Realm", "Name Key", "Desc Key"], expeditionRows),
    "## 弟子原型",
    renderTable(["ID", "Base Aptitude", "Allowed Roles", "Name Key", "Description Key"], discipleRows),
    "## 弟子岗位效果",
    renderTable(
      ["Role", "Auto Claim", "Auto Accept", "Forge Speed/apt", "Alchemy Speed/apt", "Herb/s/apt", "Ore/s/apt"],
      discipleEffectRows
    ),
    "## 装备蓝图",
    renderTable(
      ["ID", "Slot", "Base Power", "Forge Time(ms)", "Cost Essence", "Cost Ore", "Name Key", "Description Key"],
      equipmentBlueprintRows
    ),
    "## 装备词缀",
    renderTable(["ID", "Name Key", "Type", "Min", "Max"], equipmentAffixRows),
    "## 稀有度权重",
    renderTable(["Rarity", "Weight"], rarityRows),
    "## 词缀条目数",
    renderTable(["Rarity", "Affix Count"], affixCountRows),
    "## 分解返还倍率（基于蓝图 Ore 成本）",
    renderTable(["Rarity", "Refund Multiplier"], disassembleRows),
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
