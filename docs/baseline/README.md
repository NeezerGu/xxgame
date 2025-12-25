# Headless 模拟器基线

本目录存放 headless 模拟输出，用于平衡与回归验证。

## 如何运行

在仓库根目录执行：

```bash
npm run sim -- --seconds 600 --tickMs 50 --seed 123 --timelineEverySec 10 --out docs/baseline/sim_10m.json
```

或使用快捷脚本：

```bash
npm run sim:baseline
```

完成后即可得到 10 分钟与 60 分钟的基线文件。

可调参数（均为可选）：

- `--seconds`: 模拟时长（秒），默认 600。
- `--tickMs`: 每 tick 的毫秒数，默认 50。
- `--seed`: 初始种子，用于确定性初始化。
- `--timelineEverySec`: 时间线采样间隔（秒），设为 0 可禁用时间线。
- `--out`: 输出文件路径（相对仓库根目录）。
- `--weightResearch` / `--weightReputation` / `--weightEssence`: 契约评分权重，默认分别为 3 / 2 / 1。

同样参数和 seed 会得到完全一致的输出，便于回归比对。

若调整了数值或策略，请先更新基线再提交：

```bash
npm run sim:baseline
```

更新后可用回归脚本校验：

```bash
npm run sim:check          # 默认只检查 10 分钟基线
npm run sim:check -- --full # 同时检查 60 分钟基线
```

## 输出字段

脚本会写入文件并在 stdout 打印完整 JSON，结构包含：

- `summary.config`: 运行参数。
- `summary.totals`: 跨周目累计指标（飞升次数、洞察获取、接单/完成计数、购买次数）。
- `summary.final`: 结束时的资源、每秒产出与当局 runStats。
- `summary.purchasedResearch` / `summary.upgradesLevels`: 已购研究与升级等级。
- `summary.timeline`: 按 `timelineEverySec` 采样的时间序列（秒、精华、EPS、洞察、声望、科研点、活跃契约数、累计完成量）。

## 基线文件

- `sim_10m.json`：10 分钟基线。生成命令：

  ```bash
  npm run sim -- --seconds 600 --tickMs 50 --seed 123 --timelineEverySec 10 --out docs/baseline/sim_10m.json
  ```

- `sim_60m.json`：60 分钟基线。生成命令：

  ```bash
  npm run sim -- --seconds 3600 --tickMs 50 --seed 123 --timelineEverySec 60 --out docs/baseline/sim_60m.json
  ```
