import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runBuild, runSim } from "./sim-runner.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINE_DIR = resolve(__dirname, "..", "docs", "baseline");
const EPSILON = 1e-6;

function parseArgs(argv) {
  return {
    full: argv.includes("--full")
  };
}

function loadBaseline(fileName) {
  const filePath = resolve(BASELINE_DIR, fileName);
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function compareValues(path, expected, actual, differences) {
  if (isNumber(expected) && isNumber(actual)) {
    const bothIntegers = Number.isInteger(expected) && Number.isInteger(actual);
    if (bothIntegers) {
      if (expected !== actual) {
        differences.push(`${path}: expected ${expected}, got ${actual}`);
      }
      return;
    }

    const delta = Math.abs(expected - actual);
    if (delta > EPSILON) {
      differences.push(`${path}: expected ${expected}, got ${actual} (delta ${delta})`);
    }
    return;
  }

  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length !== actual.length) {
      differences.push(`${path}: length differs (expected ${expected.length}, got ${actual.length})`);
      return;
    }
    expected.forEach((value, index) => {
      compareValues(`${path}[${index}]`, value, actual[index], differences);
    });
    return;
  }

  if (expected && typeof expected === "object" && actual && typeof actual === "object") {
    const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
    for (const key of keys) {
      compareValues(`${path}.${key}`, expected[key], actual[key], differences);
    }
    return;
  }

  if (expected !== actual) {
    differences.push(`${path}: expected ${expected}, got ${actual}`);
  }
}

async function checkBaseline(label, baselineFile) {
  const baseline = loadBaseline(baselineFile);
  const { summary: baselineSummary } = baseline;
  const current = await runSim(baselineSummary.config);
  const differences = [];
  compareValues(label, baselineSummary, current.summary, differences);
  return differences;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  runBuild();

  const targets = [["10m", "sim_10m.json"]];
  if (args.full) {
    targets.push(["60m", "sim_60m.json"]);
  }

  let hasDiff = false;
  for (const [label, fileName] of targets) {
    const diffs = await checkBaseline(label, fileName);
    if (diffs.length === 0) {
      console.log(`Baseline ${label}: OK`);
    } else {
      hasDiff = true;
      console.error(`Baseline ${label}: ${diffs.length} difference(s) found`);
      diffs.forEach((line) => console.error(` - ${line}`));
    }
  }

  if (hasDiff) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error("sim:check failed:", error);
  process.exit(1);
});
