import { acceptContract, completeContract, ensureContractSlotCount, progressContracts } from "./contracts";
import { ascend } from "./progression";
import { calculateProduction } from "./state";
import type { Action, GameState } from "./types";
import { findUpgrade, getUpgradeCost } from "./data/upgrades";
import { applyResearchPurchase, getResearchModifiers } from "./research";
import { breakthrough } from "./progressionRealm";
import { addResources, getResource } from "./resources";
import { equipItem, getEquipmentModifiers, unequipSlot } from "./equipment";
import { disassembleItem, progressForging, startForging } from "./forging";
import {
  applyDiscipleGathering,
  assignDiscipleRole,
  getDiscipleModifiers,
  recruitDisciple,
  runDiscipleAutomation
} from "./disciples";
import { progressExpedition, startExpedition } from "./expeditions";
import { mergeSettings } from "./settings";
import { consumeItem, getBuffModifiers, progressAlchemy, startAlchemy, tickBuffs } from "./alchemy";
import { applyUpgradeFacility, getFacilityModifiers } from "./facilities";
import { BASE_CONTRACT_SLOTS } from "./data/constants";

export const FOCUS_GAIN = 5;
export const FOCUS_COOLDOWN_MS = 3000;

export function tick(state: GameState, dtMs: number): GameState {
  if (dtMs <= 0) {
    return state;
  }

  const discipleModifiers = getDiscipleModifiers(state);
  const facilityModifiers = getFacilityModifiers(state);
  const settings = mergeSettings(state.settings, {});
  const progressedAlchemy = progressAlchemy(state, dtMs, discipleModifiers.alchemySpeedMult * facilityModifiers.alchemySpeedMult);
  const progressed = progressForging(progressedAlchemy, dtMs, discipleModifiers.forgingSpeedMult * facilityModifiers.forgingSpeedMult);
  const withGathering = applyDiscipleGathering(progressed, dtMs, discipleModifiers);
  const buffModifiers = getBuffModifiers(withGathering);

  const perSecond = withGathering.production.perSecond;
  const deltaSeconds = dtMs / 1000;
  const deltaEssence = perSecond * deltaSeconds;
  const nextResources = addResources(withGathering.resources, { essence: deltaEssence });
  const researchModifiers = getResearchModifiers(withGathering);
  const equipmentModifiers = getEquipmentModifiers(withGathering);
  const withResources: GameState = {
    ...withGathering,
    resources: nextResources,
    runStats: {
      ...withGathering.runStats,
      essenceEarned: withGathering.runStats.essenceEarned + deltaEssence
    }
  };

  const progressedContracts = progressContracts(
    withResources,
    dtMs,
    researchModifiers.contractSpeedMult *
      equipmentModifiers.contractSpeedMult *
      buffModifiers.contractSpeedMult
  );

  const progressedExpedition = progressExpedition(progressedContracts, dtMs);

  const automated = runDiscipleAutomation(progressedExpedition, discipleModifiers, settings);
  const buffTicked = tickBuffs(automated, dtMs);
  return calculateProduction(buffTicked.state);
}

export function applyAction(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "focus": {
      if (!canFocus(state, action.performedAtMs)) {
        return state;
      }

      return {
        ...state,
        resources: addResources(state.resources, { essence: FOCUS_GAIN }),
        runStats: {
          ...state.runStats,
          essenceEarned: state.runStats.essenceEarned + FOCUS_GAIN
        },
        lastFocusAtMs: action.performedAtMs
      };
    }
    case "buyUpgrade": {
      const upgradeDef = findUpgrade(action.upgradeId);
      const currentLevel = state.upgrades[upgradeDef.id] ?? 0;
      const cost = getUpgradeCost(upgradeDef, currentLevel);

      if (getResource(state.resources, "essence") < cost) {
        return state;
      }

      const newUpgrades = {
        ...state.upgrades,
        [upgradeDef.id]: currentLevel + 1
      } as GameState["upgrades"];
      const updated = {
        ...state,
        resources: addResources(state.resources, { essence: -cost }),
        upgrades: newUpgrades
      };
      return calculateProduction(updated);
    }
    case "ascend": {
      return calculateProduction(ascend(state));
    }
    case "breakthrough": {
      return calculateProduction(breakthrough(state));
    }
    case "acceptContract": {
      return acceptContract(state, action.contractId);
    }
    case "completeContract": {
      return completeContract(state, action.contractId);
    }
    case "buyResearch": {
      const updated = applyResearchPurchase(state, action.researchId);
      return calculateProduction(updated);
    }
    case "startForge": {
      const updated = startForging(state, action.blueprintId);
      return updated;
    }
    case "disassemble": {
      return disassembleItem(state, action.instanceId);
    }
    case "equip": {
      const updated = equipItem(state, action.instanceId);
      if (updated === state) {
        return state;
      }
      return calculateProduction(updated);
    }
    case "unequip": {
      const updated = unequipSlot(state, action.slot);
      if (updated === state) {
        return state;
      }
      return calculateProduction(updated);
    }
    case "recruitDisciple": {
      return recruitDisciple(state);
    }
    case "assignDiscipleRole": {
      return assignDiscipleRole(state, action.discipleId, action.role);
    }
    case "startExpedition": {
      return startExpedition(state, action.expeditionId, action.discipleId ?? null);
    }
    case "startAlchemy": {
      return startAlchemy(state, action.recipeId);
    }
    case "consumeItem": {
      const updated = consumeItem(state, action.itemId);
      if (updated === state) return state;
      return calculateProduction(updated);
    }
    case "upgradeFacility": {
      const upgraded = applyUpgradeFacility(state, action.facilityId);
      if (upgraded === state) {
        return state;
      }
      const researchModifiers = getResearchModifiers(upgraded);
      const facilityModifiers = getFacilityModifiers(upgraded);
      const desiredSlots = BASE_CONTRACT_SLOTS + researchModifiers.contractSlotsBonus + facilityModifiers.contractSlotsBonus;
      const withContracts = ensureContractSlotCount(upgraded, desiredSlots);
      return calculateProduction(withContracts);
    }
    case "updateSettings": {
      const settings = mergeSettings(state.settings, action.settings);
      return {
        ...state,
        settings
      };
    }
    default: {
      return state;
    }
  }
}

function canFocus(state: GameState, performedAtMs: number): boolean {
  if (state.lastFocusAtMs === null) {
    return true;
  }
  return performedAtMs - state.lastFocusAtMs >= FOCUS_COOLDOWN_MS;
}
