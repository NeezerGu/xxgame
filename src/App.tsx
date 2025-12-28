import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { computeOfflineProgress } from "@engine/offline";
import { ASCEND_THRESHOLD, calculateInsightGain, canAscend } from "@engine/progression";
import { deserialize, serialize, createInitialState } from "@engine/save";
import { applyAction, tick, FOCUS_COOLDOWN_MS } from "@engine/sim";
import { getContractProgress } from "@engine/contracts";
import type { GameState } from "@engine/types";
import { UPGRADE_DEFINITIONS, getUpgradeCost } from "@engine/data/upgrades";
import { RESEARCH_DEFINITIONS } from "@engine/data/research";
import { CONTRACT_DEFINITIONS } from "@engine/data/contracts";
import { canBuyResearch } from "@engine/research";
import { getDefaultLocale, persistLocale, t, type Locale, type MessageKey } from "./i18n";
import { copyText } from "./utils/clipboard";
import { APP_VERSION, buildDiagnosticsPayload } from "./utils/diagnostics";
import { formatCompact, formatInt, formatSeconds } from "./utils/format";
import { safeReadStorage } from "./utils/storage";
import { SAVE_KEY, TAB_STORAGE_KEY } from "./constants/storage";

const AUTO_SAVE_INTERVAL_MS = 5000;
const TICK_INTERVAL_MS = 250;

