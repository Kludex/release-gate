import { describe, expect, it, vi } from "vitest";
import { API, CALLBACK_URL, github, REPO, releaseRoutes, SHA } from "./github";
import { bootstrapAdmin, latestRequest, protectionRule, sendWebhook, setPolicy } from "./helpers";

describe("signature", () => {
  it("accepts a valid signature and stores a pending request", async () => {
    await bootstrapAdmin();
    releaseRoutes();
    const response = await sendWebhook(protectionRule());
    expect(response.status).toBe(200);
    expect(await latestRequest()).toMatchObject({ status: "pending", ref: "v1.0.0" });
  });

  it.each([
    ["invalid", "sha256=deadbeef"],
    ["missing", null],
  ])("rejects a %s signature with 401", async (_, signature) => {
    const response = await sendWebhook(protectionRule(), { signature });
    expect(response.status).toBe(401);
    expect(github.calls).toEqual([]);
    expect(await latestRequest()).toBeNull();
  });
});

it("fails loudly on a signed body that is not JSON", async () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const response = await sendWebhook("not json");
  expect(response.status).toBe(500);
  expect(errors).toHaveBeenCalledOnce();
});

it("ignores other events", async () => {
  const response = await sendWebhook({ zen: "Keep it logically awesome." }, { event: "ping" });
  expect(await response.text()).toBe("Ignored");
});

it("treats a duplicate delivery as a no-op", async () => {
  await bootstrapAdmin();
  releaseRoutes();
  await sendWebhook(protectionRule(), { delivery: "delivery-1" });
  const callsAfterFirst = github.calls.length;
  const response = await sendWebhook(protectionRule(), { delivery: "delivery-1" });
  expect(await response.text()).toBe("Duplicate delivery");
  expect(github.calls.length).toBe(callsAfterFirst);
});

describe("callback URL validation", () => {
  it.each([
    ["host", `https://evil.test/repos/${REPO}/actions/runs/42/deployment_protection_rule`],
    ["repo", `${API}/repos/acme/other/actions/runs/42/deployment_protection_rule`],
    ["path", `${API}/repos/${REPO}/actions/runs/42/deployment_protection_rule/../../x`],
    ["run id", `${API}/repos/${REPO}/actions/runs/abc/deployment_protection_rule`],
  ])("rejects a wrong %s without any outgoing call", async (_, url) => {
    const response = await sendWebhook(protectionRule({ deployment_callback_url: url }));
    expect(response.status).toBe(400);
    expect(github.calls).toEqual([]);
    expect(await latestRequest()).toBeNull();
  });

  it("rejects a payload without a deployment", async () => {
    const response = await sendWebhook(protectionRule({ deployment: undefined }));
    expect(response.status).toBe(400);
  });
});

describe("auto-reject policy", () => {
  it.each([
    ["a branch ref", "refs/heads/main", "`refs/heads/main` is not a tag"],
    ["an empty ref", "", "`` is not a tag"],
  ])("rejects %s", async (_, ref, reason) => {
    await bootstrapAdmin();
    releaseRoutes();
    await sendWebhook(protectionRule({ deployment: { ref, sha: SHA } }));
    expect(github.callbacks()).toEqual([
      {
        environment_name: "pypi",
        state: "rejected",
        comment: `Rejected by release-gate: ${reason}`,
      },
    ]);
    expect(await latestRequest()).toMatchObject({ status: "rejected", decision: "rejected" });
  });

  it("rejects a short ref that is not a tag", async () => {
    await bootstrapAdmin();
    releaseRoutes();
    github.on(
      "GET",
      `${API}/repos/${REPO}/git/ref/tags/main`,
      () => new Response(null, { status: 404 }),
    );
    await sendWebhook(protectionRule({ deployment: { ref: "main", sha: SHA } }));
    expect(github.callbacks()[0]?.comment).toBe("Rejected by release-gate: `main` is not a tag");
  });

  it("rejects a tag that points to another commit", async () => {
    await bootstrapAdmin();
    releaseRoutes();
    github.on("GET", `${API}/repos/${REPO}/git/ref/tags/v1.0.0`, {
      object: { type: "commit", sha: "b".repeat(40) },
    });
    await sendWebhook(protectionRule());
    expect(github.callbacks()[0]?.comment).toContain(`points to ${"b".repeat(40)}, not ${SHA}`);
  });

  it("follows annotated tags to their commit", async () => {
    await bootstrapAdmin();
    releaseRoutes();
    github.on("GET", `${API}/repos/${REPO}/git/ref/tags/v1.0.0`, {
      object: { type: "tag", sha: "c".repeat(40) },
    });
    github.on("GET", `${API}/repos/${REPO}/git/tags/${"c".repeat(40)}`, {
      object: { type: "commit", sha: SHA },
    });
    await sendWebhook(protectionRule({ deployment: { ref: "refs/tags/v1.0.0", sha: SHA } }));
    expect(await latestRequest()).toMatchObject({ status: "pending" });
  });

  it("rejects a commit that is not on the default branch", async () => {
    await bootstrapAdmin();
    releaseRoutes();
    github.on("GET", `${API}/repos/${REPO}/compare/main...${SHA}?per_page=1`, {
      status: "diverged",
    });
    await sendWebhook(protectionRule());
    expect(github.callbacks()).toEqual([
      {
        environment_name: "pypi",
        state: "rejected",
        comment: `Rejected by release-gate: ${SHA} is not on the default branch \`main\``,
      },
    ]);
  });

  it("accepts other commits when the default branch is not required", async () => {
    const admin = await bootstrapAdmin();
    await setPolicy(admin, { require_default_branch: "0" });
    releaseRoutes();
    github.on("GET", `${API}/repos/${REPO}/compare/main...${SHA}?per_page=1`, {
      status: "diverged",
    });
    await sendWebhook(protectionRule());
    expect(await latestRequest()).toMatchObject({ status: "pending" });
  });

  it("rejects repositories that are not configured", async () => {
    releaseRoutes();
    await sendWebhook(protectionRule());
    expect(github.callbacks()[0]?.comment).toBe(
      "Rejected by release-gate: this repository is not configured on this release-gate instance",
    );
  });

  it("rejects when GitHub cannot be reached during the checks", async () => {
    await bootstrapAdmin();
    releaseRoutes();
    github.on(
      "GET",
      `${API}/repos/${REPO}/git/ref/tags/v1.0.0`,
      () => new Response(null, { status: 502 }),
    );
    await sendWebhook(protectionRule());
    expect(github.callbacks()[0]?.comment).toBe(
      "Rejected by release-gate: could not verify the request (Error: Tag lookup failed with HTTP 502)",
    );
  });

  it("marks the request as error when the rejection cannot be delivered", async () => {
    releaseRoutes({ callbackStatus: 500 });
    await sendWebhook(protectionRule());
    expect(await latestRequest()).toMatchObject({ status: "error", decision: "rejected" });
  });

  it("requests a token scoped to the repository", async () => {
    releaseRoutes();
    await sendWebhook(protectionRule());
    const tokenCall = github.calls.find((c) => c.url.endsWith("/access_tokens"));
    expect(JSON.parse(tokenCall?.body ?? "")).toEqual({ repositories: ["widgets"] });
    expect(github.calls.find((c) => c.url === CALLBACK_URL)).toBeDefined();
  });
});
