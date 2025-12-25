import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runBuild, runSim } from "./sim-runner.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINE_DIR = resolve(__dirname, "..", "docs", "baseline");

const BASELINE_TARGETS = [
  {
    file: "sim_10m.json",
    config: {
      seconds: 600,
      tickMs: 50,
      seed: 123,
      timelineEverySec: 10
    }
  },
  {
    file: "sim_60m.json",
    config: {
      seconds: 3600,
      tickMs: 50,
      seed: 123,
      timelineEverySec: 60
    }
  }
];

async function run() {
  runBuild();

  mkdirSync(BASELINE_DIR, { recursive: true });
  for (const { file, config } of BASELINE_TARGETS) {
    const output = await runSim(config);
    const outPath = resolve(BASELINE_DIR, file);
    writeFileSync(outPath, JSON.stringify(output, null, 2));
    console.log(`Baseline written: ${outPath}`);
  }
}

run().catch((error) => {
  console.error("sim:baseline failed:", error);
  process.exit(1);
});
