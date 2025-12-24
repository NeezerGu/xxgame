import type { ContractId } from "./data/contracts";
import type { UpgradeId } from "./data/upgrades";

export interface ProductionState {
  basePerSecond: number;
  additiveBonus: number;
  multiplier: number;
  perSecond: number;
}

export interface ResourcesState {
  essence: number;
  insight: number;
  research: number;
  reputation: number;
}

export interface ContractReward {
  essence?: number;
  research?: number;
  insight?: number;
  reputation?: number;
}

export interface ContractSlot {
  id: ContractId;
  nameKey: string;
  descriptionKey: string;
  durationMs: number;
  reward: ContractReward;
  elapsedMs: number;
  status: "idle" | "active" | "completed";
}

export interface ContractsState {
  slots: ContractSlot[];
  maxSlots: number;
}

export interface GameState {
  schemaVersion: number;
  seed: number;
  production: ProductionState;
  resources: ResourcesState;
  upgrades: Record<UpgradeId, number>;
  lastFocusAtMs: number | null;
  contracts: ContractsState;
}

export type Action =
  | { type: "focus"; performedAtMs: number }
  | { type: "buyUpgrade"; upgradeId: UpgradeId }
  | { type: "ascend" }
  | { type: "acceptContract"; contractId: ContractId }
  | { type: "completeContract"; contractId: ContractId };
