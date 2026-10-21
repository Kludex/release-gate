import { generateKeyPairSync } from "node:crypto";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

export default defineConfig(async () => ({
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  plugins: [
    cloudflareTest({
      main: "./src/index.ts",
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations("./migrations"),
          PUBLIC_ORIGIN: "https://gate.test",
          BOOTSTRAP_REPOS: "acme/widgets",
          GITHUB_APP_ID: "1234",
          GITHUB_APP_PRIVATE_KEY: privateKey,
          GITHUB_WEBHOOK_SECRET: "webhook-secret",
          GITHUB_CLIENT_ID: "client-id",
          GITHUB_CLIENT_SECRET: "client-secret",
          SESSION_SECRET: "session-secret",
          BOOTSTRAP_CODE: "bootstrap-code",
        },
      },
    }),
  ],
  test: {
    include: ["test/**/*.test.ts"],
    setupFiles: ["./test/setup.ts"],
    coverage: {
      provider: "istanbul",
      include: ["src/**"],
      // Runs in the browser; covered by the sandbox end-to-end check.
      exclude: ["src/client/**"],
      thresholds: { 100: true },
    },
  },
}));
