import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { computeOfflineProgress } from "@engine/offline";
import { ASCEND_THRESHOLD, calculateInsightGain, canAscend } from "@engine/progression";
import { deserialize, serialize, createInitialState } from "@engine/save";
import { applyAction, tick, FOCUS_COOLDOWN_MS } from "@engine/sim";
import { getContractProgress } from "@engine/contracts";
import type { EquipmentSlot, ExpeditionReward, GameState, ResourceId } from "@engine/types";
import { mergeSettings } from "@engine/settings";
import { UPGRADE_DEFINITIONS, getUpgradeCost } from "@engine/data/upgrades";
import { RESEARCH_DEFINITIONS } from "@engine/data/research";
import { CONTRACT_DEFINITIONS } from "@engine/data/contracts";
import { canBuyResearch } from "@engine/research";
import { canBreakthrough, getCurrentRealm, getNextRealm } from "@engine/progressionRealm";
import { getResource } from "@engine/resources";
import { getEquipmentModifiers, getRarityMultiplier } from "@engine/equipment";
import {
  AFFIX_DEFINITIONS,
  EQUIPMENT_BLUEPRINTS,
  findAffixDefinition,
  findEquipmentBlueprint
} from "@engine/data/equipment";
import { ALCHEMY_RECIPES, CONSUMABLE_DEFINITIONS, findAlchemyRecipe, findConsumableDefinition } from "@engine/data/alchemy";
import { isRecipeUnlocked } from "@engine/alchemy";
import {
  DISCIPLE_RECRUIT_COST,
  DISCIPLE_ROLE_EFFECTS,
  findDiscipleArchetype,
  type DiscipleRole
} from "@engine/data/disciples";
import { getDiscipleModifiers } from "@engine/disciples";
import { EXPEDITION_DEFINITIONS, findExpeditionDefinition, type ExpeditionId } from "@engine/data/expeditions";
import { getDefaultLocale, persistLocale, t, type Locale, type MessageKey } from "./i18n";
import { copyText } from "./utils/clipboard";
import { APP_VERSION, buildDiagnosticsPayload } from "./utils/diagnostics";
import { formatCompact, formatInt, formatSeconds } from "./utils/format";
import { safeReadStorage } from "./utils/storage";
import { computeContractScore, DEFAULT_CONTRACT_WEIGHTS } from "./utils/contractScore";
import {
  CONTRACT_HIDE_STORAGE_KEY,
  CONTRACT_SORT_STORAGE_KEY,
  SAVE_KEY,
  TAB_STORAGE_KEY
} from "./constants/storage";
import { OFFLINE_CAP_MS } from "@engine/data/constants";

const AUTO_SAVE_INTERVAL_MS = 5000;
const TICK_INTERVAL_MS = 250;
const ALL_TABS: TabKey[] = [
  "realm",
  "contracts",
  "upgrades",
  "research",
  "equipment",
  "forging",
  "alchemy",
  "expeditions",
  "disciples",
  "ascend",
  "settings",
  "dev",
  "help"
];

type TabKey =
  | "realm"
  | "contracts"
  | "upgrades"
  | "research"
  | "equipment"
  | "forging"
  | "alchemy"
  | "expeditions"
  | "disciples"
  | "ascend"
  | "settings"
  | "dev"
  | "help";
type ContractSortMode = "default" | "score";
const REWARD_DISPLAY_ORDER = ["research", "reputation", "essence", "herb", "ore", "insight"] as const;

interface LoadedState {
  state: GameState;
  lastSavedAtMs: number | null;
}

function loadInitialState(): LoadedState {
  const nowMs = Date.now();
  const serialized = safeReadStorage(SAVE_KEY);

  if (serialized) {
    try {
      const save = deserialize(serialized);
      if (save.schemaVersion !== save.state.schemaVersion) {
        throw new Error("Schema mismatch");
      }
      const offline = computeOfflineProgress(save.state, save.savedAtMs, nowMs);
      return { state: offline.state, lastSavedAtMs: nowMs };
    } catch (error) {
      console.warn("Failed to load save, starting fresh", error);
    }
  }

  return { state: createInitialState(nowMs), lastSavedAtMs: null };
}

