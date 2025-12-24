import { UPGRADE_DEFINITIONS } from "./data/upgrades";
const UPGRADE_IDS = UPGRADE_DEFINITIONS.map((upgrade) => upgrade.id);
export function initializeUpgradesRecord() {
    return UPGRADE_IDS.reduce((acc, id) => {
        acc[id] = 0;
        return acc;
    }, {});
}
