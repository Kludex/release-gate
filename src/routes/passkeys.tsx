import { Hono } from "hono";
import {
  authenticationChallenge,
  registrationChallenge,
  verifyAuthentication,
  verifyRegistration,
} from "@/auth/webauthn";
import { claimableRepo, claimStatements } from "@/claim";
import { audit } from "@/db/audit";
import { deleteCredential, listCredentials } from "@/db/credentials";
import { consumeInvite } from "@/db/enrollment";
import { upsertApprover } from "@/db/repos";
import type { AppEnv } from "@/env";
import { currentUser, fail, jsonBody, stringField } from "@/http";
import { Layout } from "@/ui/Layout";
import { Passkeys } from "@/ui/Passkeys";

export const passkeys = new Hono<AppEnv>();

passkeys.get("/passkeys", async (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/");
  return c.html(
    <Layout title="Passkeys" user={user} page="passkeys">
      <Passkeys credentials={await listCredentials(c.env.DB, user.id)} />
    </Layout>,
  );
});

passkeys.post("/passkeys/challenge", async (c) => {
  return c.json(await authenticationChallenge(c.env, currentUser(c), "add-passkey"));
});

passkeys.post("/passkeys/revoke/challenge", async (c) => {
  return c.json(await authenticationChallenge(c.env, currentUser(c), "revoke-passkey"));
});

passkeys.post("/passkeys/revoke", async (c) => {
  const user = currentUser(c);
  const body = await jsonBody(c);
  await verifyAuthentication(c.env, user, body, ["revoke-passkey"]);
  const credentialId = stringField(body, "credential_id");
  const deleted = await deleteCredential(c.env.DB, user.id, credentialId);
  if (deleted === "missing") fail(404, "Passkey not found");
  if (deleted === "last") fail(409, "Add another passkey before removing your last one");
  await audit(c.env.DB, { actor: user, action: "passkey.revoked", details: { credentialId } });
  return c.json({ redirect: "/passkeys" });
});

passkeys.post("/passkeys/register/options", async (c) => {
  const user = currentUser(c);
  await verifyAuthentication(c.env, user, await jsonBody(c), ["add-passkey"]);
  return c.json({ registration: await registrationChallenge(c.env, user, "register") });
});

passkeys.post("/passkeys/register/verify", async (c) => {
  const user = currentUser(c);
  const { purpose, save } = await verifyRegistration(c.env, user, await jsonBody(c));
  const db = c.env.DB;
  if (purpose === "register") {
    await save.run();
    await audit(db, { actor: user, action: "passkey.added" });
    return c.json({ redirect: "/passkeys" });
  }

  if (purpose.startsWith("claim:")) {
    // Claiming registers a first passkey only. Later ones need an existing passkey.
    if ((await listCredentials(db, user.id)).length > 0) fail(409, "You already have a passkey");
    const repo = await claimableRepo(c.env, user, purpose.slice("claim:".length));
    await db.batch([save, ...claimStatements(db, user, repo)]);
    await audit(db, { actor: user, action: "repo.claimed", repo });
    return c.json({ redirect: `/admin/${repo}` });
  }

  const invite = await consumeInvite(db, purpose.slice("invite:".length));
  if (!invite) fail(403, "This invite was already used or has expired");
  await db.batch([
    save,
    upsertApprover(db, {
      repo_full_name: invite.repo_full_name,
      github_user_id: user.id,
      login: user.login,
      role: invite.role,
      added_by: invite.created_by,
    }),
  ]);
  await audit(db, {
    actor: user,
    action: "invite.accepted",
    repo: invite.repo_full_name,
    details: { role: invite.role },
  });
  return c.json({ redirect: "/" });
});
