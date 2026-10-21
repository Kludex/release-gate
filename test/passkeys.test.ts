import { expect, it, vi } from "vitest";
import { Authenticator } from "./authenticator";
import { github } from "./github";
import type { Ceremony } from "./helpers";
import {
  ADMIN,
  ALICE,
  BOB,
  bootstrapAdmin,
  call,
  createInvite,
  enroll,
  passkeyAction,
  pendingRequest,
  register,
  signIn,
  vote,
} from "./helpers";

it("makes the bootstrap user an admin of BOOTSTRAP_REPOS", async () => {
  const admin = await bootstrapAdmin();
  const page = await call("/admin/acme/widgets", { cookie: admin.cookie });
  expect(page.status).toBe(200);
  expect(await page.text()).toContain("@admin");
});

it("accepts the bootstrap code only once", async () => {
  await bootstrapAdmin();
  const cookie = await signIn(BOB);
  const response = await call("/bootstrap", { cookie, body: { code: "bootstrap-code" } });
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ error: "This bootstrap code was already used" });
});

it("consumes the bootstrap code when the passkey is registered", async () => {
  const first = { user: ADMIN, cookie: await signIn(ADMIN), passkey: await Authenticator.create() };
  const second = { user: BOB, cookie: await signIn(BOB), passkey: await Authenticator.create() };
  const [firstOptions, secondOptions] = await Promise.all(
    [first, second].map(async (m) => {
      const response = await call("/bootstrap", {
        cookie: m.cookie,
        body: { code: "bootstrap-code" },
      });
      return (await response.json<{ registration: Ceremony }>()).registration;
    }),
  );
  expect((await register(first, firstOptions as Ceremony)).status).toBe(200);
  const late = await register(second, secondOptions as Ceremony);
  expect(late.status).toBe(403);
  expect(await late.json()).toEqual({ error: "This bootstrap code was already used" });
});

it("refuses a wrong bootstrap code", async () => {
  const cookie = await signIn(ADMIN);
  const response = await call("/bootstrap", { cookie, body: { code: "guess" } });
  expect(await response.json()).toEqual({ error: "Invalid bootstrap code" });
});

it("accepts an invite once", async () => {
  const admin = await bootstrapAdmin();
  const code = await createInvite(admin, "alice");
  const alice = await enroll(ALICE, "/invite", code);
  const id = await pendingRequest();
  expect((await vote(alice, id, "approve")).status).toBe(200);
  const again = await call("/invite", { cookie: alice.cookie, body: { code } });
  expect(await again.json()).toEqual({ error: "Invalid or expired invite code" });
});

it("refuses an invite for another login", async () => {
  const admin = await bootstrapAdmin();
  const code = await createInvite(admin, "alice");
  const response = await call("/invite", { cookie: await signIn(BOB), body: { code } });
  expect(response.status).toBe(403);
});

it("refuses an expired invite", async () => {
  const admin = await bootstrapAdmin();
  const code = await createInvite(admin, "@alice", "admin");
  vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + 25 * 60 * 60 * 1000 });
  const cookie = await signIn(ALICE);
  const response = await call("/invite", { cookie, body: { code } });
  expect(await response.json()).toEqual({ error: "Invalid or expired invite code" });
});

it("consumes the invite when the passkey is registered", async () => {
  const admin = await bootstrapAdmin();
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
  const admin = await bootstrapAdmin();
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
  const admin = await bootstrapAdmin();
  const challenge = await call("/passkeys/challenge", { cookie: admin.cookie, body: {} });
  const response = await register(admin, await challenge.json());
  expect(await response.json()).toEqual({ error: "This challenge was issued for another action" });
});

it("refuses a registration that fails verification", async () => {
  const admin = await bootstrapAdmin();
  const response = await passkeyAction(admin, "/passkeys/challenge", "/passkeys/register/options");
  const { registration } = await response.json<{ registration: { challengeId: string } }>();
  const wrong = await register(admin, {
    ...registration,
    options: { challenge: "other" },
  } as never);
  expect(wrong.status).toBe(403);
});

it("lists passkeys", async () => {
  const admin = await bootstrapAdmin();
  const page = await (await call("/passkeys", { cookie: admin.cookie })).text();
  expect(page).toContain("Test key");
  expect(page).toContain("Add a passkey");
  const empty = await (await call("/passkeys", { cookie: await signIn(BOB) })).text();
  expect(empty).toContain("You have no passkeys yet");
});

it("renders the enrollment pages", async () => {
  const cookie = await signIn(BOB);
  expect(await (await call("/bootstrap", { cookie })).text()).toContain(
    "Bootstrap the first admin",
  );
  expect(await (await call("/invite", { cookie })).text()).toContain("Accept an invite");
});

it("names the passkey and works without transports", async () => {
  const admin = await bootstrapAdmin();
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
  const admin = await bootstrapAdmin();
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
