import { describe, expect, it, vi } from "vitest";
import type { User } from "@/env";
import { Authenticator } from "./authenticator";
import { API, claimRoutes, github, REPO } from "./github";
import type { Ceremony, Member } from "./helpers";
import {
  ADMIN,
  ALICE,
  addMember,
  BOB,
  call,
  createInvite,
  enroll,
  passkeyAction,
  pendingRequest,
  register,
  setUpAdmin,
  signIn,
  vote,
} from "./helpers";

describe("setting up a repository", () => {
  const attempt = async (user: User, repo = REPO) =>
    call("/repos", { cookie: await signIn(user), body: { repo } });

  it("makes a GitHub admin of the repository its first admin", async () => {
    const admin = await setUpAdmin();
    const page = await call("/admin/acme/widgets", { cookie: admin.cookie });
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("@admin");
    expect(await (await call("/passkeys", { cookie: admin.cookie })).text()).toContain("Test key");
  });

  it("registers a first passkey or confirms with an existing one", async () => {
    const admin = await setUpAdmin();
    claimRoutes(ADMIN, "acme/other");
    const bare = await call("/repos", { cookie: admin.cookie, body: { repo: "acme/other" } });
    expect(bare.status).toBe(400);
    const confirmed = await passkeyAction(admin, "/repos/challenge", "/repos", {
      repo: "acme/other",
    });
    expect(await confirmed.json()).toEqual({ redirect: "/admin/acme/other" });
  });

  it("stores the repository with GitHub's casing", async () => {
    claimRoutes(ADMIN);
    github.on("GET", `${API}/repos/ACME/Widgets/installation`, { id: 7 });
    github.on("GET", `${API}/repos/ACME/Widgets`, { full_name: REPO });
    const member = {
      user: ADMIN,
      cookie: await signIn(ADMIN),
      passkey: await Authenticator.create(),
    };
    const response = await call("/repos", {
      cookie: member.cookie,
      body: { repo: "ACME/Widgets" },
    });
    const { registration } = await response.json<{ registration: Ceremony }>();
    expect(await (await register(member, registration)).json()).toEqual({
      redirect: "/admin/acme/widgets",
    });
  });

  const NOT_ADMIN = "Only admins of the repository on GitHub can set it up";
  const permission = (body: unknown) =>
    github.on("GET", `${API}/repos/${REPO}/collaborators/bob/permission`, body);

  it.each<[string, () => void, number, string]>([
    [
      "the app is not installed",
      () =>
        github.on(
          "GET",
          `${API}/repos/${REPO}/installation`,
          () => new Response(null, { status: 404 }),
        ),
      404,
      "Install the release-gate app on this repository first",
    ],
    [
      "the user can only write",
      () => permission({ permission: "write", user: { id: 3 } }),
      403,
      NOT_ADMIN,
    ],
    [
      "GitHub names another user",
      () => permission({ permission: "admin", user: { id: 9 } }),
      403,
      NOT_ADMIN,
    ],
    ["GitHub names no user", () => permission({ permission: "admin", user: null }), 403, NOT_ADMIN],
    [
      "the user is not a collaborator",
      () => permission(() => new Response(null, { status: 404 })),
      403,
      NOT_ADMIN,
    ],
  ])("refuses when %s", async (_, override, status, error) => {
    claimRoutes(BOB);
    override();
    const response = await attempt(BOB);
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error });
  });

  it("refuses a repository that is already set up", async () => {
    await setUpAdmin();
    claimRoutes(BOB);
    const response = await attempt(BOB);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "This repository is already set up. Ask one of its admins for an invite",
    });
  });

  it("refuses a malformed name and a GitHub outage", async () => {
    const typo = await attempt(BOB, "starlette");
    expect(await typo.json()).toEqual({ error: "Enter the repository as owner/name" });
    github.on(
      "GET",
      `${API}/repos/${REPO}/installation`,
      () => new Response(null, { status: 502 }),
    );
    expect((await attempt(BOB)).status).toBe(500);
  });

  it("checks the claim again when the passkey is registered", async () => {
    claimRoutes(BOB);
    const bob = { user: BOB, cookie: await signIn(BOB), passkey: await Authenticator.create() };
    const response = await call("/repos", { cookie: bob.cookie, body: { repo: REPO } });
    const { registration } = await response.json<{ registration: Ceremony }>();
    await setUpAdmin();
    expect((await register(bob, registration)).status).toBe(409);
  });

  it("never adds a second passkey through a claim", async () => {
    claimRoutes(ADMIN);
    claimRoutes(ADMIN, "acme/other");
    const cookie = await signIn(ADMIN);
    const start = async (repo: string) => {
      const response = await call("/repos", { cookie, body: { repo } });
      return (await response.json<{ registration: Ceremony }>()).registration;
    };
    const [first, second] = [await start(REPO), await start("acme/other")];
    const member = (passkey: Authenticator) => ({ user: ADMIN, cookie, passkey });
    expect((await register(member(await Authenticator.create()), first)).status).toBe(200);
    const late = await register(member(await Authenticator.create()), second);
    expect(late.status).toBe(409);
    expect(await late.json()).toEqual({ error: "You already have a passkey" });
  });
});

