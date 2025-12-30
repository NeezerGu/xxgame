export const CONSUMABLE_DEFINITIONS = [
    {
        id: "ember-elixir",
        nameKey: "alchemy.item.emberElixir.name",
        descriptionKey: "alchemy.item.emberElixir.description",
        durationMs: 60000,
        effects: {
            productionMult: 1.12
        }
    },
    {
        id: "quicksign-tonic",
        nameKey: "alchemy.item.quicksignTonic.name",
        descriptionKey: "alchemy.item.quicksignTonic.description",
        durationMs: 60000,
        effects: {
            contractSpeedMult: 1.15
        }
    },
    {
        id: "balanced-draught",
        nameKey: "alchemy.item.balancedDraught.name",
        descriptionKey: "alchemy.item.balancedDraught.description",
        durationMs: 90000,
        effects: {
            productionMult: 1.05,
            contractSpeedMult: 1.05
        }
    }
];
export const ALCHEMY_RECIPES = [
    {
        id: "ember-elixir",
        nameKey: "alchemy.recipe.emberElixir.name",
        descriptionKey: "alchemy.recipe.emberElixir.description",
        durationMs: 20000,
        cost: { herb: 8, essence: 25 },
        result: { itemId: "ember-elixir", quantity: 1 },
        alwaysUnlocked: true
    },
    {
        id: "quicksign-tonic",
        nameKey: "alchemy.recipe.quicksignTonic.name",
        descriptionKey: "alchemy.recipe.quicksignTonic.description",
        durationMs: 25000,
        cost: { herb: 10, essence: 35 },
        result: { itemId: "quicksign-tonic", quantity: 1 }
    },
    {
        id: "balanced-draught",
        nameKey: "alchemy.recipe.balancedDraught.name",
        descriptionKey: "alchemy.recipe.balancedDraught.description",
        durationMs: 30000,
        cost: { herb: 15, essence: 40 },
        result: { itemId: "balanced-draught", quantity: 1 }
    }
];
export function findAlchemyRecipe(id) {
    const recipe = ALCHEMY_RECIPES.find((item) => item.id === id);
    if (!recipe) {
        throw new Error(`Unknown alchemy recipe: ${id}`);
    }
    return recipe;
}
export function findConsumableDefinition(id) {
    const def = CONSUMABLE_DEFINITIONS.find((item) => item.id === id);
    if (!def) {
        throw new Error(`Unknown consumable id: ${id}`);
    }
    return def;
}