function App() {
  const initial = useMemo(() => loadInitialState(), []);
  const [gameState, setGameState] = useState<GameState>(initial.state);
  const [lastSavedAtMs, setLastSavedAtMs] = useState<number | null>(initial.lastSavedAtMs);
  const [exportText, setExportText] = useState("");
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [locale, setLocale] = useState<Locale>(() => getDefaultLocale());
  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "fail">("idle");
  const [shouldCrash, setShouldCrash] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const saved = safeReadStorage(TAB_STORAGE_KEY);
    if (saved && ALL_TABS.includes(saved as TabKey)) {
      return saved as TabKey;
    }
    return "contracts";
  });
  const [contractSortMode, setContractSortMode] = useState<ContractSortMode>(() => {
    const saved = safeReadStorage(CONTRACT_SORT_STORAGE_KEY);
    return saved === "score" ? "score" : "default";
  });
  const [hideUnavailableContracts, setHideUnavailableContracts] = useState<boolean>(() => {
    const saved = safeReadStorage(CONTRACT_HIDE_STORAGE_KEY);
    return saved === "true";
  });
  const [selectedExpeditionDisciple, setSelectedExpeditionDisciple] = useState<Record<string, string | null>>({});

  if (shouldCrash) {
    throw new Error("Manual crash trigger");
  }

  const gameStateRef = useRef(gameState);
  const lastTickRef = useRef(performance.now());
  const savingRef = useRef(false);
  const tabDefinitions = useMemo(
    () =>
      [
        { key: "realm", label: t("tab.realm", undefined, locale) },
        { key: "contracts", label: t("tab.contracts", undefined, locale) },
        { key: "upgrades", label: t("tab.upgrades", undefined, locale) },
        { key: "research", label: t("tab.research", undefined, locale) },
        { key: "equipment", label: t("tab.equipment", undefined, locale) },
        { key: "forging", label: t("tab.forging", undefined, locale) },
        { key: "alchemy", label: t("tab.alchemy", undefined, locale) },
        { key: "expeditions", label: t("tab.expeditions", undefined, locale) },
        { key: "disciples", label: t("tab.disciples", undefined, locale) },
        { key: "ascend", label: t("tab.ascend", undefined, locale) },
        { key: "settings", label: t("tab.settings", undefined, locale) },
        { key: "dev", label: t("tab.dev", undefined, locale) },
        { key: "help", label: t("tab.help", undefined, locale) }
      ] as const,
    [locale]
  );

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = t("app.title", undefined, locale);
  }, [locale]);

  useEffect(() => {
    const unlockedTabKeys = ALL_TABS.filter((tab) => gameState.realm.unlockedTabs.includes(tab));
    if (!unlockedTabKeys.includes(activeTab)) {
      setActiveTab(unlockedTabKeys[0] ?? "contracts");
    }
  }, [activeTab, gameState.realm.unlockedTabs]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CONTRACT_SORT_STORAGE_KEY, contractSortMode);
    } catch {
      // ignore
    }
  }, [contractSortMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CONTRACT_HIDE_STORAGE_KEY, hideUnavailableContracts ? "true" : "false");
    } catch {
      // ignore
    }
  }, [hideUnavailableContracts]);

  useEffect(() => {
    const tickInterval = setInterval(() => {
      const current = performance.now();
      const dt = current - lastTickRef.current;
      lastTickRef.current = current;
      setGameState((prev) => tick(prev, dt));
    }, TICK_INTERVAL_MS);

    const nowInterval = setInterval(() => {
      setNowMs(Date.now());
    }, 200);

    return () => {
      clearInterval(tickInterval);
      clearInterval(nowInterval);
    };
  }, []);

  const saveGame = useCallback(() => {
    if (savingRef.current) {
      return;
    }
    savingRef.current = true;
    const snapshot = gameStateRef.current;
    const savedAt = Date.now();
    const serialized = serialize(snapshot, savedAt);
    try {
      window.localStorage.setItem(SAVE_KEY, serialized);
      setLastSavedAtMs(savedAt);
      setExportText(serialized);
    } catch (error) {
      console.warn("Failed to save", error);
    } finally {
      savingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const autosaveInterval = setInterval(() => {
      saveGame();
    }, AUTO_SAVE_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.hidden) {
        saveGame();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(autosaveInterval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [saveGame]);

  const focusCooldownRemaining = useMemo(() => {
    if (gameState.lastFocusAtMs === null) {
      return 0;
    }
    const remaining = gameState.lastFocusAtMs + FOCUS_COOLDOWN_MS - nowMs;
    return Math.max(0, remaining);
  }, [gameState.lastFocusAtMs, nowMs]);

  const handleFocus = () => {
    const performedAtMs = Date.now();
    setGameState((prev) => applyAction(prev, { type: "focus", performedAtMs }));
  };

  const handleBuyUpgrade = (upgradeId: (typeof UPGRADE_DEFINITIONS)[number]["id"]) => {
    setGameState((prev) => applyAction(prev, { type: "buyUpgrade", upgradeId }));
  };

  const handleAscend = () => {
    setGameState((prev) => applyAction(prev, { type: "ascend" }));
  };

  const handleBreakthrough = () => {
    setGameState((prev) => applyAction(prev, { type: "breakthrough" }));
  };

  const handleBuyResearch = (researchId: (typeof RESEARCH_DEFINITIONS)[number]["id"]) => {
    setGameState((prev) => applyAction(prev, { type: "buyResearch", researchId }));
  };

  const handleEquip = (instanceId: string) => {
    setGameState((prev) => applyAction(prev, { type: "equip", instanceId }));
  };

  const handleUnequip = (slot: EquipmentSlot) => {
    setGameState((prev) => applyAction(prev, { type: "unequip", slot }));
  };

  const handleFastForward = (ms: number) => {
    setGameState((prev) => tick(prev, ms));
  };

  const handleStartForge = (blueprintId: (typeof EQUIPMENT_BLUEPRINTS)[number]["id"]) => {
    setGameState((prev) => applyAction(prev, { type: "startForge", blueprintId }));
  };

  const handleDisassemble = (instanceId: string) => {
    setGameState((prev) => applyAction(prev, { type: "disassemble", instanceId }));
  };

  const handleRecruitDisciple = () => {
    setGameState((prev) => applyAction(prev, { type: "recruitDisciple" }));
  };

  const handleAssignDiscipleRole = (discipleId: string, role: DiscipleRole | null) => {
    setGameState((prev) => applyAction(prev, { type: "assignDiscipleRole", discipleId, role }));
  };

  const handleStartExpedition = (expeditionId: ExpeditionId, discipleId: string | null) => {
    setGameState((prev) => applyAction(prev, { type: "startExpedition", expeditionId, discipleId }));
  };

  const handleStartAlchemy = (recipeId: (typeof ALCHEMY_RECIPES)[number]["id"]) => {
    setGameState((prev) => applyAction(prev, { type: "startAlchemy", recipeId }));
  };

  const handleConsumeItem = (itemId: (typeof CONSUMABLE_DEFINITIONS)[number]["id"]) => {
    setGameState((prev) => applyAction(prev, { type: "consumeItem", itemId }));
  };

  const handleUpdateSettings = (settings: Partial<GameState["settings"]>) => {
    setGameState((prev) => applyAction(prev, { type: "updateSettings", settings }));
  };

  const handleImport = () => {
    try {
      const parsed = deserialize(importText);
      if (parsed.schemaVersion !== parsed.state.schemaVersion) {
        throw new Error("Save schemaVersion mismatch.");
      }
      setGameState(parsed.state);
      gameStateRef.current = parsed.state;
      setLastSavedAtMs(parsed.savedAtMs);
      setImportError(null);
    } catch (error) {
      console.warn("Failed to import save", error);
      const message =
        error instanceof Error && error.message === "Save schemaVersion mismatch."
          ? t("dev.importErrorSchemaMismatch", undefined, locale)
          : t("dev.importErrorInvalid", undefined, locale);
      setImportError(message);
    }
  };

  const handleLocaleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextLocale = event.target.value as Locale;
    setLocale(nextLocale);
    persistLocale(nextLocale);
  };
  const buildDiagnostics = useCallback(() => {
    const snapshot = exportText || serialize(gameStateRef.current, Date.now());
    return buildDiagnosticsPayload({
      locale,
      tab: activeTab,
      save: snapshot
    });
  }, [activeTab, exportText, locale]);

  const handleCopyDiagnostics = useCallback(async () => {
    const success = await copyText(buildDiagnostics());
    setCopyStatus(success ? "success" : "fail");
  }, [buildDiagnostics]);

  const handleResetProgress = () => {
    const confirmed = window.confirm(t("safety.resetConfirm", undefined, locale));
    if (!confirmed) return;
    try {
      window.localStorage.removeItem(SAVE_KEY);
    } catch {
      // ignore
    }
    window.location.reload();
  };

  const handleTriggerCrash = () => {
    const confirmed = window.confirm(t("dev.triggerCrashConfirm", undefined, locale));
    if (confirmed) {
      setShouldCrash(true);
    }
  };

  const handleTabChange = (tab: TabKey) => {
    if (!gameState.realm.unlockedTabs.includes(tab)) {
      return;
    }
    setActiveTab(tab);
    try {
      window.localStorage.setItem(TAB_STORAGE_KEY, tab);
    } catch {
      // ignore storage errors
    }
  };

  const essence = getResource(gameState.resources, "essence");
  const researchPoints = getResource(gameState.resources, "research");
  const reputationValue = getResource(gameState.resources, "reputation");
  const insightValue = getResource(gameState.resources, "insight");
  const herbValue = getResource(gameState.resources, "herb");
  const oreValue = getResource(gameState.resources, "ore");
  const settings = useMemo(() => mergeSettings(gameState.settings, {}), [gameState.settings]);

  const ascendProgress = Math.min(1, essence / ASCEND_THRESHOLD);
  const ascendReady = canAscend(gameState);
  const insightPreview = calculateInsightGain(gameState);
  const formattedInsightGain = formatInt(insightPreview.gain, locale);
  const formattedEssenceTerm = formatCompact(insightPreview.essenceTerm, { maxDecimals: 2 });
  const formattedContractTerm = formatCompact(insightPreview.contractTerm, { maxDecimals: 2 });
  const formattedEssenceEarned = formatCompact(gameState.runStats.essenceEarned, { maxDecimals: 2 });
  const formattedContractsCompleted = formatInt(gameState.runStats.contractsCompleted, locale);
  const currentRealm = getCurrentRealm(gameState);
  const nextRealm = getNextRealm(gameState);
  const realmLabel = t(currentRealm.nameKey as MessageKey, undefined, locale);
  const realmDescription = t(currentRealm.descriptionKey as MessageKey, undefined, locale);
  const nextRealmLabel = nextRealm ? t(nextRealm.nameKey as MessageKey, undefined, locale) : "";
  const realmRequirements = useMemo(() => {
    if (!nextRealm) return [];
    const req = nextRealm.breakthroughRequirement;
    const items: {
      key: string;
      met: boolean;
      label: string;
      progress: number;
    }[] = [];
    if (req.essenceEarned !== undefined) {
      const required = req.essenceEarned;
      const current = gameState.runStats.essenceEarned;
      items.push({
        key: "essenceEarned",
        met: current >= required,
        label: t(
          "realm.requirement.essenceEarned",
          {
            current: formatCompact(current, { maxDecimals: 2 }),
            required: formatCompact(required, { maxDecimals: 2 })
          },
          locale
        ),
        progress: required > 0 ? Math.min(1, current / required) : 1
      });
    }
    if (req.contractsCompleted !== undefined) {
      const required = req.contractsCompleted;
      const current = gameState.runStats.contractsCompleted;
      items.push({
        key: "contractsCompleted",
        met: current >= required,
        label: t(
          "realm.requirement.contractsCompleted",
          {
            current: formatInt(current, locale),
            required: formatInt(required, locale)
          },
          locale
        ),
        progress: required > 0 ? Math.min(1, current / required) : 1
      });
    }
    if (req.reputation !== undefined) {
      const required = req.reputation;
      const current = gameState.resources.reputation;
      items.push({
        key: "reputation",
        met: current >= required,
        label: t(
          "realm.requirement.reputation",
          {
            current: formatInt(current, locale),
            required: formatInt(required, locale)
          },
          locale
        ),
        progress: required > 0 ? Math.min(1, current / required) : 1
      });
    }
    return items;
  }, [gameState.resources.reputation, gameState.runStats.contractsCompleted, gameState.runStats.essenceEarned, locale, nextRealm]);
  const canBreakRealm = nextRealm ? canBreakthrough(gameState) : false;
  const blockedReason = !canBreakRealm
    ? realmRequirements.find((item) => !item.met)?.label ?? t("realm.requirement.none", undefined, locale)
    : null;
  const reputation = reputationValue;
  const activeContracts = gameState.contracts.slots.filter((slot) => slot.status === "active").length;
  const unlockedContracts = CONTRACT_DEFINITIONS.filter(
    (def) => (def.requiredReputation ?? 0) <= reputation
  ).length;
  const totalContracts = CONTRACT_DEFINITIONS.length;
  const nextUnlockReputation = CONTRACT_DEFINITIONS.filter(
    (def) => (def.requiredReputation ?? 0) > reputation
  )
    .map((def) => def.requiredReputation ?? 0)
    .sort((a, b) => a - b)[0];
  const focusLabel =
    focusCooldownRemaining > 0
      ? t("actions.focusWithCooldown", { seconds: (focusCooldownRemaining / 1000).toFixed(1) }, locale)
      : t("actions.focus", undefined, locale);
  const ascendDescription = t(
    "ascension.description",
    {
      threshold: formatCompact(ASCEND_THRESHOLD),
      progress: (ascendProgress * 100).toFixed(1)
    },
    locale
  );
  const autosaveLabel = lastSavedAtMs
    ? t("dev.autosaveWithLast", { time: new Date(lastSavedAtMs).toLocaleTimeString(locale) }, locale)
    : t("dev.autosave", undefined, locale);
  const copyStatusLabel =
    copyStatus === "success"
      ? t("safety.copyOk", undefined, locale)
      : copyStatus === "fail"
        ? t("safety.copyFail", undefined, locale)
        : null;
  const quickstartSteps = useMemo(
    () => [
      t("help.quickstart.step1", undefined, locale),
      t("help.quickstart.step2", undefined, locale),
      t("help.quickstart.step3", undefined, locale),
      t("help.quickstart.step4", undefined, locale),
      t("help.quickstart.step5", undefined, locale)
    ],
    [locale]
  );
  const resourceLabels = useMemo(
    () => ({
      essence: t("stats.essence", undefined, locale),
      research: t("stats.research", undefined, locale),
      reputation: t("stats.reputation", undefined, locale),
      insight: t("stats.insight", undefined, locale),
      herb: t("stats.herb", undefined, locale),
      ore: t("stats.ore", undefined, locale)
    }),
    [locale]
  );
  const slotLabels = useMemo<Record<EquipmentSlot, string>>(
    () => ({
      weapon: t("equipment.slot.weapon", undefined, locale),
      armor: t("equipment.slot.armor", undefined, locale),
      ring: t("equipment.slot.ring", undefined, locale),
      amulet: t("equipment.slot.amulet", undefined, locale)
    }),
    [locale]
  );
  const rarityLabels = useMemo(
    () => ({
      common: t("equipment.rarity.common", undefined, locale),
      uncommon: t("equipment.rarity.uncommon", undefined, locale),
      rare: t("equipment.rarity.rare", undefined, locale),
      epic: t("equipment.rarity.epic", undefined, locale)
    }),
    [locale]
  );
  const autoAcceptModeLabels = useMemo(
    () => ({
      recommended: t("settings.autoAccept.mode.recommended", undefined, locale),
      highestScore: t("settings.autoAccept.mode.highestScore", undefined, locale),
      manual: t("settings.autoAccept.mode.manual", undefined, locale)
    }),
    [locale]
  );
  const expeditionDefinitions = useMemo(() => EXPEDITION_DEFINITIONS.slice(), []);
  const discipleModifiers = useMemo(() => getDiscipleModifiers(gameState), [gameState]);
  const discipleRoleLabels = useMemo<Record<DiscipleRole, string>>(
    () => ({
      contractClerk: t("disciples.role.contractClerk", undefined, locale),
      alchemist: t("disciples.role.alchemist", undefined, locale),
      smith: t("disciples.role.smith", undefined, locale),
      gatherer: t("disciples.role.gatherer", undefined, locale)
    }),
    [locale]
  );
  const canRecruitDisciple = useMemo(
    () =>
      getResource(gameState.resources, "essence") >= DISCIPLE_RECRUIT_COST.essence &&
      getResource(gameState.resources, "reputation") >= DISCIPLE_RECRUIT_COST.reputation,
    [gameState.resources]
  );
  const forgingBlueprints = useMemo(() => EQUIPMENT_BLUEPRINTS.slice(), []);
  const equipmentModifiers = useMemo(() => getEquipmentModifiers(gameState), [gameState]);
  const forgingQueue = gameState.forgingQueue;
  const activeForge = forgingQueue.active;
  const activeForgeBlueprint = activeForge ? findEquipmentBlueprint(activeForge.blueprintId) : null;
  const forgingProgress = activeForge && activeForge.totalMs > 0 ? Math.min(1, 1 - activeForge.remainingMs / activeForge.totalMs) : 0;
  const lastForgedItem = forgingQueue.lastFinished;
  const alchemyRecipes = useMemo(() => ALCHEMY_RECIPES.slice(), []);
  const consumableDefinitions = useMemo(() => CONSUMABLE_DEFINITIONS.slice(), []);
  const alchemyQueue = gameState.alchemyQueue ?? { active: null, lastFinished: null };
  const activeAlchemy = alchemyQueue.active;
  const activeAlchemyRecipe = activeAlchemy ? findAlchemyRecipe(activeAlchemy.recipeId) : null;
  const alchemyProgress =
    activeAlchemy && activeAlchemy.totalMs > 0 ? Math.min(1, 1 - activeAlchemy.remainingMs / activeAlchemy.totalMs) : 0;
  const lastBrewed = alchemyQueue.lastFinished;
  const unlockedRecipes = useMemo(
    () => alchemyRecipes.filter((recipe) => isRecipeUnlocked(gameState, recipe.id)),
    [alchemyRecipes, gameState]
  );
  const consumableInventory = gameState.consumables ?? {};
  const activeBuffs = gameState.buffs ?? [];
  const activeExpedition = gameState.expeditions.active;
  const equippedEntries = useMemo(
    () => {
      const equipped = gameState.equipped;
      const items = gameState.equipmentInventory.items;
      return (Object.keys(equipped) as EquipmentSlot[]).map((slot) => {
        const instanceId = equipped[slot];
        const item = instanceId ? items[instanceId] : null;
        return { slot, instanceId, item };
      });
    },
    [gameState.equipped, gameState.equipmentInventory.items]
  );
  const inventoryItems = useMemo(
    () =>
      Object.values(gameState.equipmentInventory.items).sort(
        (a, b) => Number(a.instanceId) - Number(b.instanceId)
      ),
    [gameState.equipmentInventory.items]
  );
  const equippedInstanceIds = useMemo(
    () => new Set(Object.values(gameState.equipped).filter(Boolean) as string[]),
    [gameState.equipped]
  );
  const effectiveOfflineCapMs = useMemo(
    () => OFFLINE_CAP_MS + equipmentModifiers.offlineCapBonusMs,
    [equipmentModifiers.offlineCapBonusMs]
  );
  const formatAffixEffect = useCallback(
    (affixId: (typeof AFFIX_DEFINITIONS)[number]["id"], value: number, rarity: string) => {
      const def = findAffixDefinition(affixId);
      const effectiveValue = value * getRarityMultiplier(rarity);
      switch (def.type) {
        case "productionMult":
          return t("equipment.affixEffect.productionMult", { value: (effectiveValue * 100).toFixed(1) }, locale);
        case "contractSpeedMult":
          return t("equipment.affixEffect.contractSpeedMult", { value: (effectiveValue * 100).toFixed(1) }, locale);
        case "offlineCapBonus":
          return t("equipment.affixEffect.offlineCapBonus", { minutes: Math.round(effectiveValue / 60000) }, locale);
        default:
          return "";
      }
    },
    [locale]
  );
  const formatConsumableEffect = useCallback(
    (effects: { productionMult?: number; contractSpeedMult?: number }) => {
      const parts: string[] = [];
      if (effects.productionMult !== undefined) {
        parts.push(t("alchemy.effect.productionMult", { value: ((effects.productionMult - 1) * 100).toFixed(1) }, locale));
      }
      if (effects.contractSpeedMult !== undefined) {
        parts.push(t("alchemy.effect.contractSpeedMult", { value: ((effects.contractSpeedMult - 1) * 100).toFixed(1) }, locale));
      }
      return parts.join(" / ");
    },
    [locale]
  );
  const formatBasePowerLine = useCallback(
    (basePower: number) => t("equipment.basePowerLine", { value: (basePower * 100).toFixed(1) }, locale),
    [locale]
  );
  const formatDiscipleRoleEffect = useCallback(
    (role: DiscipleRole | null, aptitude: number) => {
      if (!role) {
        return t("disciples.effect.unassigned", undefined, locale);
      }
      const effect = DISCIPLE_ROLE_EFFECTS[role];
      if (!effect) return "";
      switch (role) {
        case "contractClerk":
          return t("disciples.effect.contractClerk", undefined, locale);
        case "smith": {
          const smithSpeed = (effect.forgingSpeedPerAptitude ?? 0) * aptitude;
          return t(
            "disciples.effect.smith",
            { value: (smithSpeed * 100).toFixed(1) },
            locale
          );
        }
        case "alchemist": {
          const alchemySpeed = (effect.alchemySpeedPerAptitude ?? 0) * aptitude;
          return t(
            "disciples.effect.alchemist",
            { value: (alchemySpeed * 100).toFixed(1) },
            locale
          );
        }
        case "gatherer": {
          const herbRate = (effect.herbPerSecondPerAptitude ?? 0) * aptitude;
          const oreRate = (effect.orePerSecondPerAptitude ?? 0) * aptitude;
          return t(
            "disciples.effect.gatherer",
            {
              herb: formatCompact(herbRate, { maxDecimals: 2 }),
              ore: formatCompact(oreRate, { maxDecimals: 2 })
            },
            locale
          );
        }
        default:
          return "";
      }
    },
    [locale]
  );
  const formatExpeditionReward = useCallback(
    (reward: ExpeditionReward) => {
      switch (reward.type) {
        case "resource":
          return `${t(`stats.${reward.resourceId}` as MessageKey, undefined, locale)} +${formatCompact(reward.amount, { maxDecimals: 1 })}`;
        case "recipe":
          return t("expeditions.reward.recipe", { id: reward.recipeId }, locale);
        case "equipment": {
          const blueprint = findEquipmentBlueprint(reward.blueprintId);
          const rarity = t(`equipment.rarity.${reward.rarity}` as MessageKey, undefined, locale);
          const name = t(blueprint.nameKey as MessageKey, undefined, locale);
          return t("expeditions.reward.equipment", { name, rarity }, locale);
        }
        default:
          return "";
      }
    },
    [locale]
  );
  const glossaryEntries = useMemo(
    () => [
      {
        label: t("stats.realm", undefined, locale),
        description: t("help.glossary.realm", undefined, locale)
      },
      {
        label: `${t("stats.essence", undefined, locale)} (E)`,
        description: t("help.glossary.essence", undefined, locale)
      },
      {
        label: `${t("stats.research", undefined, locale)} (R)`,
        description: t("help.glossary.research", undefined, locale)
      },
      {
        label: t("stats.reputation", undefined, locale),
        description: t("help.glossary.reputation", undefined, locale)
      },
      {
        label: t("stats.insight", undefined, locale),
        description: t("help.glossary.insight", undefined, locale)
      },
      {
        label: t("stats.herb", undefined, locale),
        description: t("help.glossary.herb", undefined, locale)
      },
      {
        label: t("stats.ore", undefined, locale),
        description: t("help.glossary.ore", undefined, locale)
      }
    ],
    [locale]
  );
  const contractEntries = useMemo(
    () =>
      gameState.contracts.slots.map((slot, index) => {
        const def = CONTRACT_DEFINITIONS.find((item) => item.id === slot.id);
        const requiredReputation = def?.requiredReputation ?? 0;
        const acceptCost = def?.acceptCostEssence ?? 0;
        const requiredEssencePerSecond = def?.requiredEssencePerSecond ?? 0;
        const realmUnlocked = gameState.realm.unlockedContractIds.includes(slot.id);
        const isUnlocked = reputation >= requiredReputation;
        const isActive = slot.status === "active";
        const isCompleted = slot.status === "completed";
        const hasCapacity = activeContracts < gameState.contracts.maxSlots || isActive || isCompleted;
        const hasEssenceForCost = essence >= acceptCost;
        const meetsEssenceRate = gameState.production.perSecond >= requiredEssencePerSecond;
        const available =
          slot.status === "idle" &&
          realmUnlocked &&
          isUnlocked &&
          hasCapacity &&
          hasEssenceForCost &&
          meetsEssenceRate;
        const score = computeContractScore({
          rewardResearch: slot.reward.research,
          rewardReputation: slot.reward.reputation,
          rewardEssence: slot.reward.essence,
          rewardHerb: slot.reward.herb,
          rewardOre: slot.reward.ore,
          acceptCostEssence: acceptCost,
          durationMs: slot.durationMs,
          weights: DEFAULT_CONTRACT_WEIGHTS
        });

        return {
          slot,
          requiredReputation,
          acceptCost,
          requiredEssencePerSecond,
          realmUnlocked,
          isUnlocked,
          isActive,
          isCompleted,
          hasCapacity,
          hasEssenceForCost,
          meetsEssenceRate,
          available,
          score,
          originalIndex: index
        };
      }),
    [
      activeContracts,
      gameState.contracts.maxSlots,
      gameState.contracts.slots,
      gameState.production.perSecond,
      essence,
      gameState.realm.unlockedContractIds,
      reputation
    ]
  );
  const visibleTabs = useMemo(
    () => tabDefinitions.filter((tab) => gameState.realm.unlockedTabs.includes(tab.key)),
    [gameState.realm.unlockedTabs, tabDefinitions]
  );
  const filteredContracts = useMemo(() => {
    const base = contractEntries.filter((entry) => {
      if (!hideUnavailableContracts) return true;
      if (entry.slot.status !== "idle") return true;
      return entry.available;
    });

    if (contractSortMode !== "score") {
      return base;
    }

    const activeOrCompleted = base.filter((entry) => entry.slot.status !== "idle");
    const idle = base.filter((entry) => entry.slot.status === "idle");
    const sortedIdle = idle
      .slice()
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.slot.id.localeCompare(b.slot.id);
      });

    return [...activeOrCompleted, ...sortedIdle];
  }, [contractEntries, contractSortMode, hideUnavailableContracts]);
  const recommendedContractId = useMemo(() => {
    const candidates = filteredContracts.filter(
      (entry) => entry.slot.status === "idle" && entry.available
    );
    if (candidates.length === 0) return null;
    const sorted = candidates
      .slice()
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.slot.id.localeCompare(b.slot.id);
      });
    return sorted[0].slot.id;
  }, [filteredContracts]);
  const faqEntries = useMemo(
    () => [
      t("help.faq.locked", undefined, locale),
      t("help.faq.capacity", undefined, locale),
      t("help.faq.cost", undefined, locale),
      t("help.faq.eps", undefined, locale),
      t("help.faq.startup", undefined, locale)
    ],
    [locale]
  );

  return (
    <main className="page">
      <header className="header">
        <div className="header-top">
          <div>
            <h1>{t("app.title", undefined, locale)}</h1>
            <p>{t("app.subtitle", undefined, locale)}</p>
          </div>
          <div className="language-switch">
            <label className="muted small">
              {t("app.localeSwitch", undefined, locale)}
              <select value={locale} onChange={handleLocaleChange}>
                <option value="zh-CN">{t("locale.zh-CN", undefined, locale)}</option>
                <option value="en-US">{t("locale.en-US", undefined, locale)}</option>
              </select>
            </label>
          </div>
        </div>
        <div className="stats-grid">
          <Stat label={t("stats.realm", undefined, locale)} value={realmLabel} />
          <Stat
            label={t("stats.essence", undefined, locale)}
            value={formatCompact(essence)}
          />
          <Stat
            label={t("stats.research", undefined, locale)}
            value={formatInt(researchPoints, locale)}
          />
          <Stat
            label={t("stats.reputation", undefined, locale)}
            value={formatInt(reputationValue, locale)}
          />
          <Stat
            label={t("stats.insight", undefined, locale)}
            value={formatInt(insightValue, locale)}
          />
          <Stat
            label={t("stats.herb", undefined, locale)}
            value={formatCompact(herbValue)}
          />
          <Stat
            label={t("stats.ore", undefined, locale)}
            value={formatCompact(oreValue)}
          />
          <Stat
            label={t("stats.essencePerSecond", undefined, locale)}
            value={formatCompact(gameState.production.perSecond)}
          />
        </div>
      </header>

      <nav className="tabs">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            className={`tab-button ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => handleTabChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "realm" ? (
        <section className="card">
          <div className="card-header">
            <div>
              <h2>{t("realm.title", undefined, locale)}</h2>
              <p className="muted small">
                {t("realm.currentLabel", { name: realmLabel }, locale)}
              </p>
            </div>
            <div className="muted small">{t("realm.ascendResetHint", undefined, locale)}</div>
          </div>
          <div className="help-section">
            <h3>{realmLabel}</h3>
            <p className="muted">{realmDescription}</p>
          </div>
          {nextRealm ? (
            <div className="help-section">
              <h3>{t("realm.nextLabel", { name: nextRealmLabel }, locale)}</h3>
              <ul className="help-list">
                {realmRequirements.map((item) => (
                  <li key={item.key}>
                    <div className="progress-bar" style={{ marginBottom: "4px" }}>
                      <div className="progress-fill" style={{ width: `${item.progress * 100}%` }} />
                    </div>
                    <span className={item.met ? "muted small" : "warning small"}>{item.label}</span>
                  </li>
                ))}
              </ul>
              <button className="action-button" onClick={handleBreakthrough} disabled={!canBreakRealm}>
                {canBreakRealm
                  ? t("realm.breakthroughReady", undefined, locale)
                  : t("realm.breakthroughLocked", undefined, locale)}
              </button>
              {!canBreakRealm && blockedReason ? (
                <div className="muted small" style={{ marginTop: "4px" }}>
                  {blockedReason}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="help-section">
              <p className="muted">{t("realm.maxed", undefined, locale)}</p>
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "contracts" ? (
        <>
          <section className="card">
            <div className="card-header">
              <h2>{t("contracts.title", undefined, locale)}</h2>
              <p className="muted small">{t("contracts.hint", undefined, locale)}</p>
            </div>
            <div className="reputation-summary">
              <div>
                {t(
                  "contracts.reputationSummary",
                  {
                    reputation: formatInt(reputation, locale),
                    unlocked: formatInt(unlockedContracts, locale),
                    total: formatInt(totalContracts, locale)
                  },
                  locale
                )}
              </div>
              <div className="muted small">
                {nextUnlockReputation !== undefined
                  ? t(
                      "contracts.nextUnlock",
                      {
                        required: formatInt(nextUnlockReputation, locale),
                        delta: formatInt(Math.max(0, nextUnlockReputation - reputation), locale)
                      },
                      locale
                    )
                  : t("contracts.allUnlocked", undefined, locale)}
              </div>
              <div className="muted small">
                {t(
                  "contracts.capacity",
                  {
                    active: formatInt(activeContracts, locale),
                    max: formatInt(gameState.contracts.maxSlots, locale)
                  },
                  locale
                )}
              </div>
            </div>
            <div className="reputation-summary">
              <label className="muted small">
                {t("contracts.sortLabel", undefined, locale)}
                <select
                  value={contractSortMode}
                  onChange={(event) => setContractSortMode(event.target.value as ContractSortMode)}
                  style={{ marginLeft: "8px" }}
                >
                  <option value="default">{t("contracts.sort.default", undefined, locale)}</option>
                  <option value="score">{t("contracts.sort.score", undefined, locale)}</option>
                </select>
              </label>
              <label className="muted small" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <input
                  type="checkbox"
                  checked={hideUnavailableContracts}
                  onChange={(event) => setHideUnavailableContracts(event.target.checked)}
                />
                {t("contracts.hideUnavailable", undefined, locale)}
              </label>
            </div>
            <div className="contract-list">
              {filteredContracts.map((entry) => {
                const { slot } = entry;
                const formattedDuration = formatSeconds(slot.durationMs / 1000);
                const formattedAcceptCost = formatInt(entry.acceptCost, locale);
                const formattedRequiredEps = formatCompact(entry.requiredEssencePerSecond, { maxDecimals: 1 });
                const formattedRequiredReputation = formatInt(entry.requiredReputation, locale);
                const progress = getContractProgress(slot);
                const disabledReason = !entry.realmUnlocked
                  ? t("contracts.reason.realmLocked", undefined, locale)
                  : !entry.isUnlocked
                    ? t("contracts.requireReputation", { required: formattedRequiredReputation }, locale)
                    : !entry.hasCapacity
                    ? t("contracts.reason.capacity", { max: formatInt(gameState.contracts.maxSlots, locale) }, locale)
                    : !entry.hasEssenceForCost
                      ? t("contracts.reason.cost", { cost: formattedAcceptCost }, locale)
                      : !entry.meetsEssenceRate
                        ? t("contracts.reason.eps", { eps: formattedRequiredEps }, locale)
                        : undefined;
                const scoreLabel = t(
                  "contracts.scoreLabel" as MessageKey,
                  { score: formatCompact(entry.score, { maxDecimals: 2 }) },
                  locale
                );
                return (
                  <div className="contract-row" key={slot.id}>
                    <div className="contract-info">
                      <div className="contract-title">
                        <strong>{t(slot.nameKey as MessageKey, undefined, locale)}</strong>
                        {entry.available && slot.status === "idle" && recommendedContractId === slot.id ? (
                          <span className="status-pill status-active">
                            {t("contracts.recommended", undefined, locale)}
                          </span>
                        ) : null}
                        <span className={`status-pill status-${slot.status}`}>
                          {t(`contracts.status.${slot.status}` as MessageKey, undefined, locale)}
                        </span>
                      </div>
                      <p className="muted">{t(slot.descriptionKey as MessageKey, undefined, locale)}</p>
                      <div className="muted small">
                        {t(
                          "contracts.duration",
                          {
                            seconds: formattedDuration
                          },
                          locale
                        )}
                      </div>
                      <div className="muted small">{scoreLabel}</div>
                      {entry.acceptCost > 0 ? (
                        <div className="muted small">
                          {t("contracts.acceptCost", { cost: formattedAcceptCost }, locale)}
                        </div>
                        ) : null}
                      {entry.requiredEssencePerSecond > 0 ? (
                        <div className="muted small">
                          {t("contracts.requiredEps", { eps: formattedRequiredEps }, locale)}
                        </div>
                      ) : null}
                      {!entry.realmUnlocked ? (
                        <div className="muted small warning">{t("contracts.reason.realmLocked", undefined, locale)}</div>
                      ) : null}
                      {!entry.isUnlocked ? (
                        <div className="muted small warning">
                          {t("contracts.requireReputation", { required: formattedRequiredReputation }, locale)}
                        </div>
                      ) : null}
                      {entry.isActive ? (
                        <div className="progress-bar contract-progress">
                          <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
                        </div>
                      ) : null}
                    </div>
                    <div className="contract-actions">
                      <div className="reward-row">
                        {REWARD_DISPLAY_ORDER.map((resourceId) => {
                          const amount = slot.reward[resourceId as ResourceId];
                          if (!amount) return null;
                          const formatted =
                            resourceId === "research" ||
                            resourceId === "reputation" ||
                            resourceId === "insight"
                              ? formatInt(amount, locale)
                              : formatCompact(amount);
                          return (
                            <RewardBadge
                              key={resourceId}
                              label={resourceLabels[resourceId as ResourceId]}
                              amount={formatted}
                            />
                          );
                        })}
                      </div>
                      {entry.isCompleted ? (
                        <button
                          className="action-button"
                          onClick={() => setGameState((prev) => applyAction(prev, { type: "completeContract", contractId: slot.id }))}
                        >
                          {t("contracts.claim", undefined, locale)}
                        </button>
                      ) : (
                        <button
                          className="action-button secondary"
                          disabled={
                            entry.isActive ||
                            !entry.realmUnlocked ||
                            !entry.isUnlocked ||
                            !entry.hasCapacity ||
                            !entry.hasEssenceForCost ||
                            !entry.meetsEssenceRate
                          }
                          onClick={() => setGameState((prev) => applyAction(prev, { type: "acceptContract", contractId: slot.id }))}
                        >
                          {entry.isUnlocked
                            ? t("contracts.accept", undefined, locale)
                            : t("contracts.locked", undefined, locale)}
                        </button>
                      )}
                      {disabledReason ? <div className="muted small warning">{disabledReason}</div> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <h2>{t("actions.title", undefined, locale)}</h2>
              <div className="actions-row">
                <button
                  className="action-button"
                  onClick={handleFocus}
                  disabled={focusCooldownRemaining > 0}
                  title={t("actions.focusTooltip", undefined, locale)}
                >
                  {focusLabel}
                </button>
              </div>
            </div>
          </section>
        </>
      ) : null}

      {activeTab === "upgrades" ? (
        <section className="card">
          <div className="card-header">
            <h2>{t("upgrades.title", undefined, locale)}</h2>
          </div>
          <div className="upgrade-list">
            {UPGRADE_DEFINITIONS.map((upgrade) => {
              const owned = gameState.upgrades[upgrade.id] ?? 0;
              const nextCost = getUpgradeCost(upgrade, owned);
              const affordable = essence >= nextCost;
              return (
                <div className="upgrade-row" key={upgrade.id}>
                  <div>
                    <strong>{t(upgrade.nameKey as MessageKey, undefined, locale)}</strong>
                    <p className="muted">
                      {t(upgrade.descriptionKey as MessageKey, undefined, locale)} •{" "}
                      {t("upgrades.owned", { count: formatInt(owned, locale) }, locale)}
                    </p>
                  </div>
                  <div className="upgrade-actions">
                    <span className="cost">{t("upgrades.cost", { cost: formatInt(nextCost, locale) }, locale)}</span>
                    <button
                      className="action-button"
                      onClick={() => handleBuyUpgrade(upgrade.id)}
                      disabled={!affordable}
                    >
                      {t("upgrades.buy", undefined, locale)}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {activeTab === "research" ? (
        <section className="card">
          <div className="card-header">
            <div>
              <h2>{t("research.title", undefined, locale)}</h2>
              <p className="muted small">{t("research.hint", undefined, locale)}</p>
            </div>
            <div className="cost">
              {t("research.balance", { amount: formatInt(researchPoints, locale) }, locale)}
            </div>
          </div>
          <div className="upgrade-list">
            {RESEARCH_DEFINITIONS.map((node) => {
              const purchased = gameState.research.nodes[node.id]?.purchased;
              const realmUnlocked = gameState.realm.unlockedResearchIds.includes(node.id);
              const prerequisitesMet = (node.prerequisites ?? []).every(
                (pre) => gameState.research.nodes[pre]?.purchased
              );
              const affordable = researchPoints >= node.costResearch;
              const buyable = realmUnlocked && canBuyResearch(gameState, node.id);
              const buttonLabel = purchased
                ? t("research.purchased", undefined, locale)
                : !realmUnlocked
                  ? t("research.lockedRealm", undefined, locale)
                  : !prerequisitesMet
                    ? t("research.locked", undefined, locale)
                    : t("research.buy", undefined, locale);
              return (
                <div className="upgrade-row" key={node.id}>
                  <div>
                    <strong>{t(node.nameKey as MessageKey, undefined, locale)}</strong>
                    <p className="muted">{t(node.descriptionKey as MessageKey, undefined, locale)}</p>
                    {!realmUnlocked && !purchased ? (
                      <p className="muted small">{t("research.lockedRealm", undefined, locale)}</p>
                    ) : null}
                    {!prerequisitesMet && !purchased ? (
                      <p className="muted small">{t("research.prereqHint", undefined, locale)}</p>
                    ) : null}
                  </div>
                  <div className="upgrade-actions">
                    <span className="cost">
                      {t("research.cost", { cost: formatInt(node.costResearch, locale) }, locale)}
                    </span>
                    <button
                      className="action-button"
                      onClick={() => handleBuyResearch(node.id)}
                      disabled={!buyable}
                      title={
                        purchased
                          ? t("research.purchased", undefined, locale)
                          : !realmUnlocked
                            ? t("research.lockedRealm", undefined, locale)
                            : !affordable
                              ? t("research.notEnough", undefined, locale)
                              : undefined
                      }
                    >
                      {buttonLabel}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {activeTab === "equipment" ? (
        <section className="card">
          <div className="card-header">
            <div>
              <h2>{t("equipment.title", undefined, locale)}</h2>
              <p className="muted small">{t("equipment.hint", undefined, locale)}</p>
            </div>
            <div className="muted small">
              {t(
                "equipment.summaryLine",
                {
                  production: equipmentModifiers.productionMult.toFixed(2),
                  contract: equipmentModifiers.contractSpeedMult.toFixed(2),
                  offline: formatSeconds(effectiveOfflineCapMs / 1000)
                },
                locale
              )}
            </div>
          </div>
          <div className="reputation-summary">
            <div>
              {t(
                "equipment.productionSummary",
                {
                  value: ((equipmentModifiers.productionMult - 1) * 100).toFixed(1)
                },
                locale
              )}
            </div>
            <div>
              {t(
                "equipment.contractSummary",
                {
                  value: ((equipmentModifiers.contractSpeedMult - 1) * 100).toFixed(1)
                },
                locale
              )}
            </div>
            <div>
              {t(
                "equipment.offlineSummary",
                {
                  base: formatSeconds(OFFLINE_CAP_MS / 1000),
                  bonusMinutes: Math.round(equipmentModifiers.offlineCapBonusMs / 60000)
                },
                locale
              )}
            </div>
          </div>
          <div className="help-section">
            <h3>{t("equipment.equippedTitle", undefined, locale)}</h3>
            <div className="upgrade-list">
              {equippedEntries.map((entry) => {
                const item = entry.item;
                const blueprint = item ? findEquipmentBlueprint(item.blueprintId) : null;
                return (
                  <div className="upgrade-row" key={entry.slot}>
                    <div>
                      <strong>{slotLabels[entry.slot]}</strong>
                      {item && blueprint ? (
                        <>
                          <p className="muted small">
                            {t(blueprint.nameKey as MessageKey, undefined, locale)} • {rarityLabels[item.rarity]}
                          </p>
                          <p className="muted small">{t(blueprint.descriptionKey as MessageKey, undefined, locale)}</p>
                          <p className="muted small">{formatBasePowerLine(blueprint.basePower)}</p>
                          <ul className="muted small">
                            {item.affixes.map((affix) => {
                              const def = findAffixDefinition(affix.affixId);
                              return (
                                <li key={affix.affixId}>
                                  {t(def.nameKey as MessageKey, undefined, locale)} —{" "}
                                  {formatAffixEffect(affix.affixId, affix.value, item.rarity)}
                                </li>
                              );
                            })}
                          </ul>
                        </>
                      ) : (
                        <p className="muted small">{t("equipment.emptySlot", undefined, locale)}</p>
                      )}
                    </div>
                    <div className="upgrade-actions">
                      {item ? (
                        <button className="action-button secondary" onClick={() => handleUnequip(entry.slot)}>
                          {t("equipment.unequip", undefined, locale)}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="help-section">
            <h3>{t("equipment.inventoryTitle", undefined, locale)}</h3>
            {inventoryItems.length === 0 ? (
              <p className="muted small">{t("equipment.emptyInventory", undefined, locale)}</p>
            ) : (
              <div className="upgrade-list">
                {inventoryItems.map((item) => {
                  const blueprint = findEquipmentBlueprint(item.blueprintId);
                  const isEquipped = equippedInstanceIds.has(item.instanceId);
                  return (
                    <div className="upgrade-row" key={item.instanceId}>
                      <div>
                        <strong>
                          {t(blueprint.nameKey as MessageKey, undefined, locale)} • {rarityLabels[item.rarity]}
                        </strong>
                        <p className="muted small">
                          {slotLabels[item.slot]} • {t(blueprint.descriptionKey as MessageKey, undefined, locale)}
                        </p>
                        <p className="muted small">{formatBasePowerLine(blueprint.basePower)}</p>
                        <ul className="muted small">
                          {item.affixes.map((affix) => {
                            const def = findAffixDefinition(affix.affixId);
                            return (
                              <li key={`${item.instanceId}-${affix.affixId}`}>
                                {t(def.nameKey as MessageKey, undefined, locale)} —{" "}
                                {formatAffixEffect(affix.affixId, affix.value, item.rarity)}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                      <div className="upgrade-actions">
                        <button className="action-button" onClick={() => handleEquip(item.instanceId)} disabled={isEquipped}>
                          {isEquipped ? t("equipment.isEquipped", undefined, locale) : t("equipment.equip", undefined, locale)}
                        </button>
                        <button className="action-button secondary" onClick={() => handleDisassemble(item.instanceId)}>
                          {t("equipment.disassemble", undefined, locale)}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      ) : null}

      {activeTab === "forging" ? (
        <section className="card">
          <div className="card-header">
            <div>
              <h2>{t("forging.title", undefined, locale)}</h2>
              <p className="muted small">{t("forging.hint", undefined, locale)}</p>
            </div>
            <div className="muted small">
              {t("forging.materials", { ore: formatInt(oreValue, locale), essence: formatInt(essence, locale) }, locale)}
            </div>
          </div>

          <div className="help-section">
            <h3>{t("forging.blueprints", undefined, locale)}</h3>
            <div className="upgrade-list">
              {forgingBlueprints.map((bp) => {
                const affordable =
                  oreValue >= bp.cost.ore && essence >= bp.cost.essence && !activeForge;
                const disabledReason = activeForge
                  ? t("forging.queueBusy", undefined, locale)
                  : oreValue < bp.cost.ore
                    ? t("forging.needOre", { ore: formatInt(bp.cost.ore, locale) }, locale)
                    : essence < bp.cost.essence
                      ? t("forging.needEssence", { essence: formatInt(bp.cost.essence, locale) }, locale)
                      : null;
                return (
                  <div className="upgrade-row" key={bp.id}>
                    <div>
                      <strong>{t(bp.nameKey as MessageKey, undefined, locale)}</strong>
                      <p className="muted small">{t(bp.descriptionKey as MessageKey, undefined, locale)}</p>
                      <p className="muted small">
                        {t("forging.costLine", { ore: formatInt(bp.cost.ore, locale), essence: formatInt(bp.cost.essence, locale) }, locale)}
                      </p>
                      <p className="muted small">
                        {t("forging.timeLine", { seconds: formatSeconds(bp.forgeTimeMs / 1000) }, locale)}
                      </p>
                    </div>
                    <div className="upgrade-actions">
                      <button className="action-button" disabled={!affordable} onClick={() => handleStartForge(bp.id)} title={disabledReason ?? undefined}>
                        {t("forging.start", undefined, locale)}
                      </button>
                      {disabledReason ? <div className="muted small warning">{disabledReason}</div> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="help-section">
            <h3>{t("forging.queueTitle", undefined, locale)}</h3>
            {activeForge && activeForgeBlueprint ? (
              <div className="contract-row">
                <div className="contract-info">
                  <div className="contract-title">
                    <strong>{t(activeForgeBlueprint.nameKey as MessageKey, undefined, locale)}</strong>
                    <span className="status-pill status-active">{t("forging.inProgress", undefined, locale)}</span>
                  </div>
                  <p className="muted small">
                    {t("forging.remaining", { seconds: formatSeconds(activeForge.remainingMs / 1000) }, locale)}
                  </p>
                  <div className="progress-bar contract-progress">
                    <div className="progress-fill" style={{ width: `${forgingProgress * 100}%` }} />
                  </div>
                </div>
              </div>
            ) : (
              <p className="muted small">{t("forging.idle", undefined, locale)}</p>
            )}
          </div>

          <div className="help-section">
            <h3>{t("forging.lastFinished", undefined, locale)}</h3>
            {lastForgedItem ? (
              <div className="contract-row">
                <div className="contract-info">
                  <div className="contract-title">
                    <strong>
                      {t(findEquipmentBlueprint(lastForgedItem.blueprintId).nameKey as MessageKey, undefined, locale)} •{" "}
                      {rarityLabels[lastForgedItem.rarity]}
                    </strong>
                  </div>
                  <ul className="muted small">
                    {lastForgedItem.affixes.map((affix) => {
                      const def = findAffixDefinition(affix.affixId);
                      return (
                        <li key={affix.affixId}>
                          {t(def.nameKey as MessageKey, undefined, locale)} —{" "}
                          {formatAffixEffect(affix.affixId, affix.value, lastForgedItem.rarity)}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="muted small">{t("forging.none", undefined, locale)}</p>
            )}
          </div>
        </section>
      ) : null}

      {activeTab === "alchemy" ? (
        <section className="card">
          <div className="card-header">
            <div>
              <h2>{t("alchemy.title", undefined, locale)}</h2>
              <p className="muted small">{t("alchemy.hint", undefined, locale)}</p>
            </div>
            <div className="muted small">
              {t(
                "alchemy.materials",
                { herb: formatInt(getResource(gameState.resources, "herb"), locale), essence: formatInt(essence, locale) },
                locale
              )}
            </div>
          </div>

          <div className="grid two-columns">
            <div className="help-section">
              <h3>{t("alchemy.recipes", undefined, locale)}</h3>
              {unlockedRecipes.length === 0 ? (
                <p className="muted small">{t("alchemy.noRecipes", undefined, locale)}</p>
              ) : (
                <div className="upgrade-list">
                  {unlockedRecipes.map((recipe) => {
                    const costHerb = recipe.cost.herb ?? 0;
                    const costEssence = recipe.cost.essence ?? 0;
                    const hasHerb = getResource(gameState.resources, "herb") >= costHerb;
                    const hasEssenceForRecipe = essence >= costEssence;
                    const disabledReason = activeAlchemy
                      ? t("alchemy.queueBusy", undefined, locale)
                      : !hasHerb
                        ? t("alchemy.needHerb", { amount: formatInt(costHerb, locale) }, locale)
                        : !hasEssenceForRecipe
                          ? t("alchemy.needEssence", { amount: formatInt(costEssence, locale) }, locale)
                          : null;
                    const outputDef = findConsumableDefinition(recipe.result.itemId);
                    return (
                      <div className="upgrade-row" key={recipe.id}>
                        <div>
                          <strong>{t(recipe.nameKey as MessageKey, undefined, locale)}</strong>
                          <p className="muted small">{t(recipe.descriptionKey as MessageKey, undefined, locale)}</p>
                          <p className="muted small">
                            {t("alchemy.costLine", { herb: formatInt(costHerb, locale), essence: formatInt(costEssence, locale) }, locale)}
                          </p>
                          <p className="muted small">
                            {t("alchemy.timeLine", { seconds: formatSeconds(recipe.durationMs / 1000) }, locale)}
                          </p>
                          <p className="muted small">
                            {t("alchemy.outputLine", { name: t(outputDef.nameKey as MessageKey, undefined, locale) }, locale)}
                          </p>
                        </div>
                        <div className="upgrade-actions">
                          <button className="action-button" disabled={Boolean(disabledReason)} onClick={() => handleStartAlchemy(recipe.id)} title={disabledReason ?? undefined}>
                            {t("alchemy.start", undefined, locale)}
                          </button>
                          {disabledReason ? <div className="muted small warning">{disabledReason}</div> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="help-section">
              <h3>{t("alchemy.queueTitle", undefined, locale)}</h3>
              {activeAlchemy && activeAlchemyRecipe ? (
                <div className="contract-row">
                  <div className="contract-info">
                    <div className="contract-title">
                      <strong>{t(activeAlchemyRecipe.nameKey as MessageKey, undefined, locale)}</strong>
                      <span className="status-pill status-active">{t("alchemy.inProgress", undefined, locale)}</span>
                    </div>
                    <p className="muted small">
                      {t("alchemy.remaining", { seconds: formatSeconds(activeAlchemy.remainingMs / 1000) }, locale)}
                    </p>
                    <div className="progress-bar contract-progress">
                      <div className="progress-fill" style={{ width: `${alchemyProgress * 100}%` }} />
                    </div>
                  </div>
                </div>
              ) : (
                <p className="muted small">{t("alchemy.idle", undefined, locale)}</p>
              )}

              <h3>{t("alchemy.inventoryTitle", undefined, locale)}</h3>
              <div className="upgrade-list">
                {consumableDefinitions.map((item) => {
                  const count = consumableInventory[item.id] ?? 0;
                  return (
                    <div className="upgrade-row" key={item.id}>
                      <div>
                        <strong>{t(item.nameKey as MessageKey, undefined, locale)}</strong>
                        <p className="muted small">{t(item.descriptionKey as MessageKey, undefined, locale)}</p>
                        <p className="muted small">{formatConsumableEffect(item.effects)}</p>
                        <p className="muted small">
                          {t("alchemy.itemDuration", { seconds: formatSeconds(item.durationMs / 1000) }, locale)}
                        </p>
                        <p className="muted small">{t("alchemy.itemCount", { count }, locale)}</p>
                      </div>
                      <div className="upgrade-actions">
                        <button className="action-button" disabled={count <= 0} onClick={() => handleConsumeItem(item.id)}>
                          {t("alchemy.consume", undefined, locale)}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <h3>{t("alchemy.buffsTitle", undefined, locale)}</h3>
              {activeBuffs.length === 0 ? (
                <p className="muted small">{t("alchemy.noBuffs", undefined, locale)}</p>
              ) : (
                <ul className="muted small">
                  {activeBuffs.map((buff, index) => {
                    const def = findConsumableDefinition(buff.id);
                    return (
                      <li key={`${buff.id}-${index}`}>
                        {t(def.nameKey as MessageKey, undefined, locale)} — {formatConsumableEffect(buff.effects)} ({formatSeconds(buff.remainingMs / 1000)})
                      </li>
                    );
                  })}
                </ul>
              )}

              <h3>{t("alchemy.lastFinished", undefined, locale)}</h3>
              {lastBrewed ? (
                <p className="muted small">
                  {t(findConsumableDefinition(lastBrewed.itemId).nameKey as MessageKey, undefined, locale)} × {lastBrewed.quantity}
                </p>
              ) : (
                <p className="muted small">{t("alchemy.noLast", undefined, locale)}</p>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "expeditions" ? (
        <section className="card">
          <div className="card-header">
            <div>
              <h2>{t("expeditions.title", undefined, locale)}</h2>
              <p className="muted small">{t("expeditions.hint", undefined, locale)}</p>
            </div>
            <div className="muted small">
              {activeExpedition ? t("expeditions.activeLabel", undefined, locale) : t("expeditions.idleLabel", undefined, locale)}
            </div>
          </div>
          <div className="help-section">
            <h3>{t("expeditions.available", undefined, locale)}</h3>
            <div className="upgrade-list">
              {expeditionDefinitions.map((def) => {
                const unlocked = gameState.expeditions.unlockedExpeditions[def.id];
                const realmAllowed = !def.requiredRealm || gameState.realm.current === def.requiredRealm || gameState.realm.unlockedTabs.includes("realm");
                const disabledReason = activeExpedition
                  ? t("expeditions.reason.active", undefined, locale)
                  : !unlocked || !realmAllowed
                    ? t("expeditions.reason.locked", undefined, locale)
                    : null;
                const progressLocked = Boolean(disabledReason);
                const discipleSelection = selectedExpeditionDisciple[def.id] ?? "";
                return (
                  <div className="upgrade-row" key={def.id}>
                    <div>
                      <strong>{t(def.nameKey as MessageKey, undefined, locale)}</strong>
                      <p className="muted small">{t(def.descKey as MessageKey, undefined, locale)}</p>
                      <p className="muted small">
                        {t("expeditions.duration", { seconds: formatSeconds(def.durationMs / 1000) }, locale)}
                      </p>
                    </div>
                    <div className="upgrade-actions">
                      <label className="muted small">
                        {t("expeditions.assignFollower", undefined, locale)}
                        <select
                          value={discipleSelection}
                          onChange={(event) =>
                            setSelectedExpeditionDisciple((prev) => ({ ...prev, [def.id]: event.target.value || null }))
                          }
                          style={{ marginLeft: "4px" }}
                        >
                          <option value="">{t("expeditions.noFollower", undefined, locale)}</option>
                          {gameState.disciples.roster.map((disciple) => (
                            <option key={disciple.id} value={disciple.id}>
                              {t(findDiscipleArchetype(disciple.archetypeId).nameKey as MessageKey, undefined, locale)} •{" "}
                              {disciple.role ? discipleRoleLabels[disciple.role] : t("disciples.unassigned", undefined, locale)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="action-button"
                        disabled={progressLocked}
                        onClick={() => handleStartExpedition(def.id, discipleSelection || null)}
                        title={disabledReason ?? undefined}
                      >
                        {t("expeditions.start", undefined, locale)}
                      </button>
                      {disabledReason ? <div className="muted small warning">{disabledReason}</div> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="help-section">
            <h3>{t("expeditions.progressTitle", undefined, locale)}</h3>
            {activeExpedition ? (
              <div className="contract-row">
                <div className="contract-info">
                  <div className="contract-title">
                    <strong>{t(findExpeditionDefinition(activeExpedition.expeditionId).nameKey as MessageKey, undefined, locale)}</strong>
                    <span className="status-pill status-active">{t("expeditions.inProgress", undefined, locale)}</span>
                  </div>
                  <p className="muted small">
                    {t("expeditions.remaining", { seconds: formatSeconds(activeExpedition.remainingMs / 1000) }, locale)}
                  </p>
                  <div className="progress-bar contract-progress">
                    <div
                      className="progress-fill"
                      style={{ width: `${Math.min(1, 1 - activeExpedition.remainingMs / activeExpedition.totalMs) * 100}%` }}
                    />
                  </div>
                  <div className="muted small">
                    {t("expeditions.eventTimer", { seconds: formatSeconds(activeExpedition.nextEventMs / 1000) }, locale)}
                  </div>
                  <ul className="muted small">
                    {activeExpedition.log.map((entry, index) => (
                      <li key={`${entry}-${index}`}>{t(entry as MessageKey, undefined, locale)}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="muted small">{t("expeditions.noActive", undefined, locale)}</p>
            )}
          </div>

          <div className="help-section">
            <h3>{t("expeditions.lastResult", undefined, locale)}</h3>
            {gameState.expeditions.lastResult ? (
              <div className="contract-row">
                <div className="contract-info">
                  <div className="contract-title">
                    <strong>
                      {t(
                        findExpeditionDefinition(gameState.expeditions.lastResult.expeditionId).nameKey as MessageKey,
                        undefined,
                        locale
                      )}
                    </strong>
                    <span className="status-pill status-completed">{t("contracts.status.completed", undefined, locale)}</span>
                  </div>
                  <ul className="muted small">
                    {gameState.expeditions.lastResult.log.map((entry, index) => (
                      <li key={`${entry}-${index}`}>{t(entry as MessageKey, undefined, locale)}</li>
                    ))}
                  </ul>
                </div>
                <div className="contract-actions">
                  {gameState.expeditions.lastResult.rewards.map((reward, index) => (
                    <RewardBadge key={index} label={t("expeditions.rewardLabel", undefined, locale)} amount={formatExpeditionReward(reward)} />
                  ))}
                </div>
              </div>
            ) : (
              <p className="muted small">{t("expeditions.noResult", undefined, locale)}</p>
            )}
          </div>
        </section>
      ) : null}

      {activeTab === "disciples" ? (
        <section className="card">
          <div className="card-header">
            <div>
              <h2>{t("disciples.title", undefined, locale)}</h2>
              <p className="muted small">{t("disciples.hint", undefined, locale)}</p>
            </div>
            <div className="muted small">
              {t(
                "disciples.recruitCost",
                {
                  essence: formatInt(DISCIPLE_RECRUIT_COST.essence, locale),
                  reputation: formatInt(DISCIPLE_RECRUIT_COST.reputation, locale)
                },
                locale
              )}
            </div>
          </div>

          <div className="reputation-summary">
            <div className="muted small">
              {t(
                "disciples.automation.claim",
                {
                  status: discipleModifiers.autoClaimContracts
                    ? t("disciples.automation.enabled", undefined, locale)
                    : t("disciples.automation.disabled", undefined, locale)
                },
                locale
              )}
            </div>
            <div className="muted small">
              {t(
                "disciples.automation.accept",
                {
                  status: discipleModifiers.autoAcceptContracts
                    ? t("disciples.automation.enabled", undefined, locale)
                    : t("disciples.automation.disabled", undefined, locale)
                },
                locale
              )}
            </div>
            <div className="muted small">
              {t(
                "disciples.gathering",
                {
                  herb: formatCompact(discipleModifiers.herbPerSecond, { maxDecimals: 2 }),
                  ore: formatCompact(discipleModifiers.orePerSecond, { maxDecimals: 2 })
                },
                locale
              )}
            </div>
          </div>

          <div className="upgrade-actions" style={{ marginTop: "8px" }}>
            <button className="action-button" onClick={handleRecruitDisciple} disabled={!canRecruitDisciple}>
              {t("disciples.recruit", undefined, locale)}
            </button>
            {!canRecruitDisciple ? (
              <div className="muted small warning">
                {t("disciples.recruitBlocked", undefined, locale)}
              </div>
            ) : null}
          </div>

          <div className="help-section">
            <h3>{t("disciples.rosterTitle", undefined, locale)}</h3>
            {gameState.disciples.roster.length === 0 ? (
              <p className="muted small">{t("disciples.empty", undefined, locale)}</p>
            ) : (
              <div className="contract-list">
                {gameState.disciples.roster.map((disciple) => {
                  const archetype = findDiscipleArchetype(disciple.archetypeId);
                  const allowedRolesLabel = archetype.rolesAllowed.map((role) => discipleRoleLabels[role]).join(" / ");
                  return (
                    <div className="contract-row" key={disciple.id}>
                      <div className="contract-info">
                        <div className="contract-title">
                          <strong>{t(archetype.nameKey as MessageKey, undefined, locale)}</strong>
                          <span className={`status-pill ${disciple.role ? "status-active" : "status-idle"}`}>
                            {disciple.role ? discipleRoleLabels[disciple.role] : t("disciples.unassigned", undefined, locale)}
                          </span>
                        </div>
                        <p className="muted">{t(archetype.descriptionKey as MessageKey, undefined, locale)}</p>
                        <div className="muted small">
                          {t("disciples.aptitude", { value: (disciple.aptitude * 100).toFixed(1) }, locale)}
                        </div>
                        <div className="muted small">
                          {t("disciples.allowedRoles", { roles: allowedRolesLabel }, locale)}
                        </div>
                        <div className="muted small">{formatDiscipleRoleEffect(disciple.role, disciple.aptitude)}</div>
                      </div>
                      <div className="contract-actions">
                        <label className="muted small" style={{ display: "block" }}>
                          {t("disciples.assignRole", undefined, locale)}
                          <select
                            value={disciple.role ?? ""}
                            onChange={(event) => {
                              const role = event.target.value as DiscipleRole | "";
                              handleAssignDiscipleRole(disciple.id, role === "" ? null : (role as DiscipleRole));
                            }}
                            style={{ marginLeft: "4px" }}
                          >
                            <option value="">{t("disciples.role.none", undefined, locale)}</option>
                            {archetype.rolesAllowed.map((role) => (
                              <option key={role} value={role}>
                                {discipleRoleLabels[role]}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      ) : null}

      {activeTab === "ascend" ? (
        <section className="card">
          <div className="card-header">
            <div>
              <h2>{t("ascension.title", undefined, locale)}</h2>
              <p>{ascendDescription}</p>
            </div>
            <button className="action-button" onClick={handleAscend} disabled={!ascendReady}>
              {t("ascension.button", undefined, locale)}
            </button>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${ascendProgress * 100}%` }} />
          </div>
          <div className="muted small" style={{ marginTop: "8px" }}>
            <strong>{t("ascension.previewTitle", undefined, locale)}</strong>
          </div>
          <div className="muted" style={{ marginTop: "4px" }}>
            {t("ascension.previewGain", { amount: formattedInsightGain }, locale)}
            {!ascendReady ? ` • ${t("ascension.previewNotReady", undefined, locale)}` : null}
          </div>
          <div className="muted small" style={{ marginTop: "4px" }}>
            {t(
              "ascension.previewBreakdown",
              {
                essence: formattedEssenceTerm,
                contracts: formattedContractTerm
              },
              locale
            )}
          </div>
          <div className="muted small" style={{ marginTop: "4px" }}>
            {t(
              "ascension.previewRunStats",
              {
                essence: formattedEssenceEarned,
                contracts: formattedContractsCompleted
              },
              locale
            )}
          </div>
        </section>
      ) : null}

      {activeTab === "settings" ? (
        <section className="card">
          <div className="card-header">
            <div>
              <h2>{t("settings.title", undefined, locale)}</h2>
              <p className="muted small">{t("settings.description", undefined, locale)}</p>
            </div>
          </div>
          <div className="help-section">
            <h3>{t("settings.automationTitle", undefined, locale)}</h3>
            <div className="contract-list">
              <div className="contract-row">
                <div className="contract-info">
                  <div className="contract-title">
                    <strong>{t("settings.autoClaim.label", undefined, locale)}</strong>
                    <span
                      className={`status-pill ${
                        gameState.automation.autoClaimContracts ? "status-active" : "status-idle"
                      }`}
                    >
                      {gameState.automation.autoClaimContracts
                        ? t("settings.status.available", undefined, locale)
                        : t("settings.status.locked", undefined, locale)}
                    </span>
                  </div>
                  <p className="muted small">{t("settings.autoClaim.description", undefined, locale)}</p>
                  {!gameState.automation.autoClaimContracts ? (
                    <div className="muted small warning">{t("settings.requiresClerk", undefined, locale)}</div>
                  ) : null}
                </div>
                <div className="contract-actions">
                  <label className="muted small">
                    <input
                      type="checkbox"
                      checked={settings.autoClaimContracts}
                      onChange={(event) => handleUpdateSettings({ autoClaimContracts: event.target.checked })}
                      disabled={!gameState.automation.autoClaimContracts}
                    />{" "}
                    {t("settings.autoClaim.toggle", undefined, locale)}
                  </label>
                </div>
              </div>

              <div className="contract-row">
                <div className="contract-info">
                  <div className="contract-title">
                    <strong>{t("settings.autoAccept.label", undefined, locale)}</strong>
                    <span
                      className={`status-pill ${
                        gameState.automation.autoAcceptContracts ? "status-active" : "status-idle"
                      }`}
                    >
                      {gameState.automation.autoAcceptContracts
                        ? t("settings.status.available", undefined, locale)
                        : t("settings.status.locked", undefined, locale)}
                    </span>
                  </div>
                  <p className="muted small">{t("settings.autoAccept.description", undefined, locale)}</p>
                  {!gameState.automation.autoAcceptContracts ? (
                    <div className="muted small warning">{t("settings.requiresClerk", undefined, locale)}</div>
                  ) : null}
                </div>
                <div className="contract-actions">
                  <label className="muted small" style={{ display: "block" }}>
                    {t("settings.autoAccept.modeLabel", undefined, locale)}
                    <select
                      style={{ marginLeft: "4px" }}
                      value={settings.autoAcceptMode}
                      onChange={(event) =>
                        handleUpdateSettings({
                          autoAcceptMode: event.target.value as GameState["settings"]["autoAcceptMode"]
                        })
                      }
                      disabled={!gameState.automation.autoAcceptContracts}
                    >
                      {(["recommended", "highestScore", "manual"] as const).map((mode) => (
                        <option key={mode} value={mode}>
                          {autoAcceptModeLabels[mode]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="contract-row">
                <div className="contract-info">
                  <div className="contract-title">
                    <strong>{t("settings.autoForging.label", undefined, locale)}</strong>
                    <span className="status-pill status-active">{t("settings.status.available", undefined, locale)}</span>
                  </div>
                  <p className="muted small">{t("settings.autoForging.description", undefined, locale)}</p>
                </div>
                <div className="contract-actions">
                  <label className="muted small">
                    <input
                      type="checkbox"
                      checked={settings.autoForging}
                      onChange={(event) => handleUpdateSettings({ autoForging: event.target.checked })}
                    />{" "}
                    {t("settings.autoForging.toggle", undefined, locale)}
                  </label>
                </div>
              </div>

              <div className="contract-row">
                <div className="contract-info">
                  <div className="contract-title">
                    <strong>{t("settings.autoAlchemy.label", undefined, locale)}</strong>
                    <span className="status-pill status-active">{t("settings.status.available", undefined, locale)}</span>
                  </div>
                  <p className="muted small">{t("settings.autoAlchemy.description", undefined, locale)}</p>
                </div>
                <div className="contract-actions">
                  <label className="muted small">
                    <input
                      type="checkbox"
                      checked={settings.autoAlchemy}
                      onChange={(event) => handleUpdateSettings({ autoAlchemy: event.target.checked })}
                    />{" "}
                    {t("settings.autoAlchemy.toggle", undefined, locale)}
                  </label>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "dev" ? (
        <section className="card">
          <div className="card-header">
            <h2>{t("dev.title", undefined, locale)}</h2>
            <div className="muted small">{autosaveLabel}</div>
          </div>
          <div className="dev-panel">
            <div className="dev-controls">
              <button className="action-button secondary" onClick={saveGame}>
                {t("dev.saveNow", undefined, locale)}
              </button>
              <button
                className="action-button secondary"
                onClick={() => {
                  setImportText(exportText);
                  setImportError(null);
                }}
              >
                {t("dev.loadExport", undefined, locale)}
              </button>
              <button className="action-button secondary" onClick={() => handleFastForward(10_000)}>
                {t("actions.fastForward10", undefined, locale)}
              </button>
              <button className="action-button secondary" onClick={() => handleFastForward(60_000)}>
                {t("actions.fastForward60", undefined, locale)}
              </button>
            </div>
            <label className="muted">{t("dev.exportImportLabel", undefined, locale)}</label>
            <textarea
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              rows={4}
              placeholder={t("dev.textareaPlaceholder", undefined, locale)}
            />
            <div className="dev-controls">
              <button className="action-button secondary" onClick={saveGame}>
                {t("dev.exportToTextarea", undefined, locale)}
              </button>
              <button className="action-button" onClick={handleImport}>
                {t("dev.import", undefined, locale)}
              </button>
            </div>
            <div className="dev-controls">
              <button className="action-button secondary" onClick={handleCopyDiagnostics}>
                {t("safety.copyDiagnostics", undefined, locale)}
              </button>
              <button className="action-button secondary" onClick={handleResetProgress}>
                {t("safety.reset", undefined, locale)}
              </button>
              {import.meta.env.DEV ? (
                <button className="action-button secondary" onClick={handleTriggerCrash}>
                  {t("dev.triggerCrash", undefined, locale)}
                </button>
              ) : null}
            </div>
            {copyStatusLabel ? <div className="muted small">{copyStatusLabel}</div> : null}
            <div className="muted small">{t("app.versionLabel", { version: APP_VERSION }, locale)}</div>
            {importError ? (
              <div className="error">{t("dev.importError", { message: importError }, locale)}</div>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeTab === "help" ? (
        <section className="card">
          <div className="card-header">
            <div>
              <h2>{t("help.title", undefined, locale)}</h2>
              <p className="muted small">{t("help.quickstart.title", undefined, locale)}</p>
            </div>
          </div>
          <div className="help-section">
            <h3>{t("help.quickstart.title", undefined, locale)}</h3>
            <ol className="help-list">
              {quickstartSteps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </div>
          <div className="help-section">
            <h3>{t("help.glossary.title", undefined, locale)}</h3>
            <div className="help-glossary">
              {glossaryEntries.map((entry) => (
                <div className="help-glossary-row" key={entry.label}>
                  <div className="help-glossary-label">{entry.label}</div>
                  <div className="muted small">{entry.description}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="help-section">
            <h3>{t("help.faq.title", undefined, locale)}</h3>
            <ul className="help-list">
              {faqEntries.map((faq, index) => (
                <li key={index}>{faq}</li>
              ))}
            </ul>
          </div>
          <div className="muted small">{t("app.versionLabel", { version: APP_VERSION }, locale)}</div>
        </section>
      ) : null}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

function RewardBadge({ label, amount }: { label: string; amount: string }) {
  return (
    <span className="reward-badge">
      {label}: {amount}
    </span>
  );
}

export default App;
