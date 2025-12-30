# ECONOMY — 公式与调参框架

## 产出与乘区
- 基础产出：`baseRateE`（E/s），可随升级等级线性提升；研究可解锁新基础产出或加速。
- 乘区结构（当前实现）：`rate = (base + additive) × upgradeMult × researchMult × equipmentMult × (1 + insight × 0.05)`，其中 Insight 每点提供 5% 产出乘区，装备乘区来自当前穿戴实例的基础共振与词缀。
- 冷却与主动：Focus 奖励可设为 `focusGain = baseFocus × (1 + modifiers)`，冷却随升级缩短但有最小值。

## 成本曲线（示例区间）
- 升级成本：`cost_n = cost0 × (1 + a × n)^b` 或 `cost0 × r^n`，其中 r 在 1.08~1.18 间以控制增长；早期线性，后期轻指数。
- 当前实现：`cost = baseCost × growth^level`（向下取整，level 从 0 开始）。
- 委托接单成本（可选）：固定费用或按声望阶梯增长，防止无限刷新。
- 研究成本：以 Research 点或 Insight 支付，使用阶梯指数 `cost0 × r^(tier)`；跨分支成本区分，避免单一路径压制。
- 装备：蓝图与词缀定义位于 `src/engine/data/equipment.ts`，实例化后存入背包，稀有度对基础共振与词缀数值做乘区放大。锻造成本为精华+矿石，当前蓝图耗时在 15-25s 区间。

## 契约奖励与评分
- 奖励模板：`rewardE = baseE × (1 + repTier)`，`rewardR = baseR × speedFactor`；Insight 仅在高阶委托或升华结算时给出。
- 评分/Reputation：`repGain = baseRep × (qualityMultiplier)`；失败可减小或清零，不造成硬性惩罚。
- 时长与约束：`duration = baseDuration / (1 + speedBonuses)`；研究乘区可直接影响计时（如 +25% 速度），并可解锁额外槽位。
- 声望阶梯（示例门槛）：0 声望提供基础勘察/配送/支援单，10 声望解锁更快收益的中阶单，25/50 声望解锁高阶稳态与封印档案等高回报单。

## 锻造与分解
- 稀有度权重：common/uncommon/rare/epic = 70%/20%/9%/1%，由 seed 驱动的 RNG 决定，保证同 seed 可复现。
- 词缀数量：随稀有度递增（当前 1/2/3/4），词缀类型从定义列表中无放回抽取，数值在 min/max 间线性插值。
- 分解返还：按稀有度倍率返还蓝图 Ore 成本（示例 0.35/0.5/0.8/1），仅返还矿石以避免 Essence 通胀。

## 学徒岗位与派生
- 招募成本：120 Essence + 10 Reputation，按原型列表循环生成，资质为固定基值（如 0.18/0.20/0.16/0.14）。
- 岗位效果：
  - 委托书记：自动领取完成的委托并按评分自动接单。
  - 锻造匠人：锻造速度乘区 `1 + 0.15 × 资质`。
  - 炼金学徒：预留相同 0.15 × 资质 的炼金加速乘区（待配方上线）。
  - 采集员：被动产出 `herb/s = 0.05 × 资质`，`ore/s = 0.04 × 资质`，可叠加。

## 外勤探索奖励
- 每个探索定义时长与掉落表（资源/配方/锻造线索），tick 推进时按事件间隔触发风险或奖励事件。
- 掉落按权重表抽取 `rewardRolls` 次，结果立即入库；配方会加入 `realm.unlockedRecipeIds`，线索暂折算为等额矿石。
- 随行学徒：委托书记/采集员可减轻负面事件，锻造/炼金岗位可放大额外掉落次数。

## 研究节点示例（v0）
- Contract Speed：成本 6 R，委托计时 ×1.25。
- Essence Production：成本 10 R，产出 ×1.10。
- Extra Contract Slot：成本 12 R，前置为 Essence Production，委托槽位 +1，需补齐额外委托模板。

## 升华收益计算策略
- 目标：递进而非爆炸性增长，鼓励多次短跑。
- 建议公式：`insightGain = floor(A × log(1 + totalE / B) + C × contractsCompleted^0.5)`；A/B/C 为可调参数，依赖累计 Essence 与委托完成度。
- 保留与重置：升华重置 Essence/委托进度/部分升级，保留研究解锁与少量关键升级；Insight 乘区作用于被动产出与委托速度。
- 数据源：`totalE` 取本轮累计获得的精华（不含花费扣减），`contractsCompleted` 为本轮完成委托次数，均在 runStats 中维护。

## 离线收益上限策略
- 离线时长上限：`offlineCapMs`（默认 8h，可调）；若超出则截断。
- 装备可提供 `offlineCapBonusMs` 加成：`effectiveCap = baseCap + bonus`，用于离线结算上限。
- 结算方式：按固定 tick 封顶迭代，避免大步长误差；委托按有效时长推进，若需玩家提交资源则保持 pending。
- 防止爆仓：资源上限或递减系数，`effectiveGain = min(rawGain, cap)`，或设置仓储容量与自动售出比例。
