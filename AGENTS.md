# AGENTS

## Project intent
We are building an original incremental/idle prototype (NOT a clone of any existing game).
Goal: a playable vertical slice with deterministic simulation, offline progress, and local save/load.

## Non-infringement constraints
- Do NOT copy any text, names, lore, UI layouts, numbers, or progression tables from other games.
- Use placeholder UI and simple generated shapes/icons only (no scraped assets).
- Keep the theme generic and easily swappable via data files.
- All wording, numbers, UI 布局与资源必须原创，占位即可；禁止引用或改编任何现有游戏的文本、数值表或界面。

## Tech stack (default)
- Vite + React + TypeScript
- Unit tests: Vitest
- Lint/format: ESLint + Prettier

## Architecture rules
- Put all game logic in /src/engine as pure functions (no DOM, no React, no side effects).
- UI reads state and dispatches typed actions; engine returns new state.
- Deterministic tick simulation; RNG (if any) must be seeded and stored in state.
- All numeric configs (upgrades, costs, multipliers) must be data-driven via /src/engine/data/*.ts.

## Documentation source of truth
- docs/GAME_PLAN.md、docs/SYSTEMS.md、docs/ECONOMY.md、docs/ROADMAP.md 是唯一权威规划，改代码必须同步更新相关文档并保持一致。
- 若文档与实现不符，以文档为准，提交前应修正文档或实现使之对齐。

## Save/load rules
- Save to localStorage (key: "idle-proto-save").
- Include schemaVersion and migration utilities for future changes.
- Never break old saves without a migration.

## Task scope rules
- 一次任务只聚焦一个系统或一个里程碑点；除非明确要求，禁止在同一任务中同时重构引擎、改 UI、改存档。
- 任何改动都要遵守确定性引擎与数据驱动约束，不引入外部依赖或服务。

## Definition of done for each task
- Provide a short plan before edits.
- Implement changes.
- Run tests/build locally (npm scripts) and ensure they pass.
- Summarize what changed and which commands were run.
- 输出规范：不要写长前言或冗长计划；完成后用中文简要总结改动与执行的验证命令。
