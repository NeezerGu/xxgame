import { execFileSync } from "node:child_process";
import assert from "node:assert";
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";

function createExtensionlessShims(root) {
  for (const entry of readdirSync(root)) {
    const fullPath = join(root, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      createExtensionlessShims(fullPath);
    } else if (stats.isFile() && fullPath.endsWith(".js")) {
      const shimPath = fullPath.slice(0, -3);
      const fileName = basename(fullPath);
      const shimContent = `export * from "./${fileName}";\n`;
      writeFileSync(shimPath, shimContent);
    }
  }
}

function compileEngine() {
  execFileSync("tsc", ["-p", "tsconfig.engine.json"], { stdio: "inherit" });
  createExtensionlessShims("dist/engine");
}

function approxEqual(a, b, epsilon = 1e-9) {
  assert.ok(Math.abs(a - b) <= epsilon, `Expected ${a} ≈ ${b}`);
}

const results = [];

async function runTest(name, fn) {
  try {
    await fn();
    results.push({ name, status: "pass" });
  } catch (error) {
    results.push({ name, status: "fail", error });
  }
}

function assertAllPassed() {
  const failed = results.filter((result) => result.status === "fail");
  if (failed.length > 0) {
    for (const item of failed) {
      console.error(`✖ ${item.name}:`, item.error?.message ?? item.error);
    }
    process.exit(1);
  } else {
    for (const item of results) {
      console.log(`✔ ${item.name}`);
    }
  }
}

compileEngine();

const { tick, applyAction, FOCUS_COOLDOWN_MS, FOCUS_GAIN } = await import("../dist/engine/sim.js");
const { computeOfflineProgress } = await import("../dist/engine/offline.js");
const { createInitialState } = await import("../dist/engine/save.js");
const { ascend } = await import("../dist/engine/progression.js");

await runTest("tick determinism", () => {
  const initial = createInitialState(0);
  const dt = 1000;

  const resultA = tick(initial, dt);
  const resultB = tick(initial, dt);

  approxEqual(resultA.essence, resultB.essence);
  approxEqual(resultA.production.perSecond, resultB.production.perSecond);
});

await runTest("upgrade purchase adjusts essence and production", () => {
  const starting = { ...createInitialState(0), essence: 100 };
  const updated = applyAction(starting, { type: "buyUpgrade", upgradeId: "spark" });

  approxEqual(updated.essence, 90);
  assert.ok(updated.production.perSecond > starting.production.perSecond);
});

await runTest("offline progress respects cap", () => {
  const starting = createInitialState(0);
  const tenHoursMs = 10 * 60 * 60 * 1000;
  const { state, appliedMs } = computeOfflineProgress(starting, 0, tenHoursMs);

  assert.strictEqual(appliedMs, 8 * 60 * 60 * 1000);
  approxEqual(state.essence, 28800);
});

await runTest("ascend resets run and grants insight", () => {
  const starting = { ...createInitialState(0), essence: 2500, insight: 3 };
  const ascended = ascend(starting);

  assert.strictEqual(ascended.essence, 0);
  assert.strictEqual(ascended.insight, 5);
  assert.ok(Object.values(ascended.upgrades).every((level) => level === 0));
});

await runTest("focus respects cooldown", () => {
  const initial = createInitialState(0);
  const first = applyAction(initial, { type: "focus", performedAtMs: 0 });
  const second = applyAction(first, { type: "focus", performedAtMs: FOCUS_COOLDOWN_MS / 2 });
  const third = applyAction(second, { type: "focus", performedAtMs: FOCUS_COOLDOWN_MS + 10 });

  assert.ok(first.essence > initial.essence);
  approxEqual(second.essence, first.essence);
  approxEqual(third.essence, first.essence + FOCUS_GAIN);
});

assertAllPassed();