type TabKey = "contracts" | "upgrades" | "research" | "ascend" | "dev" | "help";

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
    if (
      saved === "contracts" ||
      saved === "upgrades" ||
      saved === "research" ||
      saved === "ascend" ||
      saved === "dev" ||
      saved === "help"
    ) {
      return saved;
    }
    return "contracts";
  });

  if (shouldCrash) {
    throw new Error("Manual crash trigger");
  }

  const gameStateRef = useRef(gameState);
  const lastTickRef = useRef(performance.now());
  const savingRef = useRef(false);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = t("app.title", undefined, locale);
  }, [locale]);

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
    setActiveTab(tab);
    try {
      window.localStorage.setItem(TAB_STORAGE_KEY, tab);
    } catch {
      // ignore storage errors
    }
  };

  const ascendProgress = Math.min(1, gameState.resources.essence / ASCEND_THRESHOLD);
  const ascendReady = canAscend(gameState);
  const insightPreview = calculateInsightGain(gameState);
  const formattedInsightGain = formatInt(insightPreview.gain, locale);
  const formattedEssenceTerm = formatCompact(insightPreview.essenceTerm, { maxDecimals: 2 });
  const formattedContractTerm = formatCompact(insightPreview.contractTerm, { maxDecimals: 2 });
  const formattedEssenceEarned = formatCompact(gameState.runStats.essenceEarned, { maxDecimals: 2 });
  const formattedContractsCompleted = formatInt(gameState.runStats.contractsCompleted, locale);
  const reputation = gameState.resources.reputation;
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
  const glossaryEntries = useMemo(
    () => [
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
      }
    ],
    [locale]
  );
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
          <Stat
            label={t("stats.essence", undefined, locale)}
            value={formatCompact(gameState.resources.essence)}
          />
          <Stat
            label={t("stats.research", undefined, locale)}
            value={formatInt(gameState.resources.research, locale)}
          />
          <Stat
            label={t("stats.reputation", undefined, locale)}
            value={formatInt(gameState.resources.reputation, locale)}
          />
          <Stat
            label={t("stats.insight", undefined, locale)}
            value={formatInt(gameState.resources.insight, locale)}
          />
          <Stat
            label={t("stats.essencePerSecond", undefined, locale)}
            value={formatCompact(gameState.production.perSecond)}
          />
        </div>
      </header>

      <nav className="tabs">
        {(
          [
            { key: "contracts", label: t("tab.contracts", undefined, locale) },
            { key: "upgrades", label: t("tab.upgrades", undefined, locale) },
            { key: "research", label: t("tab.research", undefined, locale) },
            { key: "ascend", label: t("tab.ascend", undefined, locale) },
            { key: "dev", label: t("tab.dev", undefined, locale) },
            { key: "help", label: t("tab.help", undefined, locale) }
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            className={`tab-button ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => handleTabChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

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
            <div className="contract-list">
              {gameState.contracts.slots.map((slot) => {
                const def = CONTRACT_DEFINITIONS.find((item) => item.id === slot.id);
                const requiredReputation = def?.requiredReputation ?? 0;
                const acceptCost = def?.acceptCostEssence ?? 0;
                const requiredEssencePerSecond = def?.requiredEssencePerSecond ?? 0;
                const formattedDuration = formatSeconds(slot.durationMs / 1000);
                const formattedAcceptCost = formatInt(acceptCost, locale);
                const formattedRequiredEps = formatCompact(requiredEssencePerSecond, { maxDecimals: 1 });
                const formattedRequiredReputation = formatInt(requiredReputation, locale);
                const isUnlocked = reputation >= requiredReputation;
                const progress = getContractProgress(slot);
                const isActive = slot.status === "active";
                const isCompleted = slot.status === "completed";
                const hasCapacity = activeContracts < gameState.contracts.maxSlots || isActive || isCompleted;
                const hasEssenceForCost = gameState.resources.essence >= acceptCost;
                const meetsEssenceRate = gameState.production.perSecond >= requiredEssencePerSecond;
                const disabledReason = !isUnlocked
                  ? t("contracts.requireReputation", { required: formattedRequiredReputation }, locale)
                  : !hasCapacity
                    ? t(
                        "contracts.reason.capacity",
                        { max: formatInt(gameState.contracts.maxSlots, locale) },
                        locale
                      )
                    : !hasEssenceForCost
                      ? t("contracts.reason.cost", { cost: formattedAcceptCost }, locale)
                      : !meetsEssenceRate
                        ? t("contracts.reason.eps", { eps: formattedRequiredEps }, locale)
                        : undefined;
                return (
                  <div className="contract-row" key={slot.id}>
                    <div className="contract-info">
                      <div className="contract-title">
                        <strong>{t(slot.nameKey as MessageKey, undefined, locale)}</strong>
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
                      {acceptCost > 0 ? (
                        <div className="muted small">
                          {t("contracts.acceptCost", { cost: formattedAcceptCost }, locale)}
                        </div>
                      ) : null}
                      {requiredEssencePerSecond > 0 ? (
                        <div className="muted small">
                          {t("contracts.requiredEps", { eps: formattedRequiredEps }, locale)}
                        </div>
                      ) : null}
                      {!isUnlocked ? (
                        <div className="muted small warning">
                          {t("contracts.requireReputation", { required: formattedRequiredReputation }, locale)}
                        </div>
                      ) : null}
                      {isActive ? (
                        <div className="progress-bar contract-progress">
                          <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
                        </div>
                      ) : null}
                    </div>
                    <div className="contract-actions">
                      <div className="reward-row">
                        {slot.reward.essence ? (
                          <RewardBadge
                            label={t("stats.essence", undefined, locale)}
                            amount={formatCompact(slot.reward.essence)}
                          />
                        ) : null}
                        {slot.reward.research ? (
                          <RewardBadge
                            label={t("stats.research", undefined, locale)}
                            amount={formatInt(slot.reward.research, locale)}
                          />
                        ) : null}
                        {slot.reward.reputation ? (
                          <RewardBadge
                            label={t("stats.reputation", undefined, locale)}
                            amount={formatInt(slot.reward.reputation, locale)}
                          />
                        ) : null}
                      </div>
                      {isCompleted ? (
                        <button
                          className="action-button"
                          onClick={() => setGameState((prev) => applyAction(prev, { type: "completeContract", contractId: slot.id }))}
                        >
                          {t("contracts.claim", undefined, locale)}
                        </button>
                      ) : (
                        <button
                          className="action-button secondary"
                          disabled={isActive || !isUnlocked || !hasCapacity || !hasEssenceForCost || !meetsEssenceRate}
                          onClick={() => setGameState((prev) => applyAction(prev, { type: "acceptContract", contractId: slot.id }))}
                        >
                          {isUnlocked
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
              const affordable = gameState.resources.essence >= nextCost;
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
              {t("research.balance", { amount: formatInt(gameState.resources.research, locale) }, locale)}
            </div>
          </div>
          <div className="upgrade-list">
            {RESEARCH_DEFINITIONS.map((node) => {
              const purchased = gameState.research.nodes[node.id]?.purchased;
              const prerequisitesMet = (node.prerequisites ?? []).every(
                (pre) => gameState.research.nodes[pre]?.purchased
              );
              const affordable = gameState.resources.research >= node.costResearch;
              const buyable = canBuyResearch(gameState, node.id);
              const buttonLabel = purchased
                ? t("research.purchased", undefined, locale)
                : !prerequisitesMet
                  ? t("research.locked", undefined, locale)
                  : t("research.buy", undefined, locale);
              return (
                <div className="upgrade-row" key={node.id}>
                  <div>
                    <strong>{t(node.nameKey as MessageKey, undefined, locale)}</strong>
                    <p className="muted">{t(node.descriptionKey as MessageKey, undefined, locale)}</p>
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
