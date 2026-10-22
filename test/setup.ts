import { applyD1Migrations, env } from "cloudflare:test";
import { afterEach, beforeEach, vi } from "vitest";
import { github } from "./github";

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

const TABLES = [
  "installations",
  "repo_policies",
  "approvers",
  "credentials",
  "approval_requests",
  "approval_votes",
  "challenges",
  "invites",
  "audit_log",
  "user_repos",
];

beforeEach(async () => {
  await env.DB.batch(TABLES.map((table) => env.DB.prepare(`DELETE FROM ${table}`)));
  github.reset();
  vi.spyOn(globalThis, "fetch").mockImplementation(github.fetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