it("accepts an invite once", async () => {
  const admin = await setUpAdmin();
  const code = await createInvite(admin, "alice");
  const alice = await enroll(ALICE, "/invite", code);
  const id = await pendingRequest();
  expect((await vote(alice, id, "approve")).status).toBe(200);
  const again = await call("/invite", { cookie: alice.cookie, body: { code } });
  expect(await again.json()).toEqual({ error: "Invalid or expired invite code" });
});

it("refuses an invite for another login", async () => {
  const admin = await setUpAdmin();
  const code = await createInvite(admin, "alice");
  const response = await call("/invite", { cookie: await signIn(BOB), body: { code } });
  expect(response.status).toBe(403);
});

it("refuses an expired invite", async () => {
  const admin = await setUpAdmin();
  const code = await createInvite(admin, "@alice", "admin");
  vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + 25 * 60 * 60 * 1000 });
  const cookie = await signIn(ALICE);
  const response = await call("/invite", { cookie, body: { code } });
  expect(await response.json()).toEqual({ error: "Invalid or expired invite code" });
});

it("consumes the invite when the passkey is registered", async () => {
  const admin = await setUpAdmin();
  const code = await createInvite(admin, "alice");
  const alice = { user: ALICE, cookie: await signIn(ALICE), passkey: await Authenticator.create() };
  const start = async () => {
    const response = await call("/invite", { cookie: alice.cookie, body: { code } });
    return (await response.json<{ registration: Ceremony }>()).registration;
  };
  const [first, second] = [await start(), await start()];
  expect((await register(alice, first)).status).toBe(200);
  const late = await register({ ...alice, passkey: await Authenticator.create() }, second);
  expect(await late.json()).toEqual({ error: "This invite was already used or has expired" });
});

it("requires an existing passkey to add another", async () => {
  const admin = await setUpAdmin();
  const forged = await call("/passkeys/register/options", {
    cookie: admin.cookie,
    body: { challengeId: "nope", response: {} },
  });
  expect(forged.status).toBe(403);

  const newKey = await Authenticator.create();
  const response = await passkeyAction(admin, "/passkeys/challenge", "/passkeys/register/options");
  const { registration } = await response.json<{ registration: Ceremony }>();
  expect((await register({ ...admin, passkey: newKey }, registration)).status).toBe(200);

  const id = await pendingRequest();
  expect((await vote({ ...admin, passkey: newKey }, id, "approve")).status).toBe(200);
  expect(github.callbacks()[0]?.state).toBe("approved");
});

it("refuses to add a passkey for a user without one", async () => {
  const cookie = await signIn(BOB);
  const response = await call("/passkeys/challenge", { cookie, body: {} });
  expect(await response.json()).toEqual({ error: "Register a passkey first" });
});

it("refuses to register with an authentication challenge", async () => {
  const admin = await setUpAdmin();
  const challenge = await call("/passkeys/challenge", { cookie: admin.cookie, body: {} });
  const response = await register(admin, await challenge.json());
  expect(await response.json()).toEqual({ error: "This challenge was issued for another action" });
});

it("refuses a registration that fails verification", async () => {
  const admin = await setUpAdmin();
  const response = await passkeyAction(admin, "/passkeys/challenge", "/passkeys/register/options");
  const { registration } = await response.json<{ registration: { challengeId: string } }>();
  const wrong = await register(admin, {
    ...registration,
    options: { challenge: "other" },
  } as never);
  expect(wrong.status).toBe(403);
});

it("lists passkeys", async () => {
  const admin = await setUpAdmin();
  const page = await (await call("/passkeys", { cookie: admin.cookie })).text();
  expect(page).toContain("Test key");
  expect(page).toContain("Add a passkey");
  const empty = await (await call("/passkeys", { cookie: await signIn(BOB) })).text();
  expect(empty).toContain("You have no passkeys yet");
});

it("renders the enrollment pages", async () => {
  const cookie = await signIn(BOB);
  expect(await (await call("/invite", { cookie })).text()).toContain("Accept an invite");
});

