import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";

function run(command, args) {
  execFileSync(command, args, { stdio: "inherit" });
}

run("tsc", ["-p", "tsconfig.engine.json"]);

function createExtensionlessShims(root) {
  for (const entry of readdirSync(root)) {
    const fullPath = join(root, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      createExtensionlessShims(fullPath);
    } else if (stats.isFile() && fullPath.endsWith(".js")) {
      const shimPath = fullPath.slice(0, -3);
      if (existsSync(shimPath) && statSync(shimPath).isDirectory()) {
        continue;
      }
      const fileName = basename(fullPath);
      const shimContent = `export * from "./${fileName}";\n`;
      writeFileSync(shimPath, shimContent);
    }
  }
}

createExtensionlessShims("dist/engine");

console.log("Engine build completed.");
