import type { UpgradeId } from "./data/upgrades";

export interface ProductionState {
  basePerSecond: number;
  additiveBonus: number;
  multiplier: number;
  perSecond: number;
}

export interface GameState {
  schemaVersion: number;
  essence: number;
  insight: number;
  production: ProductionState;
  upgrades: Record<UpgradeId, number>;
}

export type Action =
  | { type: "focus" }
  | { type: "buyUpgrade"; upgradeId: UpgradeId }
  | { type: "ascend" };
