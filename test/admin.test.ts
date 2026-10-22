import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { API, github, REPO, releaseRoutes, SHA } from "./github";
import {
  ADMIN,
  ALICE,
  addMember,
  BOB,
  call,
  latestRequest,
  passkeyAction,
  pendingRequest,
  protectionRule,
  sendWebhook,
  setPolicy,
  setUpAdmin,
  signIn,
  vote,
} from "./helpers";

const admin_ = (path: string) => [`/admin/${REPO}/challenge`, `/admin/${REPO}${path}`] as const;

it("requires a passkey to change the policy", async () => {
  const admin = await setUpAdmin();
  const unsigned = await call(`/admin/${REPO}/policy`, {
    cookie: admin.cookie,
    body: { min_approvals: "3" },
  });
  expect(unsigned.status).toBe(400);
  const response = await passkeyAction(admin, ...admin_("/policy"), {
    min_approvals: "3",
    require_default_branch: "1",
  });
  expect(response.status).toBe(200);
  const page = await (await call(`/admin/${REPO}`, { cookie: admin.cookie })).text();
  expect(page).toContain('value="3"');
  expect(page).not.toMatch(/name="prevent_self_review" value="1" checked/);
});

it.each(["0", "11", "two"])("refuses min_approvals of %s", async (value) => {
  const admin = await setUpAdmin();
  const response = await passkeyAction(admin, ...admin_("/policy"), { min_approvals: value });
  expect(response.status).toBe(400);
});

it("refuses an invalid invite login", async () => {
  const admin = await setUpAdmin();
  const response = await passkeyAction(admin, ...admin_("/invites"), { login: "../evil" });
  expect(await response.json()).toEqual({ error: "Invalid GitHub login" });
});

it("removes approvers", async () => {
  const admin = await setUpAdmin();
  const alice = await addMember(admin, ALICE);
  const page = await (await call(`/admin/${REPO}`, { cookie: admin.cookie })).text();
  expect(page).toContain("@alice");
  const response = await passkeyAction(admin, ...admin_("/approvers/remove"), { user_id: "2" });
  expect(response.status).toBe(200);
  const id = await pendingRequest();
  expect((await vote(alice, id, "approve")).status).toBe(404);
  const again = await passkeyAction(admin, ...admin_("/approvers/remove"), { user_id: "2" });
  expect(again.status).toBe(404);
});

it("hides admin pages from approvers and strangers", async () => {
  const admin = await setUpAdmin();
  const alice = await addMember(admin, ALICE);
  expect((await call(`/admin/${REPO}`, { cookie: alice.cookie })).status).toBe(404);
  expect((await call(`/admin/${REPO}/challenge`, { cookie: alice.cookie, body: {} })).status).toBe(
    404,
  );
  expect((await call("/admin/acme/other", { cookie: admin.cookie })).status).toBe(404);
});

it("lets an invited admin manage the repository", async () => {
  const admin = await setUpAdmin();
  const bob = await addMember(admin, BOB, "admin");
  expect((await call(`/admin/${REPO}`, { cookie: bob.cookie })).status).toBe(200);
});

it("shows the audit log to admins", async () => {
  const admin = await setUpAdmin();
  const id = await pendingRequest();
  await vote(admin, id, "approve");
  const page = await (await call("/audit", { cookie: admin.cookie })).text();
  for (const action of ["repo.claimed", "request.received", "request.pending", "vote.approve"]) {
    expect(page).toContain(action);
  }
  expect(page).toContain("callback.delivered");
  const empty = await (await call("/audit", { cookie: await signIn(BOB) })).text();
  expect(empty).toContain("No entries.");
});

it("lists requests and shows their details", async () => {
  const admin = await setUpAdmin();
  const id = await pendingRequest();
  const home = await (await call("/releases", { cookie: admin.cookie })).text();
  expect(home).toContain(`/requests/${id}`);

  const detail = await (await call(`/requests/${id}`, { cookie: admin.cookie })).text();
  expect(detail).toContain(`https://github.com/${REPO}/compare/v0.9.0...v1.0.0`);
  expect(detail).toContain(`https://github.com/${REPO}/actions/runs/42`);
  expect(detail).toContain("@pusher");
  expect(detail).toContain("Approve with passkey");

  await vote(admin, id, "approve");
  const decided = await (await call(`/requests/${id}`, { cookie: admin.cookie })).text();
  expect(decided).toContain("Approved by @admin via passkey");
  expect(decided).not.toContain("Approve with passkey");
});

