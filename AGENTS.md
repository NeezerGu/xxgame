# AGENTS

## Project intent
We are building an original incremental/idle prototype (NOT a clone of any existing game).
Goal: a playable vertical slice with deterministic simulation, offline progress, and local save/load.

## Non-infringement constraints
- Do NOT copy any text, names, lore, UI layouts, numbers, or progression tables from other games.
- Use placeholder UI and simple generated shapes/icons only (no scraped assets).
- Keep the theme generic and easily swappable via data files.

## Tech stack (default)
- Vite + React + TypeScript
- Unit tests: Vitest
- Lint/format: ESLint + Prettier

## Architecture rules
- Put all game logic in /src/engine as pure functions (no DOM, no React, no side effects).
- UI reads state and dispatches typed actions; engine returns new state.
- Deterministic tick simulation; RNG (if any) must be seeded and stored in state.
- All numeric configs (upgrades, costs, multipliers) must be data-driven via /src/engine/data/*.ts.

## Save/load rules
- Save to localStorage (key: "idle-proto-save").
- Include schemaVersion and migration utilities for future changes.
- Never break old saves without a migration.

## Definition of done for each task
- Provide a short plan before edits.
- Implement changes.
- Run tests/build locally (npm scripts) and ensure they pass.
- Summarize what changed and which commands were run.
