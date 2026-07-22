import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      QR_SIGNING_SECRET: "test-secret-please-change-me-1234567890",
      // 32-byte base64 key for AES-256-GCM tests.
      ENCRYPTION_KEY: "Q7rdZJL1zTVSfsRddR8rBYfhbhBMD9NRvFPbGE+k7og=",
    },
  },
});
