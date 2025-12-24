# Arcane Workshop Prototype

A scaffold for an original incremental/idle game built with Vite, React, and TypeScript.

## Getting started

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` - start the dev server
- `npm run build` - type-check and build for production
- `npm run preview` - preview the production build
- `npm test` - run Vitest unit tests
- `npm run lint` - run ESLint
- `npm run format` - format with Prettier

## Engine rules

Game logic lives in `src/engine` as pure TypeScript modules with deterministic simulation. UI modules under `src/ui` consume and display engine state.

## Docs

- `docs/GAME_PLAN.md` — 玩法规划与里程碑
- `docs/SYSTEMS.md` — 状态结构与动作规则
- `docs/ECONOMY.md` — 公式与调参框架
- `docs/ROADMAP.md` — 里程碑验收
- `docs/DECISIONS.md` — 关键设计决策