it("names the passkey and works without transports", async () => {
  const admin = await setUpAdmin();
  const key = await Authenticator.create();
  key.transports = undefined;
  const response = await passkeyAction(admin, "/passkeys/challenge", "/passkeys/register/options");
  const { registration } = await response.json<{ registration: Ceremony }>();
  const verified = await call("/passkeys/register/verify", {
    cookie: admin.cookie,
    body: {
      challengeId: registration.challengeId,
      response: await key.register(registration.options),
      name: " ",
    },
  });
  expect(verified.status).toBe(200);
  const id = await pendingRequest();
  expect((await vote({ ...admin, passkey: key }, id, "approve")).status).toBe(200);
  const page = await (await call("/passkeys", { cookie: admin.cookie })).text();
  expect(page).toContain(">Passkey<");
  expect(page).toContain("used ");
});

it("refuses an attestation that does not verify", async () => {
  const admin = await setUpAdmin();
  const response = await passkeyAction(admin, "/passkeys/challenge", "/passkeys/register/options");
  const { registration } = await response.json<{ registration: Ceremony }>();
  const key = await Authenticator.create();
  const verified = await call("/passkeys/register/verify", {
    cookie: admin.cookie,
    body: {
      challengeId: registration.challengeId,
      response: await key.register(registration.options, { forgedAttestation: true }),
    },
  });
  expect(await verified.json()).toEqual({ error: "Passkey registration failed" });
});

describe("revoking passkeys", () => {
  const revoke = (member: Member, credentialId: string) =>
    passkeyAction(member, "/passkeys/revoke/challenge", "/passkeys/revoke", {
      credential_id: credentialId,
    });

  async function addSecondPasskey(member: Member): Promise<Member> {
    const response = await passkeyAction(
      member,
      "/passkeys/challenge",
      "/passkeys/register/options",
    );
    const { registration } = await response.json<{ registration: Ceremony }>();
    const second = { ...member, passkey: await Authenticator.create() };
    expect((await register(second, registration)).status).toBe(200);
    return second;
  }

  it("removes a lost passkey so it can no longer approve", async () => {
    const admin = await setUpAdmin();
    const spare = await addSecondPasskey(admin);
    const page = await (await call("/passkeys", { cookie: admin.cookie })).text();
    expect(page).toContain(`value="${admin.passkey.id}"`);

    expect((await revoke(spare, admin.passkey.id)).status).toBe(200);
    const id = await pendingRequest();
    const lost = await vote(admin, id, "approve");
    expect(await lost.json()).toEqual({ error: "This passkey is not registered to your account" });
    expect((await vote(spare, id, "approve")).status).toBe(200);
  });

  it("keeps the last passkey", async () => {
    const admin = await setUpAdmin();
    const page = await (await call("/passkeys", { cookie: admin.cookie })).text();
    expect(page).not.toContain("/passkeys/revoke");
    expect(page).toContain("To remove this passkey, add another one first.");
    const response = await revoke(admin, admin.passkey.id);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Add another passkey before removing your last one",
    });
  });

  it("refuses to remove another user's passkey", async () => {
    const admin = await setUpAdmin();
    const alice = await addSecondPasskey(await addMember(admin, ALICE));
    await addSecondPasskey(admin);
    const response = await revoke(alice, admin.passkey.id);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Passkey not found" });
  });

  it("requires a passkey check", async () => {
    const admin = await setUpAdmin();
    await addSecondPasskey(admin);
    const response = await call("/passkeys/revoke", {
      cookie: admin.cookie,
      body: { credential_id: admin.passkey.id },
    });
    expect(response.status).toBe(400);
    const wrongPurpose = await passkeyAction(admin, "/passkeys/challenge", "/passkeys/revoke", {
      credential_id: admin.passkey.id,
    });
    expect(await wrongPurpose.json()).toEqual({
      error: "This challenge was issued for another action",
    });
  });
});

describe("naming passkeys from the device", () => {
  async function addUnnamed(key: Authenticator): Promise<string> {
    const admin = await setUpAdmin();
    const response = await passkeyAction(
      admin,
      "/passkeys/challenge",
      "/passkeys/register/options",
    );
    const { registration } = await response.json<{ registration: Ceremony }>();
    await call("/passkeys/register/verify", {
      cookie: admin.cookie,
      body: {
        challengeId: registration.challengeId,
        response: await key.register(registration.options),
      },
    });
    return (await call("/passkeys", { cookie: admin.cookie })).text();
  }

  it("uses the authenticator's AAGUID", async () => {
    const key = await Authenticator.create();
    key.aaguid = Uint8Array.from("fbfc3007154e4ecc8c0b6e020557d7bd".match(/../g) as string[], (b) =>
      Number.parseInt(b, 16),
    );
    expect(await addUnnamed(key)).toContain(">iCloud Keychain<");
  });

  it("falls back to the transport for unknown security keys", async () => {
    const key = await Authenticator.create();
    key.transports = ["usb", "nfc"];
    expect(await addUnnamed(key)).toContain(">Security key<");
  });
});
