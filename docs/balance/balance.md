# 基础平衡表

## 升级
| ID | Cost | Effect Type | Effect |
| --- | --- | --- | --- |
| spark | 10 | add | +0.5/s |
| amplify | 50 | mult | x1.5 |

## 研究
| ID | Cost Research | Effect Type | Effect | Prerequisites |
| --- | --- | --- | --- | --- |
| contractSpeed | 6 | contractSpeed | speed x1.25 | - |
| productionBoost | 10 | productionMultiplier | prod x1.1 | contractSpeed |
| extraContractSlot | 12 | contractSlot | +1 slot(s) | productionBoost |

## 契约
| ID | Duration(s) | Reward Research | Reward Reputation | Reward Essence | Req EPS | Req Reputation |
| --- | --- | --- | --- | --- | --- | --- |
| starter-recon | 10 | 2 | 1 | 15 | 0 | 0 |
| essence-delivery | 20 | 3 | 1 | 40 | 0.5 | 0 |
| lab-support | 30 | 7 | 2 | 55 | 1 | 0 |
| field-analysis | 28 | 16 | 4 | 45 | 1.5 | 10 |
| relay-maintenance | 32 | 10 | 3 | 95 | 1.5 | 10 |
| artifact-catalog | 36 | 18 | 5 | 40 | 2 | 10 |
| stabilize-array | 45 | 20 | 7 | 100 | 2.5 | 25 |
| sealed-archive | 55 | 28 | 12 | 130 | 3 | 50 |

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
