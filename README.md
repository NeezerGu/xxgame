# Arcane Workshop Prototype

A scaffold for an original incremental/idle game built with Vite, React, and TypeScript.

## 开发启动

```bash
npm install
npm run dev
```

不要直接双击 `index.html` 打开页面；请使用上面的命令通过 Vite 开启开发服务器。

## 构建与预览

```bash
npm run build
npm run preview
```

## Scripts

- `npm run dev` - 启动 Vite 开发服务器
- `npm run build` - `tsc -b` 后使用 Vite 构建
- `npm run preview` - 预览生产构建
- `npm test` - 运行 Vitest
- `npm run lint` - 运行 ESLint
- `npm run format` - 使用 Prettier 检查格式
- `npm run build:engine` - 仅构建 engine（脚本使用 `tsconfig.engine.json`）
- `npm run test:engine` - 仅运行 engine 测试脚本

## 包管理

如果你需要使用 `https://registry.npmmirror.com` 加速依赖安装，可以将 `.npmrc.example` 复制为 `.npmrc`；默认情况下无需额外配置即可直接使用官方 npm 源。
若本地环境配置了 `HTTP(S)_PROXY` 等代理变量导致安装返回 403，请清理相关环境变量或自定义 `.npmrc` 后再执行 `npm install`。

## Engine rules

Game logic lives in `src/engine` as pure TypeScript modules with deterministic simulation. UI modules under `src/ui` consume and display engine state.

## Docs

- `docs/GAME_PLAN.md` — 玩法规划与里程碑
- `docs/SYSTEMS.md` — 状态结构与动作规则
- `docs/ECONOMY.md` — 公式与调参框架
- `docs/ROADMAP.md` — 里程碑验收
- `docs/DECISIONS.md` — 关键设计决策
