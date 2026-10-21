import { expect, it } from "vitest";
import { API, github, REPO, releaseRoutes, SHA } from "./github";
import {
  ALICE,
  addMember,
  BOB,
  bootstrapAdmin,
  call,
  latestRequest,
  passkeyAction,
  pendingRequest,
  protectionRule,
  sendWebhook,
  signIn,
  vote,
} from "./helpers";

const admin_ = (path: string) => [`/admin/${REPO}/challenge`, `/admin/${REPO}${path}`] as const;

it("requires a passkey to change the policy", async () => {
  const admin = await bootstrapAdmin();
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
  const admin = await bootstrapAdmin();
  const response = await passkeyAction(admin, ...admin_("/policy"), { min_approvals: value });
  expect(response.status).toBe(400);
});

it("refuses an invalid invite login", async () => {
  const admin = await bootstrapAdmin();
  const response = await passkeyAction(admin, ...admin_("/invites"), { login: "../evil" });
  expect(await response.json()).toEqual({ error: "Invalid GitHub login" });
});

it("removes approvers", async () => {
  const admin = await bootstrapAdmin();
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
  const admin = await bootstrapAdmin();
  const alice = await addMember(admin, ALICE);
  expect((await call(`/admin/${REPO}`, { cookie: alice.cookie })).status).toBe(404);
  expect((await call(`/admin/${REPO}/challenge`, { cookie: alice.cookie, body: {} })).status).toBe(
    404,
  );
  expect((await call("/admin/acme/other", { cookie: admin.cookie })).status).toBe(404);
});

it("lets an invited admin manage the repository", async () => {
  const admin = await bootstrapAdmin();
  const bob = await addMember(admin, BOB, "admin");
  expect((await call(`/admin/${REPO}`, { cookie: bob.cookie })).status).toBe(200);
});

it("shows the audit log to admins", async () => {
  const admin = await bootstrapAdmin();
  const id = await pendingRequest();
  await vote(admin, id, "approve");
  const page = await (await call("/audit", { cookie: admin.cookie })).text();
  for (const action of ["bootstrap.used", "request.received", "request.pending", "vote.approve"]) {
    expect(page).toContain(action);
  }
  expect(page).toContain("callback.delivered");
  const empty = await (await call("/audit", { cookie: await signIn(BOB) })).text();
  expect(empty).toContain("No entries.");
});

it("lists requests and shows their details", async () => {
  const admin = await bootstrapAdmin();
  const id = await pendingRequest();
  const home = await (await call("/", { cookie: admin.cookie })).text();
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
  const admin = await bootstrapAdmin();
  const pusher = await addMember(admin, { id: 100, login: "pusher" });
  const id = await pendingRequest();
  const detail = await (await call(`/requests/${id}`, { cookie: pusher.cookie })).text();
  expect(detail).toContain("self-review is prevented");
  expect(detail).not.toContain("Approve with passkey");
});

it("offers a retry to admins when the callback failed", async () => {
  const admin = await bootstrapAdmin();
  const id = await pendingRequest({ callbackStatus: 500 });
  await vote(admin, id, "approve");
  const detail = await (await call(`/requests/${id}`, { cookie: admin.cookie })).text();
  expect(detail).toContain("Retry sending &quot;approved&quot; to GitHub");
});

it("still renders a request when the tag list is unavailable", async () => {
  const admin = await bootstrapAdmin();
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
  const page = await (await call("/", { cookie: await signIn(BOB) })).text();
  expect(page).toContain("You are not an approver for any repository");
});

it("lists open invites", async () => {
  const admin = await bootstrapAdmin();
  await passkeyAction(admin, ...admin_("/invites"), { login: "carol", role: "admin" });
  const page = await (await call(`/admin/${REPO}`, { cookie: admin.cookie })).text();
  expect(page).toContain("@carol (admin)");
});

it("renders requests for refs that are not tags", async () => {
  const admin = await bootstrapAdmin();
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
  const admin = await bootstrapAdmin();
  const id = await pendingRequest();
  github.on("GET", `${API}/repos/${REPO}/tags?per_page=100`, tags);
  const detail = await (await call(`/requests/${id}`, { cookie: admin.cookie })).text();
  expect(detail).toContain("No previous tag found");
});
