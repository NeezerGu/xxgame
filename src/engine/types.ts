import type { ContractId } from "./data/contracts";
import type { DiscipleArchetypeId, DiscipleRole } from "./data/disciples";
import type { UpgradeId } from "./data/upgrades";
import type { ResearchId } from "./data/research";
import type { RealmId } from "./data/realms";
import type { EquipmentSlot, EquipmentRarity, AffixId, EquipmentBlueprintId } from "./data/equipment";

export type { EquipmentSlot, EquipmentRarity, AffixId, EquipmentBlueprintId } from "./data/equipment";
export type { RealmId } from "./data/realms";

export interface ProductionState {
  basePerSecond: number;
  additiveBonus: number;
  multiplier: number;
  perSecond: number;
}

export type ResourceId = "essence" | "insight" | "research" | "reputation" | "herb" | "ore";
export type ExpeditionId =
  | "sunken-archive"
  | "shimmering-reef"
  | "ember-crater"
  | "mist-labyrinth"
  | "skyforge-span"
  | "hollow-spire";

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

export interface DiscipleInstance {
  id: string;
  archetypeId: DiscipleArchetypeId;
  aptitude: number;
  role: DiscipleRole | null;
}

export interface DisciplesState {
  roster: DiscipleInstance[];
  nextId: number;
  nextArchetypeIndex: number;
}

export interface AutomationState {
  autoClaimContracts: boolean;
  autoAcceptContracts: boolean;
}

export interface ExpeditionActiveState {
  expeditionId: ExpeditionId;
  remainingMs: number;
  totalMs: number;
  log: string[];
  discipleId: string | null;
  nextEventMs: number;
  rewardRollsRemaining: number;
}

export interface ExpeditionResult {
  expeditionId: ExpeditionId;
  rewards: ExpeditionReward[];
  log: string[];
}

export type ExpeditionReward =
  | { type: "resource"; resourceId: ResourceId; amount: number }
  | { type: "recipe"; recipeId: string }
  | { type: "equipment"; blueprintId: EquipmentBlueprintId };

export interface ExpeditionState {
  active: ExpeditionActiveState | null;
  lastResult: ExpeditionResult | null;
  unlockedExpeditions: Record<ExpeditionId, boolean>;
}

export interface ForgingTask {
  blueprintId: EquipmentBlueprintId;
  remainingMs: number;
  totalMs: number;
  rarity: EquipmentRarity;
  affixes: EquipmentAffixInstance[];
}

export interface ForgingQueueState {
  active: ForgingTask | null;
  lastFinished?: EquipmentInstance | null;
}

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
  disciples: DisciplesState;
  automation: AutomationState;
  expeditions: ExpeditionState;
  forgingQueue: ForgingQueueState;
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
  | { type: "unequip"; slot: EquipmentSlot }
  | { type: "startForge"; blueprintId: EquipmentBlueprintId }
  | { type: "disassemble"; instanceId: string }
  | { type: "recruitDisciple" }
  | { type: "assignDiscipleRole"; discipleId: string; role: DiscipleRole | null }
  | { type: "startExpedition"; expeditionId: ExpeditionId; discipleId?: string | null };
