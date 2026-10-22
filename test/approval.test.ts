import { describe, expect, it, vi } from "vitest";
import { github, releaseRoutes } from "./github";
import {
  ALICE,
  addMember,
  BOB,
  bootstrapAdmin,
  call,
  latestRequest,
  type Member,
  PUSHER,
  passkeyAction,
  pendingRequest,
  protectionRule,
  sendWebhook,
  setPolicy,
  signIn,
  vote,
} from "./helpers";

async function challenge(member: Member, id: string, action = "approve") {
  const response = await call(`/requests/${id}/challenge`, {
    cookie: member.cookie,
    body: { action },
  });
  return response.json<{ challengeId: string; options: { challenge: string } }>();
}

async function decide(member: Member, id: string, ceremony: Awaited<ReturnType<typeof challenge>>) {
  return call(`/requests/${id}/decision`, {
    cookie: member.cookie,
    body: {
      challengeId: ceremony.challengeId,
      response: await member.passkey.authenticate(ceremony.options),
    },
  });
}

it("approves through the callback after a passkey check", async () => {
  const admin = await bootstrapAdmin();
  const id = await pendingRequest();
  const response = await vote(admin, id, "approve");
  expect(await response.json()).toEqual({ redirect: `/requests/${id}` });
  expect(github.callbacks()).toEqual([
    { environment_name: "pypi", state: "approved", comment: "Approved by @admin via passkey" },
  ]);
  expect(await latestRequest()).toMatchObject({ status: "approved" });
});

it("rejects through the callback", async () => {
  const admin = await bootstrapAdmin();
  const id = await pendingRequest();
  await vote(admin, id, "reject");
  expect(github.callbacks()).toEqual([
    { environment_name: "pypi", state: "rejected", comment: "Rejected by @admin via passkey" },
  ]);
  const page = await (await call(`/requests/${id}`, { cookie: admin.cookie })).text();
  expect(page).toMatch(/@admin<\/strong> rejected/);
});

describe("challenge validation", () => {
  it("refuses an expired challenge", async () => {
    const admin = await bootstrapAdmin();
    const id = await pendingRequest();
    const ceremony = await challenge(admin, id);
    vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + 6 * 60 * 1000 });
    const response = await decide(admin, id, ceremony);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "This challenge has expired" });
    expect(github.callbacks()).toEqual([]);
  });

  it("refuses a reused challenge", async () => {
    const admin = await bootstrapAdmin();
    const id = await pendingRequest();
    const ceremony = await challenge(admin, id, "reject");
    const assertion = await admin.passkey.authenticate(ceremony.options);
    const body = { challengeId: ceremony.challengeId, response: assertion };
    expect((await call(`/requests/${id}/decision`, { cookie: admin.cookie, body })).status).toBe(
      200,
    );
    const replay = await call(`/requests/${id}/decision`, { cookie: admin.cookie, body });
    expect(replay.status).toBe(403);
    expect(await replay.json()).toEqual({ error: "Unknown or already used challenge" });
  });

  it("refuses a challenge issued for another request", async () => {
    const admin = await bootstrapAdmin();
    const first = await pendingRequest();
    await sendWebhook(protectionRule());
    const second = (await latestRequest()).id;
    const ceremony = await challenge(admin, first);
    const response = await decide(admin, second, ceremony);
    expect(await response.json()).toEqual({ error: "This challenge belongs to another request" });
    expect(github.callbacks()).toEqual([]);
  });

  it("refuses a challenge issued for another action", async () => {
    const admin = await bootstrapAdmin();
    const id = await pendingRequest();
    const ceremony = await call("/passkeys/challenge", { cookie: admin.cookie, body: {} });
    const response = await decide(admin, id, await ceremony.json());
    expect(await response.json()).toEqual({
      error: "This challenge was issued for another action",
    });
  });

  it("refuses a passkey that belongs to another user", async () => {
    const admin = await bootstrapAdmin();
    const alice = await addMember(admin, ALICE);
    const id = await pendingRequest();
    const ceremony = await challenge(admin, id);
    const response = await decide({ ...admin, passkey: alice.passkey }, id, ceremony);
    expect(await response.json()).toEqual({
      error: "This passkey is not registered to your account",
    });
  });

  it("refuses an invalid signature", async () => {
    const admin = await bootstrapAdmin();
    const id = await pendingRequest();
    const ceremony = await challenge(admin, id);
    const impostor = await admin.passkey.impostor();
    const response = await decide({ ...admin, passkey: impostor }, id, ceremony);
    expect(await response.json()).toEqual({ error: "Passkey check failed" });
  });

  it("refuses a signature counter that goes backwards", async () => {
    const admin = await bootstrapAdmin();
    const id = await pendingRequest();
    await vote(admin, id, "reject");
    const next = await pendingRequest();
    admin.passkey.counter = 0;
    const response = await vote(admin, next, "approve");
    expect(response.status).toBe(403);
    expect((await response.json<{ error: string }>()).error).toMatch(/counter/i);
  });

  it("refuses a request without an assertion", async () => {
    const admin = await bootstrapAdmin();
    const id = await pendingRequest();
    const response = await call(`/requests/${id}/decision`, {
      cookie: admin.cookie,
      body: { challengeId: "x" },
    });
    expect(response.status).toBe(400);
  });

  it("refuses an unknown action", async () => {
    const admin = await bootstrapAdmin();
    const id = await pendingRequest();
    const response = await call(`/requests/${id}/challenge`, {
      cookie: admin.cookie,
      body: { action: "x" },
    });
    expect(response.status).toBe(400);
  });
});

