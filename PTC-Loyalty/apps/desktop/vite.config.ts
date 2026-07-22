import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Renderer (React) build config. Output goes to dist/ and is loaded by Electron
// from the file system in production, or from the dev server in development.
export default defineConfig({
  root: __dirname,
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Shared, type-only POS API contract from the webapp. Imported with
      // `import type` so it is erased at build time (no server code is pulled in).
      "@shared": fileURLToPath(new URL("../../src/lib/pos", import.meta.url)),
    },
  },
  server: { port: 5173, strictPort: true },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "chrome128",
  },
});
