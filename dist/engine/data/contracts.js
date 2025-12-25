export const CONTRACT_DEFINITIONS = [
    {
        id: "starter-recon",
        nameKey: "contracts.starterRecon.name",
        descriptionKey: "contracts.starterRecon.description",
        durationMs: 10000,
        requiredReputation: 0,
        tier: 1,
        acceptCostEssence: 0,
        requiredEssencePerSecond: 0,
        reward: {
            research: 2,
            essence: 15,
            reputation: 1
        }
    },
    {
        id: "essence-delivery",
        nameKey: "contracts.essenceDelivery.name",
        descriptionKey: "contracts.essenceDelivery.description",
        durationMs: 20000,
        requiredReputation: 0,
        tier: 1,
        acceptCostEssence: 5,
        requiredEssencePerSecond: 0.5,
        reward: {
            research: 3,
            essence: 40,
            reputation: 1
        }
    },
    {
        id: "lab-support",
        nameKey: "contracts.labSupport.name",
        descriptionKey: "contracts.labSupport.description",
        durationMs: 30000,
        requiredReputation: 0,
        tier: 1,
        acceptCostEssence: 8,
        requiredEssencePerSecond: 1,
        reward: {
            research: 7,
            essence: 55,
            reputation: 2
        }
    },
    {
        id: "field-analysis",
        nameKey: "contracts.fieldAnalysis.name",
        descriptionKey: "contracts.fieldAnalysis.description",
        durationMs: 28000,
        requiredReputation: 10,
        tier: 2,
        acceptCostEssence: 15,
        requiredEssencePerSecond: 1.5,
        reward: {
            research: 16,
            essence: 45,
            reputation: 4
        }
    },
    {
        id: "relay-maintenance",
        nameKey: "contracts.relayMaintenance.name",
        descriptionKey: "contracts.relayMaintenance.description",
        durationMs: 32000,
        requiredReputation: 10,
        tier: 2,
        acceptCostEssence: 18,
        requiredEssencePerSecond: 1.5,
        reward: {
            research: 10,
            essence: 95,
            reputation: 3
        }
    },
    {
        id: "artifact-catalog",
        nameKey: "contracts.artifactCatalog.name",
        descriptionKey: "contracts.artifactCatalog.description",
        durationMs: 36000,
        requiredReputation: 10,
        tier: 2,
        acceptCostEssence: 22,
        requiredEssencePerSecond: 2,
        reward: {
            research: 18,
            essence: 40,
            reputation: 5
        }
    },
    {
        id: "stabilize-array",
        nameKey: "contracts.stabilizeArray.name",
        descriptionKey: "contracts.stabilizeArray.description",
        durationMs: 45000,
        requiredReputation: 25,
        tier: 3,
        acceptCostEssence: 30,
        requiredEssencePerSecond: 2.5,
        reward: {
            research: 20,
            essence: 100,
            reputation: 7
        }
    },
    {
        id: "sealed-archive",
        nameKey: "contracts.sealedArchive.name",
        descriptionKey: "contracts.sealedArchive.description",
        durationMs: 55000,
        requiredReputation: 50,
        tier: 4,
        acceptCostEssence: 40,
        requiredEssencePerSecond: 3,
        reward: {
            research: 28,
            essence: 130,
            reputation: 12
        }
    }
];
export function findContractDefinition(id) {
    const def = CONTRACT_DEFINITIONS.find((item) => item.id === id);
    if (!def) {
        throw new Error(`Unknown contract id: ${id}`);
    }
    return def;
}
