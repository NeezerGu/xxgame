import { describe, expect, it } from "vitest";
import { createInitialState } from "./save";
import { applyAction, tick } from "./sim";
import { getEquipmentModifiers } from "./equipment";
import { calculateProduction } from "./state";
import { computeOfflineProgress } from "./offline";

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
});
