# ECONOMY — 公式与调参框架

## 产出与乘区
- 基础产出：`baseRateE`（E/s），可随升级等级线性提升；研究可解锁新基础产出或加速。
- 乘区结构：`rate = baseRateE × (1 + upgradeAdd) × (1 + researchAdd) × (1 + insightAdd)`；避免无限叠乘，推荐将部分改为加法增益。
- 冷却与主动：Focus 奖励可设为 `focusGain = baseFocus × (1 + modifiers)`，冷却随升级缩短但有最小值。

## 成本曲线（示例区间）
- 升级成本：`cost_n = cost0 × (1 + a × n)^b` 或 `cost0 × r^n`，其中 r 在 1.08~1.18 间以控制增长；早期线性，后期轻指数。
- 契约接单成本（可选）：固定费用或按声望阶梯增长，防止无限刷新。
- 研究成本：以 Research 点或 Insight 支付，使用阶梯指数 `cost0 × r^(tier)`；跨分支成本区分，避免单一路径压制。

## 契约奖励与评分
- 奖励模板：`rewardE = baseE × (1 + repTier)`，`rewardR = baseR × speedFactor`；Insight 仅在高阶契约或 Ascend 结算时给出。
- 评分/Reputation：`repGain = baseRep × (qualityMultiplier)`；失败可减小或清零，不造成硬性惩罚。
- 时长与约束：`duration = baseDuration / (1 + speedBonuses)`；可加入可选约束（限定资源类型/升级等级）以提升奖励倍数。

## Ascend 收益计算策略
- 目标：递进而非爆炸性增长，鼓励多次短跑。
- 建议公式：`insightGain = floor(A × log(1 + totalE / B) + C × contractsCompleted^0.5)`；A/B/C 为可调参数，依赖累计 Essence 与契约完成度。
- 保留与重置：Ascend 重置 Essence/契约进度/部分升级，保留研究解锁与少量关键升级；Insight 乘区作用于被动产出与契约速度。

## 离线收益上限策略
- 离线时长上限：`offlineCapMs`（默认 8h，可调）；若超出则截断。
- 结算方式：按固定 tick 封顶迭代，避免大步长误差；契约按有效时长推进，若需玩家提交资源则保持 pending。
- 防止爆仓：资源上限或递减系数，`effectiveGain = min(rawGain, cap)`，或设置仓储容量与自动售出比例。