describe("approvers", () => {
  it("hides requests from non-approvers", async () => {
    await bootstrapAdmin();
    const id = await pendingRequest();
    const cookie = await signIn(BOB);
    const response = await call(`/requests/${id}/challenge`, {
      cookie,
      body: { action: "approve" },
    });
    expect(response.status).toBe(404);
    expect((await call(`/requests/${id}`, { cookie })).status).toBe(404);
  });

  it("allows one vote per user", async () => {
    const admin = await bootstrapAdmin();
    await setPolicy(admin, { min_approvals: "2" });
    const id = await pendingRequest();
    expect((await vote(admin, id, "approve")).status).toBe(200);
    const response = await vote(admin, id, "approve");
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "You already voted on this request" });
  });

  it("fires the callback only after the second distinct approval", async () => {
    const admin = await bootstrapAdmin();
    const alice = await addMember(admin, ALICE);
    await setPolicy(admin, { min_approvals: "2" });
    const id = await pendingRequest();
    await vote(admin, id, "approve");
    expect(github.callbacks()).toEqual([]);
    const page = await (await call(`/requests/${id}`, { cookie: alice.cookie })).text();
    expect(page).toContain("1 of 2 approvals");
    expect(await latestRequest()).toMatchObject({ status: "pending" });
    await vote(alice, id, "approve");
    expect(github.callbacks()).toEqual([
      {
        environment_name: "pypi",
        state: "approved",
        comment: "Approved by @admin, @alice via passkey",
      },
    ]);
  });

  it("refuses votes once the request is decided", async () => {
    const admin = await bootstrapAdmin();
    const alice = await addMember(admin, ALICE);
    const id = await pendingRequest();
    const late = await challenge(alice, id, "reject");
    await vote(admin, id, "approve");
    const response = await vote(alice, id, "reject");
    expect(await response.json()).toEqual({ error: "This request is no longer pending" });
    expect(await (await decide(alice, id, late)).json()).toEqual({
      error: "This request is no longer pending",
    });
  });

  it("sends one callback when approvals race", async () => {
    const admin = await bootstrapAdmin();
    const alice = await addMember(admin, ALICE);
    const id = await pendingRequest();
    const [a, b] = [await challenge(admin, id), await challenge(alice, id)];
    await Promise.all([decide(admin, id, a), decide(alice, id, b)]);
    expect(github.callbacks()).toHaveLength(1);
  });
});

describe("prevent_self_review", () => {
  it("stops the tag pusher from approving", async () => {
    const admin = await bootstrapAdmin();
    const pusher = await addMember(admin, PUSHER);
    const id = await pendingRequest();
    const response = await vote(pusher, id, "approve");
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "You started this deployment and self-review is prevented",
    });
  });

  it("stops whoever re-ran the workflow from approving", async () => {
    const admin = await bootstrapAdmin();
    const alice = await addMember(admin, ALICE);
    const id = await pendingRequest({ initiators: [PUSHER.id, ALICE.id] });
    expect((await vote(alice, id, "approve")).status).toBe(403);
  });

  it("still lets the initiator reject", async () => {
    const admin = await bootstrapAdmin();
    const pusher = await addMember(admin, PUSHER);
    const id = await pendingRequest();
    expect((await vote(pusher, id, "reject")).status).toBe(200);
  });

  it("allows self-approval when the policy turns it off", async () => {
    const admin = await bootstrapAdmin();
    const pusher = await addMember(admin, PUSHER);
    await setPolicy(admin, { prevent_self_review: "0" });
    const id = await pendingRequest();
    expect((await vote(pusher, id, "approve")).status).toBe(200);
    expect(github.callbacks()[0]?.state).toBe("approved");
  });
});

describe("failed callbacks", () => {
  it("leaves the request in error until an admin retries", async () => {
    const admin = await bootstrapAdmin();
    const id = await pendingRequest({ callbackStatus: 500 });
    await vote(admin, id, "approve");
    expect(await latestRequest()).toMatchObject({ status: "error", decision: "approved" });

    releaseRoutes();
    const retry = (m: Member) =>
      passkeyAction(m, `/requests/${id}/challenge`, `/requests/${id}/retry-callback`, {
        action: "retry",
      });
    const alice = await addMember(admin, ALICE);
    expect((await retry(alice)).status).toBe(403);

    expect((await retry(admin)).status).toBe(200);
    expect(await latestRequest()).toMatchObject({ status: "approved" });
    expect(github.callbacks().map((c) => c.state)).toEqual(["approved", "approved"]);
    expect((await retry(admin)).status).toBe(409);
  });

  it("runs only one of two concurrent retries", async () => {
    const admin = await bootstrapAdmin();
    const id = await pendingRequest({ callbackStatus: 500 });
    await vote(admin, id, "approve");
    releaseRoutes();
    const ceremonies = [await challenge(admin, id, "retry"), await challenge(admin, id, "retry")];
    const responses = await Promise.all(
      ceremonies.map(async (ceremony) =>
        call(`/requests/${id}/retry-callback`, {
          cookie: admin.cookie,
          body: {
            challengeId: ceremony.challengeId,
            response: await admin.passkey.authenticate(ceremony.options),
          },
        }),
      ),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(github.callbacks().map((c) => c.state)).toEqual(["approved", "approved"]);
  });

  it("records a failed installation token request as an error", async () => {
    const admin = await bootstrapAdmin();
    const id = await pendingRequest();
    github.on(
      "POST",
      "https://api.github.com/app/installations/7/access_tokens",
      () => new Response(null, { status: 500 }),
    );
    await vote(admin, id, "approve");
    expect(await latestRequest()).toMatchObject({ status: "error" });
  });
});
