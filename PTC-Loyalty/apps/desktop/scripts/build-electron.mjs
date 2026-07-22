// Bundles the Electron main & preload processes with esbuild (CommonJS).
// `electron` and native/updater deps stay external so electron-builder packs
// them from node_modules.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const app = resolve(root, "..");

const shared = {
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  sourcemap: true,
  external: ["electron", "electron-updater"],
  logLevel: "info",
};

await Promise.all([
  build({
    ...shared,
    entryPoints: [resolve(app, "electron/main.ts")],
    outfile: resolve(app, "dist-electron/main.js"),
  }),
  build({
    ...shared,
    entryPoints: [resolve(app, "electron/preload.ts")],
    outfile: resolve(app, "dist-electron/preload.js"),
  }),
]);

console.log("[build-electron] main.js + preload.js written to dist-electron/");
