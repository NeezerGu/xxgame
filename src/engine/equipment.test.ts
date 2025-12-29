import { describe, expect, it } from "vitest";
import { createInitialState } from "./save";
import { applyAction, tick } from "./sim";
import { getEquipmentModifiers } from "./equipment";
import { calculateProduction } from "./state";
import { computeOfflineProgress } from "./offline";
import { findEquipmentBlueprint } from "./data/equipment";

describe("equipment system", () => {
  it("equipping the starter item boosts production", () => {
    const base = createInitialState(0);
    const starterModifiers = getEquipmentModifiers(base);

    const equipped = applyAction(base, { type: "equip", instanceId: "1" });
    const equippedModifiers = getEquipmentModifiers(equipped);

    expect(equipped.equipped.weapon).toBe("1");
    expect(equippedModifiers.productionMult).toBeGreaterThan(starterModifiers.productionMult);
  });

  it("contract speed affixes accelerate progress timers", () => {
    const base = createInitialState(0);
    const speedItem = {
      instanceId: "2",
      blueprintId: "circuit-band",
      slot: "ring",
      rarity: "common",
      affixes: [{ affixId: "swift-handling", value: 0.5 }]
    } as const;
    const withItem = calculateProduction({
      ...base,
      equipmentInventory: {
        items: { ...base.equipmentInventory.items, [speedItem.instanceId]: speedItem },
        nextId: 3
      },
      equipped: { ...base.equipped, ring: speedItem.instanceId }
    });
    const funded = {
      ...withItem,
      resources: { ...withItem.resources, essence: 20 }
    };
    const accepted = applyAction(funded, { type: "acceptContract", contractId: "starter-recon" });
    const progressed = tick(accepted, 4000);
    const slot = progressed.contracts.slots.find((s) => s.id === "starter-recon");

    expect(slot?.elapsedMs).toBeGreaterThan(4000);
  });

  it("offline cap increases when wearing offline bonus gear", () => {
    const base = createInitialState(0);
    const capItem = {
      instanceId: "3",
      blueprintId: "glyph-charm",
      slot: "amulet",
      rarity: "common",
      affixes: [{ affixId: "deep-reserve", value: 30 * 60 * 1000 }]
    } as const;
    const withCap = calculateProduction({
      ...base,
      equipmentInventory: {
        items: { ...base.equipmentInventory.items, [capItem.instanceId]: capItem },
        nextId: 4
      },
      equipped: { ...base.equipped, amulet: capItem.instanceId }
    });

    const nineHours = 9 * 60 * 60 * 1000;
    const { appliedMs } = computeOfflineProgress(withCap, 0, nineHours);
    expect(appliedMs).toBeGreaterThan(8 * 60 * 60 * 1000);
  });

  it("forging produces deterministic items based on seed", () => {
    const blueprintId = "ember-shiv";
    const duration = findEquipmentBlueprint(blueprintId).forgeTimeMs;
    const firstRun = {
      ...createInitialState(0),
      seed: 123,
      resources: { ...createInitialState(0).resources, essence: 100, ore: 100 }
    };
    const started = applyAction(firstRun, { type: "startForge", blueprintId });
    const progressed = tick(started, duration);
    const crafted = progressed.forgingQueue.lastFinished!;

    const secondRun = {
      ...createInitialState(0),
      seed: 123,
      resources: { ...createInitialState(0).resources, essence: 100, ore: 100 }
    };
    const startedB = applyAction(secondRun, { type: "startForge", blueprintId });
    const progressedB = tick(startedB, duration);
    const craftedB = progressedB.forgingQueue.lastFinished!;

    expect(crafted.rarity).toBe(craftedB.rarity);
    expect(crafted.affixes.length).toBe(craftedB.affixes.length);
    crafted.affixes.forEach((affix, index) => {
      expect(affix.affixId).toBe(craftedB.affixes[index].affixId);
      expect(affix.value).toBeCloseTo(craftedB.affixes[index].value);
    });
  });

  it("disassembling removes items, clears equips, and refunds ore", () => {
    const base = createInitialState(0);
    const withResources = {
      ...base,
      resources: { ...base.resources, ore: 0 }
    };
    const equipped = applyAction(withResources, { type: "equip", instanceId: "1" });
    const disassembled = applyAction(equipped, { type: "disassemble", instanceId: "1" });

    expect(disassembled.equipmentInventory.items["1"]).toBeUndefined();
    expect(disassembled.equipped.weapon).toBeNull();
    expect(disassembled.resources.ore).toBeGreaterThan(withResources.resources.ore);
  });
});
