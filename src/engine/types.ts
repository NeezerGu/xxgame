import type { ContractId } from "./data/contracts";
import type { UpgradeId } from "./data/upgrades";
import type { ResearchId } from "./data/research";
import type { RealmId } from "./data/realms";
import type { EquipmentSlot, EquipmentRarity, AffixId, EquipmentBlueprintId } from "./data/equipment";

export type { EquipmentSlot, EquipmentRarity, AffixId, EquipmentBlueprintId } from "./data/equipment";

export interface ProductionState {
  basePerSecond: number;
  additiveBonus: number;
  multiplier: number;
  perSecond: number;
}

export type ResourceId = "essence" | "insight" | "research" | "reputation" | "herb" | "ore";

export type ResourcesState = Record<ResourceId, number>;

export type ContractReward = Partial<Record<ResourceId, number>>;

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

export interface ResearchNodeState {
  purchased: boolean;
}

export interface ResearchState {
  nodes: Record<ResearchId, ResearchNodeState>;
}

export interface RunStatsState {
  essenceEarned: number;
  contractsCompleted: number;
}

export interface RealmState {
  current: RealmId;
  unlockedTabs: string[];
  unlockedContractIds: ContractId[];
  unlockedResearchIds: ResearchId[];
  unlockedRecipeIds: string[];
}

export interface EquipmentAffixInstance {
  affixId: AffixId;
  value: number;
}

export interface EquipmentInstance {
  instanceId: string;
  blueprintId: EquipmentBlueprintId;
  slot: EquipmentSlot;
  rarity: EquipmentRarity;
  affixes: EquipmentAffixInstance[];
}

export interface EquipmentInventoryState {
  items: Record<string, EquipmentInstance>;
  nextId: number;
}

export type EquippedState = Record<EquipmentSlot, string | null>;

export interface GameState {
  schemaVersion: number;
  seed: number;
  production: ProductionState;
  resources: ResourcesState;
  runStats: RunStatsState;
  realm: RealmState;
  upgrades: Record<UpgradeId, number>;
  research: ResearchState;
  lastFocusAtMs: number | null;
  contracts: ContractsState;
  equipmentInventory: EquipmentInventoryState;
  equipped: EquippedState;
}

export type Action =
  | { type: "focus"; performedAtMs: number }
  | { type: "buyUpgrade"; upgradeId: UpgradeId }
  | { type: "ascend" }
  | { type: "acceptContract"; contractId: ContractId }
  | { type: "completeContract"; contractId: ContractId }
  | { type: "buyResearch"; researchId: ResearchId }
  | { type: "breakthrough" }
  | { type: "equip"; instanceId: string }
  | { type: "unequip"; slot: EquipmentSlot };
