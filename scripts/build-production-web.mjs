import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "production-web");
const react = resolve(root, "react-web/dist");

if (!existsSync(react)) throw new Error("React build is missing. Run npm run react:build first.");

rmSync(output, { recursive: true, force: true });
cpSync(resolve(root, "web"), output, { recursive: true });

// The legacy app is intentionally copied from its frozen snapshot. Marketing,
// policy, and shared brand assets continue to come from the maintained web tree.
rmSync(resolve(output, "app"), { recursive: true, force: true });
cpSync(resolve(root, "vanilla-web/app"), resolve(output, "app"), { recursive: true });

mkdirSync(resolve(output, "react"), { recursive: true });
cpSync(resolve(react, "index.html"), resolve(output, "react/index.html"));
cpSync(resolve(react, "assets"), resolve(output, "assets"), { recursive: true });
for (const name of ["favicon.png", "icon-192.png", "icon-512.png", "site.webmanifest"]) {
  cpSync(resolve(react, name), resolve(output, name));
}

console.log(`Prepared ${readdirSync(output).length} production asset entries.`);
