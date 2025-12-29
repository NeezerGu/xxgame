export const EQUIPMENT_BLUEPRINTS = [
    {
        id: "ember-shiv",
        slot: "weapon",
        nameKey: "equipment.blueprint.emberShiv.name",
        descriptionKey: "equipment.blueprint.emberShiv.description",
        basePower: 0.05
    },
    {
        id: "woven-ward",
        slot: "armor",
        nameKey: "equipment.blueprint.wovenWard.name",
        descriptionKey: "equipment.blueprint.wovenWard.description",
        basePower: 0.04
    },
    {
        id: "circuit-band",
        slot: "ring",
        nameKey: "equipment.blueprint.circuitBand.name",
        descriptionKey: "equipment.blueprint.circuitBand.description",
        basePower: 0.03
    },
    {
        id: "glyph-charm",
        slot: "amulet",
        nameKey: "equipment.blueprint.glyphCharm.name",
        descriptionKey: "equipment.blueprint.glyphCharm.description",
        basePower: 0.025
    }
];
export const AFFIX_DEFINITIONS = [
    {
        id: "steady-flow",
        nameKey: "equipment.affix.steadyFlow.name",
        type: "productionMult",
        min: 0.04,
        max: 0.08
    },
    {
        id: "swift-handling",
        nameKey: "equipment.affix.swiftHandling.name",
        type: "contractSpeedMult",
        min: 0.08,
        max: 0.12
    },
    {
        id: "deep-reserve",
        nameKey: "equipment.affix.deepReserve.name",
        type: "offlineCapBonus",
        min: 20 * 60 * 1000,
        max: 40 * 60 * 1000
    },
    {
        id: "focused-channels",
        nameKey: "equipment.affix.focusedChannels.name",
        type: "productionMult",
        min: 0.06,
        max: 0.1
    },
    {
        id: "rapid-binding",
        nameKey: "equipment.affix.rapidBinding.name",
        type: "contractSpeedMult",
        min: 0.05,
        max: 0.1
    },
    {
        id: "anchored-focus",
        nameKey: "equipment.affix.anchoredFocus.name",
        type: "offlineCapBonus",
        min: 10 * 60 * 1000,
        max: 25 * 60 * 1000
    }
];
export function findEquipmentBlueprint(id) {
    const blueprint = EQUIPMENT_BLUEPRINTS.find((item) => item.id === id);
    if (!blueprint) {
        throw new Error(`Unknown equipment blueprint id: ${id}`);
    }
    return blueprint;
}
export function findAffixDefinition(id) {
    const affix = AFFIX_DEFINITIONS.find((item) => item.id === id);
    if (!affix) {
        throw new Error(`Unknown affix id: ${id}`);
    }
    return affix;
}
