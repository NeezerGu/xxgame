import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { computeOfflineProgress } from "@engine/offline";
import { ASCEND_THRESHOLD } from "@engine/progression";
import { deserialize, serialize, createInitialState } from "@engine/save";
import { applyAction, tick, FOCUS_COOLDOWN_MS } from "@engine/sim";
import type { GameState } from "@engine/types";
import { UPGRADE_DEFINITIONS } from "@engine/data/upgrades";
import { getDefaultLocale, persistLocale, t, type Locale, type MessageKey } from "./i18n";

const SAVE_KEY = "idle-proto-save";
const AUTO_SAVE_INTERVAL_MS = 5000;
const TICK_INTERVAL_MS = 250;

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

function safeReadStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
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

  const ascendProgress = Math.min(1, gameState.essence / ASCEND_THRESHOLD);
  const focusLabel =
    focusCooldownRemaining > 0
      ? t("actions.focusWithCooldown", { seconds: (focusCooldownRemaining / 1000).toFixed(1) }, locale)
      : t("actions.focus", undefined, locale);
  const ascendDescription = t(
    "ascension.description",
    {
      threshold: ASCEND_THRESHOLD.toLocaleString(locale),
      progress: (ascendProgress * 100).toFixed(1)
    },
    locale
  );
  const autosaveLabel = lastSavedAtMs
    ? t("dev.autosaveWithLast", { time: new Date(lastSavedAtMs).toLocaleTimeString(locale) }, locale)
    : t("dev.autosave", undefined, locale);

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
          <Stat label={t("stats.essence", undefined, locale)} value={gameState.essence} />
          <Stat label={t("stats.insight", undefined, locale)} value={gameState.insight} />
          <Stat
            label={t("stats.essencePerSecond", undefined, locale)}
            value={gameState.production.perSecond}
          />
        </div>
      </header>

      <section className="card">
        <div className="card-header">
          <div>
            <h2>{t("ascension.title", undefined, locale)}</h2>
            <p>{ascendDescription}</p>
          </div>
          <button className="action-button" onClick={handleAscend} disabled={ascendProgress < 1}>
            {t("ascension.button", undefined, locale)}
          </button>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${ascendProgress * 100}%` }} />
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
            <button className="action-button secondary" onClick={() => handleFastForward(10_000)}>
              {t("actions.fastForward10", undefined, locale)}
            </button>
            <button className="action-button secondary" onClick={() => handleFastForward(60_000)}>
              {t("actions.fastForward60", undefined, locale)}
            </button>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2>{t("upgrades.title", undefined, locale)}</h2>
        </div>
        <div className="upgrade-list">
          {UPGRADE_DEFINITIONS.map((upgrade) => {
            const owned = gameState.upgrades[upgrade.id] ?? 0;
            const affordable = gameState.essence >= upgrade.cost;
            return (
              <div className="upgrade-row" key={upgrade.id}>
                <div>
                  <strong>{t(upgrade.nameKey as MessageKey, undefined, locale)}</strong>
                  <p className="muted">
                    {t(upgrade.descriptionKey as MessageKey, undefined, locale)} •{" "}
                    {t("upgrades.owned", { count: owned }, locale)}
                  </p>
                </div>
                <div className="upgrade-actions">
                  <span className="cost">{t("upgrades.cost", { cost: upgrade.cost }, locale)}</span>
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
          {importError ? (
            <div className="error">{t("dev.importError", { message: importError }, locale)}</div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value.toFixed(2)}</div>
    </div>
  );
}

export default App;
