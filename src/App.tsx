import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { computeOfflineProgress } from "@engine/offline";
import { ASCEND_THRESHOLD, calculateInsightGain, canAscend } from "@engine/progression";
import { deserialize, serialize, createInitialState } from "@engine/save";
import { applyAction, tick, FOCUS_COOLDOWN_MS } from "@engine/sim";
import { getContractProgress } from "@engine/contracts";
import type { GameState, ResourceId } from "@engine/types";
import { UPGRADE_DEFINITIONS, getUpgradeCost } from "@engine/data/upgrades";
import { RESEARCH_DEFINITIONS } from "@engine/data/research";
import { CONTRACT_DEFINITIONS } from "@engine/data/contracts";
import { canBuyResearch } from "@engine/research";
import { canBreakthrough, getCurrentRealm, getNextRealm } from "@engine/progressionRealm";
import { getResource } from "@engine/resources";
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

const AUTO_SAVE_INTERVAL_MS = 5000;
const TICK_INTERVAL_MS = 250;
const ALL_TABS: TabKey[] = ["realm", "contracts", "upgrades", "research", "ascend", "dev", "help"];

type TabKey = "realm" | "contracts" | "upgrades" | "research" | "ascend" | "dev" | "help";
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
        { key: "ascend", label: t("tab.ascend", undefined, locale) },
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

  const handleFastForward = (ms: number) => {
    setGameState((prev) => tick(prev, ms));
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