it("shows why an initiator cannot approve", async () => {
  const admin = await setUpAdmin();
  const pusher = await addMember(admin, { id: 100, login: "pusher" });
  const id = await pendingRequest();
  const detail = await (await call(`/requests/${id}`, { cookie: pusher.cookie })).text();
  expect(detail).toContain("self-review is prevented");
  expect(detail).not.toContain("Approve with passkey");
});

it("offers a retry to admins when the callback failed", async () => {
  const admin = await setUpAdmin();
  const id = await pendingRequest({ callbackStatus: 500 });
  await vote(admin, id, "approve");
  const detail = await (await call(`/requests/${id}`, { cookie: admin.cookie })).text();
  expect(detail).toContain("Retry sending &quot;approved&quot; to GitHub");
});

it("still renders a request when the tag list is unavailable", async () => {
  const admin = await setUpAdmin();
  const id = await pendingRequest();
  github.on(
    "GET",
    `${API}/repos/${REPO}/tags?per_page=100`,
    () => new Response(null, { status: 500 }),
  );
  const detail = await (await call(`/requests/${id}`, { cookie: admin.cookie })).text();
  expect(detail).toContain("No previous tag found");
});

it("tells users without repositories how to join", async () => {
  const page = await (await call("/releases", { cookie: await signIn(BOB) })).text();
  expect(page).toContain("You are not an approver for any repository");
});

it("lists open invites", async () => {
  const admin = await setUpAdmin();
  await passkeyAction(admin, ...admin_("/invites"), { login: "carol", role: "admin" });
  const page = await (await call(`/admin/${REPO}`, { cookie: admin.cookie })).text();
  expect(page).toContain("@carol (admin)");
});

it("renders requests for refs that are not tags", async () => {
  const admin = await setUpAdmin();
  releaseRoutes();
  await sendWebhook(protectionRule({ deployment: { ref: "refs/heads/main", sha: SHA } }));
  const { id } = await latestRequest();
  const detail = await (await call(`/requests/${id}`, { cookie: admin.cookie })).text();
  expect(detail).toContain("No previous tag found");
  expect(detail).toContain("is not a tag");
});

it.each([
  ["missing from", [{ name: "v2.0.0" }]],
  ["the oldest in", [{ name: "v1.0.0" }]],
])("finds no previous tag when the tag is %s the list", async (_, tags) => {
  const admin = await setUpAdmin();
  const id = await pendingRequest();
  github.on("GET", `${API}/repos/${REPO}/tags?per_page=100`, tags);
  const detail = await (await call(`/requests/${id}`, { cookie: admin.cookie })).text();
  expect(detail).toContain("No previous tag found");
});

it("keeps the last admin", async () => {
  const admin = await setUpAdmin();
  const page = await (await call(`/admin/${REPO}`, { cookie: admin.cookie })).text();
  expect(page).toContain("last admin");
  const response = await passkeyAction(admin, ...admin_("/approvers/remove"), { user_id: "1" });
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({
    error: "Add another admin before removing the last one",
  });
  expect((await call(`/admin/${REPO}`, { cookie: admin.cookie })).status).toBe(200);
});

it("lets an admin step down once another admin exists", async () => {
  const admin = await setUpAdmin();
  const bob = await addMember(admin, BOB, "admin");
  const page = await (await call(`/admin/${REPO}`, { cookie: admin.cookie })).text();
  expect(page).not.toContain("last admin");
  const response = await passkeyAction(admin, ...admin_("/approvers/remove"), { user_id: "1" });
  expect(response.status).toBe(200);
  expect((await call(`/admin/${REPO}`, { cookie: admin.cookie })).status).toBe(404);
  const left = await passkeyAction(bob, ...admin_("/approvers/remove"), { user_id: "3" });
  expect(left.status).toBe(409);
});

it("never demotes an admin through an invite", async () => {
  const admin = await setUpAdmin();
  const bob = await addMember(admin, BOB, "admin");
  await addMember(bob, ADMIN);
  expect((await call(`/admin/${REPO}`, { cookie: admin.cookie })).status).toBe(200);
});

