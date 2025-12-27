export const UPGRADE_DEFINITIONS = [
    {
        id: "spark",
        nameKey: "upgrade.spark.name",
        descriptionKey: "upgrade.spark.description",
        baseCost: 10,
        costGrowth: 1.12,
        effect: { type: "add", amount: 0.5 }
    },
    {
        id: "amplify",
        nameKey: "upgrade.amplify.name",
        descriptionKey: "upgrade.amplify.description",
        baseCost: 50,
        costGrowth: 1.2,
        effect: { type: "mult", factor: 1.5 }
    }
];
export function findUpgrade(id) {
    const upgrade = UPGRADE_DEFINITIONS.find((item) => item.id === id);
    if (!upgrade) {
        throw new Error(`Unknown upgrade id: ${id}`);
    }
    return upgrade;
}
export function getUpgradeCost(definition, level) {
    const exponent = definition.costExponent ?? 1;
    const growthPower = Math.pow(definition.costGrowth, Math.pow(level, exponent));
    return Math.floor(definition.baseCost * growthPower);
}
