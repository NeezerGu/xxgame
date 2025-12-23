import { UPGRADE_DEFINITIONS } from "./data/upgrades";
import type { UpgradeId } from "./data/upgrades";

const UPGRADE_IDS: UpgradeId[] = UPGRADE_DEFINITIONS.map((upgrade) => upgrade.id);

export function initializeUpgradesRecord(): Record<UpgradeId, number> {
  return UPGRADE_IDS.reduce((acc, id) => {
    acc[id] = 0;
    return acc;
  }, {} as Record<UpgradeId, number>);
}