describe("notifications", () => {
  const SLACK = "https://hooks.slack.com/services/T0/B0/secret";
  const DISCORD = "https://discord.com/api/webhooks/1/secret-token";
  const ADMIN_PAGE = `https://gate.test/admin/${REPO}`;

  /** Accepts posts to `url` with `status`, and returns a reader for what was posted. */
  function hook(url: string, status = 204): () => Record<string, unknown>[] {
    github.on("POST", url, () => new Response(null, { status }));
    return () => github.calls.filter((c) => c.url === url).map((c) => JSON.parse(c.body));
  }

  it("posts releases to Slack", async () => {
    const admin = await setUpAdmin();
    const posts = hook(SLACK);
    await setPolicy(admin, { notify_url: SLACK });
    const id = await pendingRequest();
    await vote(admin, id, "approve");
    await setPolicy(admin, { notify_url: SLACK });
    expect(posts().map((post) => post.text)).toEqual([
      `${REPO}: release-gate will post here.\n${ADMIN_PAGE}`,
      `${REPO}: @admin changed the policy.\n${ADMIN_PAGE}`,
      `${REPO}: v1.0.0 to pypi is waiting for approval. Started by @pusher.\nhttps://gate.test/requests/${id}`,
      `${REPO}: v1.0.0 to pypi - Approved by @admin via passkey.\nhttps://gate.test/requests/${id}`,
      `${REPO}: @admin changed the policy.\n${ADMIN_PAGE}`,
    ]);
    const page = await (await call(`/admin/${REPO}`, { cookie: admin.cookie })).text();
    expect(page).toContain(`value="${SLACK}"`);
  });

  it("keeps names from rendering as Slack mentions", async () => {
    const admin = await setUpAdmin();
    const posts = hook(SLACK);
    await setPolicy(admin, { notify_url: SLACK });
    releaseRoutes();
    await sendWebhook(protectionRule({ environment: "<!here> & co" }));
    expect(posts().at(-1)?.text).toContain("v1.0.0 to &lt;!here&gt; &amp; co is waiting");
  });

  it("posts rejections and failed callbacks to Discord without pinging anyone", async () => {
    const admin = await setUpAdmin();
    const posts = hook(DISCORD);
    await setPolicy(admin, { notify_url: DISCORD });
    releaseRoutes();
    await sendWebhook(protectionRule({ deployment: { ref: "refs/heads/main", sha: SHA } }));
    const rejected = await latestRequest();
    const id = await pendingRequest({ callbackStatus: 500 });
    await vote(admin, id, "approve");
    expect(posts().slice(2)).toEqual([
      {
        content: `${REPO}: refs/heads/main to pypi - Rejected by release-gate: \\\`refs/heads/main\\\` is not a tag.\nhttps://gate.test/requests/${rejected.id}`,
        allowed_mentions: { parse: [] },
      },
      {
        content: `${REPO}: v1.0.0 to pypi is waiting for approval. Started by @pusher.\nhttps://gate.test/requests/${id}`,
        allowed_mentions: { parse: [] },
      },
      {
        content: `${REPO}: v1.0.0 to pypi was approved, but GitHub did not get the decision. An admin can retry it.\nhttps://gate.test/requests/${id}`,
        allowed_mentions: { parse: [] },
      },
    ]);
  });

  it("posts changes to who can approve", async () => {
    const admin = await setUpAdmin();
    const posts = hook(SLACK);
    await setPolicy(admin, { notify_url: SLACK });
    await addMember(admin, ALICE);
    await passkeyAction(admin, ...admin_("/approvers/remove"), { user_id: "2" });
    expect(posts().map((post) => post.text)).toEqual([
      expect.any(String),
      expect.any(String),
      `${REPO}: @admin invited @alice as approver.\n${ADMIN_PAGE}`,
      `${REPO}: @alice joined as approver.\n${ADMIN_PAGE}`,
      `${REPO}: @admin removed an approver.\n${ADMIN_PAGE}`,
    ]);
  });

  it("refuses a webhook URL that is not Slack or Discord, or that fails a test message", async () => {
    const admin = await setUpAdmin();
    const other = await passkeyAction(admin, ...admin_("/policy"), {
      min_approvals: "1",
      notify_url: "https://evil.test/hook",
    });
    expect(await other.json()).toEqual({ error: "Enter a Slack or Discord webhook URL" });
    hook(SLACK, 404);
    const refused = await passkeyAction(admin, ...admin_("/policy"), {
      min_approvals: "1",
      notify_url: SLACK,
    });
    expect(await refused.json()).toEqual({
      error: "The webhook refused a test message: the webhook returned HTTP 404",
    });
    const page = await (await call(`/admin/${REPO}`, { cookie: admin.cookie })).text();
    expect(page).toContain('name="notify_url" value=""');
  });

  it("keeps releasing when the webhook is down, and stops posting once cleared", async () => {
    const admin = await setUpAdmin();
    const posts = hook(SLACK);
    await setPolicy(admin, { notify_url: SLACK });
    hook(SLACK, 500);
    await pendingRequest();
    const failed = await env.DB.prepare(
      "SELECT details_json FROM audit_log WHERE action = 'notification.failed'",
    ).first<{ details_json: string }>();
    expect(failed?.details_json).toContain("HTTP 500");
    await setPolicy(admin, { notify_url: "" });
    expect(posts()).toHaveLength(3);
  });
});
