import { BASE_CONTRACT_SLOTS } from "./data/constants";
import { ensureContractSlotCount } from "./contracts";
import { findResearchDefinition, RESEARCH_DEFINITIONS, type ResearchId } from "./data/research";
import type { GameState, ResearchState } from "./types";
import { getResource } from "./resources";
import { getFacilityModifiers } from "./facilities";

export interface ResearchModifiers {
  productionMult: number;
  contractSpeedMult: number;
  contractSlotsBonus: number;
}

export function initializeResearchState(): ResearchState {
  const nodes = RESEARCH_DEFINITIONS.reduce((acc, def) => {
    acc[def.id] = { purchased: false };
    return acc;
  }, {} as ResearchState["nodes"]);
  return { nodes };
}

export function applyResearchDefaults(research?: ResearchState): ResearchState {
  const defaults = initializeResearchState();
  if (!research) {
    return defaults;
  }

  const mergedNodes = { ...defaults.nodes, ...(research.nodes ?? {}) };
  return { nodes: mergedNodes };
}

export function canBuyResearch(state: GameState, id: ResearchId): boolean {
  const def = findResearchDefinition(id);
  const nodes = state.research?.nodes ?? initializeResearchState().nodes;
  const node = nodes[id];
  if (node?.purchased) {
    return false;
  }

  if (!state.realm.unlockedResearchIds.includes(id)) {
    return false;
  }

  if ((def.prerequisites ?? []).some((pre) => !nodes[pre]?.purchased)) {
    return false;
  }

  return getResource(state.resources, "research") >= def.costResearch;
}

export function applyResearchPurchase(state: GameState, id: ResearchId): GameState {
  if (!canBuyResearch(state, id)) {
    return state;
  }

  const def = findResearchDefinition(id);
  const mergedResearch = applyResearchDefaults(state.research);
  const updatedResearch: ResearchState = {
    nodes: {
      ...mergedResearch.nodes,
      [id]: { purchased: true }
    }
  };

  const updatedState: GameState = {
    ...state,
    research: updatedResearch,
    resources: {
      ...state.resources,
      research: getResource(state.resources, "research") - def.costResearch
    }
  };

  const researchModifiers = getResearchModifiers(updatedState);
  const facilityModifiers = getFacilityModifiers(updatedState);
  const desiredSlots = BASE_CONTRACT_SLOTS + researchModifiers.contractSlotsBonus + facilityModifiers.contractSlotsBonus;
  return ensureContractSlotCount(updatedState, desiredSlots);
}

export function getResearchModifiers(state: GameState): ResearchModifiers {
  let productionMult = 1;
  let contractSpeedMult = 1;
  let contractSlotsBonus = 0;

  const nodes = state.research?.nodes ?? initializeResearchState().nodes;

  RESEARCH_DEFINITIONS.forEach((def) => {
    const node = nodes[def.id];
    if (!node?.purchased) return;

    switch (def.effect.type) {
      case "productionMultiplier":
        productionMult *= def.effect.multiplier;
        break;
      case "contractSpeed":
        contractSpeedMult *= def.effect.multiplier;
        break;
      case "contractSlot":
        contractSlotsBonus += def.effect.bonus;
        break;
      default:
        break;
    }
  });

  return { productionMult, contractSpeedMult, contractSlotsBonus };
}
