export const UPGRADE_DEFINITIONS = [
    {
        id: "spark",
        name: "Spark Generator",
        description: "+0.5 Essence per second",
        cost: 10,
        effect: { type: "add", amount: 0.5 }
    },
    {
        id: "amplify",
        name: "Essence Amplifier",
        description: "Multiply Essence production by 1.5",
        cost: 50,
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
