import { useMemo } from "react";
import type { GameState } from "@engine/types";
import { createInitialState } from "@engine/save";

function App() {
  const initialState: GameState = useMemo(() => createInitialState(Date.now()), []);

  return (
    <main style={{ padding: "2rem", maxWidth: "720px", margin: "0 auto" }}>
      <h1>Arcane Workshop Prototype</h1>
      <p>Incremental/idle vertical slice scaffolded with Vite + React + TypeScript.</p>
      <section>
        <h2>Current Snapshot</h2>
        <ul>
          <li>Essence: {initialState.essence.toFixed(2)}</li>
          <li>Insight: {initialState.insight.toFixed(2)}</li>
          <li>Production: {initialState.production.perSecond.toFixed(2)} / second</li>
        </ul>
      </section>
    </main>
  );
}

export default App;
