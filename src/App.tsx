import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { computeOfflineProgress } from "@engine/offline";
import { ASCEND_THRESHOLD } from "@engine/progression";
import { deserialize, serialize, createInitialState } from "@engine/save";
import { applyAction, tick, FOCUS_COOLDOWN_MS } from "@engine/sim";
import type { GameState } from "@engine/types";
import { UPGRADE_DEFINITIONS } from "@engine/data/upgrades";

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

  const gameStateRef = useRef(gameState);
  const lastTickRef = useRef(performance.now());
  const savingRef = useRef(false);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

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
      setImportError(error instanceof Error ? error.message : "Invalid save data");
    }
  };

  const ascendProgress = Math.min(1, gameState.essence / ASCEND_THRESHOLD);
  const focusLabel =
    focusCooldownRemaining > 0
      ? `Focus (cooldown ${(focusCooldownRemaining / 1000).toFixed(1)}s)`
      : "Focus";

  return (
    <main className="page">
      <header className="header">
        <div>
          <h1>Arcane Workshop Prototype</h1>
          <p>Deterministic idle prototype scaffold.</p>
        </div>
        <div className="stats-grid">
          <Stat label="Essence" value={gameState.essence} />
          <Stat label="Insight" value={gameState.insight} />
          <Stat label="Essence/sec" value={gameState.production.perSecond} />
        </div>
      </header>

      <section className="card">
        <div className="card-header">
          <div>
            <h2>Ascension Progress</h2>
            <p>
              Reach {ASCEND_THRESHOLD.toLocaleString()} Essence to ascend. Progress:{" "}
              {(ascendProgress * 100).toFixed(1)}%
            </p>
          </div>
          <button className="action-button" onClick={handleAscend} disabled={ascendProgress < 1}>
            Ascend
          </button>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${ascendProgress * 100}%` }} />
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2>Actions</h2>
          <div className="actions-row">
            <button
              className="action-button"
              onClick={handleFocus}
              disabled={focusCooldownRemaining > 0}
              title="Gain a burst of Essence"
            >
              {focusLabel}
            </button>
            <button className="action-button secondary" onClick={() => handleFastForward(10_000)}>
              Fast-forward 10s
            </button>
            <button className="action-button secondary" onClick={() => handleFastForward(60_000)}>
              Fast-forward 60s
            </button>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2>Upgrades</h2>
        </div>
        <div className="upgrade-list">
          {UPGRADE_DEFINITIONS.map((upgrade) => {
            const owned = gameState.upgrades[upgrade.id] ?? 0;
            const affordable = gameState.essence >= upgrade.cost;
            return (
              <div className="upgrade-row" key={upgrade.id}>
                <div>
                  <strong>{upgrade.name}</strong>
                  <p className="muted">
                    {upgrade.description} • Owned: {owned}
                  </p>
                </div>
                <div className="upgrade-actions">
                  <span className="cost">Cost: {upgrade.cost}</span>
                  <button
                    className="action-button"
                    onClick={() => handleBuyUpgrade(upgrade.id)}
                    disabled={!affordable}
                  >
                    Buy
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2>Dev Panel</h2>
          <div className="muted small">
            Autosaves every 5s{lastSavedAtMs ? ` • Last saved ${new Date(lastSavedAtMs).toLocaleTimeString()}` : ""}.
          </div>
        </div>
        <div className="dev-panel">
          <div className="dev-controls">
            <button className="action-button secondary" onClick={saveGame}>
              Save Now
            </button>
            <button
              className="action-button secondary"
              onClick={() => {
                setImportText(exportText);
                setImportError(null);
              }}
            >
              Load Export
            </button>
          </div>
          <label className="muted">Export / Import Save JSON</label>
          <textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            rows={4}
            placeholder="Paste save JSON here"
          />
          <div className="dev-controls">
            <button className="action-button secondary" onClick={saveGame}>
              Export to textarea
            </button>
            <button className="action-button" onClick={handleImport}>
              Import
            </button>
          </div>
          {importError ? <div className="error">Import error: {importError}</div> : null}
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
