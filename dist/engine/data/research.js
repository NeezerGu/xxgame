export const RESEARCH_DEFINITIONS = [
    {
        id: "contractSpeed",
        nameKey: "research.contractSpeed.name",
        descriptionKey: "research.contractSpeed.description",
        costResearch: 6,
        effect: { type: "contractSpeed", multiplier: 1.25 }
    },
    {
        id: "productionBoost",
        nameKey: "research.productionBoost.name",
        descriptionKey: "research.productionBoost.description",
        costResearch: 10,
        prerequisites: ["contractSpeed"],
        effect: { type: "productionMultiplier", multiplier: 1.1 }
    },
    {
        id: "extraContractSlot",
        nameKey: "research.extraContractSlot.name",
        descriptionKey: "research.extraContractSlot.description",
        costResearch: 12,
        prerequisites: ["productionBoost"],
        effect: { type: "contractSlot", bonus: 1 }
    }
];
export function findResearchDefinition(id) {
    const def = RESEARCH_DEFINITIONS.find((item) => item.id === id);
    if (!def) {
        throw new Error(`Unknown research id: ${id}`);
    }
    return def;
}
