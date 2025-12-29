# 基础平衡表

## 升级
| ID | Base Cost | Cost Growth | Cost Exponent | Level0 Cost | Effect Type | Effect |
| --- | --- | --- | --- | --- | --- | --- |
| spark | 10 | 1.12 | 1 | 10 | add | +0.5/s |
| amplify | 50 | 1.2 | 1 | 50 | mult | x1.5 |

## 研究
| ID | Cost Research | Effect Type | Effect | Prerequisites |
| --- | --- | --- | --- | --- |
| contractSpeed | 6 | contractSpeed | speed x1.25 | - |
| productionBoost | 10 | productionMultiplier | prod x1.1 | contractSpeed |
| extraContractSlot | 12 | contractSlot | +1 slot(s) | productionBoost |

## 契约
| ID | Duration(s) | Reward essence | Reward insight | Reward research | Reward reputation | Reward herb | Reward ore | Req EPS | Req Reputation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| starter-recon | 10 | 15 | 0 | 2 | 1 | 0 | 0 | 0 | 0 |
| essence-delivery | 20 | 40 | 0 | 3 | 1 | 0 | 0 | 0.5 | 0 |
| lab-support | 30 | 55 | 0 | 7 | 2 | 0 | 0 | 1 | 0 |
| field-analysis | 28 | 45 | 0 | 16 | 4 | 0 | 0 | 1.5 | 10 |
| relay-maintenance | 32 | 95 | 0 | 10 | 3 | 0 | 0 | 1.5 | 10 |
| artifact-catalog | 36 | 40 | 0 | 18 | 5 | 0 | 0 | 2 | 10 |
| stabilize-array | 45 | 100 | 0 | 20 | 7 | 0 | 0 | 2.5 | 25 |
| sealed-archive | 55 | 130 | 0 | 28 | 12 | 0 | 0 | 3 | 50 |
| herb-gathering | 35 | 25 | 0 | 8 | 3 | 15 | 0 | 1.5 | 15 |
| ore-survey | 42 | 35 | 0 | 12 | 4 | 0 | 10 | 2 | 25 |

## 装备蓝图
| ID | Slot | Base Power | Name Key | Description Key |
| --- | --- | --- | --- | --- |
| ember-shiv | weapon | 0.05 | equipment.blueprint.emberShiv.name | equipment.blueprint.emberShiv.description |
| woven-ward | armor | 0.04 | equipment.blueprint.wovenWard.name | equipment.blueprint.wovenWard.description |
| circuit-band | ring | 0.03 | equipment.blueprint.circuitBand.name | equipment.blueprint.circuitBand.description |
| glyph-charm | amulet | 0.025 | equipment.blueprint.glyphCharm.name | equipment.blueprint.glyphCharm.description |

## 装备词缀
| ID | Name Key | Type | Min | Max |
| --- | --- | --- | --- | --- |
| steady-flow | equipment.affix.steadyFlow.name | productionMult | 0.04 | 0.08 |
| swift-handling | equipment.affix.swiftHandling.name | contractSpeedMult | 0.08 | 0.12 |
| deep-reserve | equipment.affix.deepReserve.name | offlineCapBonus | 1200000 | 2400000 |
| focused-channels | equipment.affix.focusedChannels.name | productionMult | 0.06 | 0.1 |
| rapid-binding | equipment.affix.rapidBinding.name | contractSpeedMult | 0.05 | 0.1 |
| anchored-focus | equipment.affix.anchoredFocus.name | offlineCapBonus | 600000 | 1500000 |

## 关键常量
| Key | Value |
| --- | --- |
| ASCEND_THRESHOLD | 1000 |
| BASE_CONTRACT_SLOTS | 3 |
| FOCUS_COOLDOWN_MS | 3000 |
| FOCUS_GAIN | 5 |
| INSIGHT_GAIN_A | 4 |
| INSIGHT_GAIN_B | 400 |
| INSIGHT_GAIN_C | 2 |
| INSIGHT_PROD_BONUS_PER_POINT | 0.05 |
| OFFLINE_CAP_MS | 28800000 |
