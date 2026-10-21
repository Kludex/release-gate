import { Hono } from "hono";
import {
  authenticationChallenge,
  registrationChallenge,
  verifyAuthentication,
  verifyRegistration,
} from "@/auth/webauthn";
import { audit } from "@/db/audit";
import { listCredentials } from "@/db/credentials";
import { consumeBootstrap, consumeInvite } from "@/db/enrollment";
import { ensurePolicy, upsertApprover } from "@/db/repos";
import type { AppEnv } from "@/env";
import { currentUser, fail, jsonBody, sha256Hex } from "@/http";
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

  if (purpose === "bootstrap") {
    if (!(await consumeBootstrap(db, await sha256Hex(c.env.BOOTSTRAP_CODE)))) {
      fail(403, "This bootstrap code was already used");
    }
    const repos = c.env.BOOTSTRAP_REPOS.split(",")
      .map((repo) => repo.trim())
      .filter(Boolean);
    const admin = {
      github_user_id: user.id,
      login: user.login,
      role: "admin",
      added_by: null,
    } as const;
    await db.batch([
      save,
      ...repos.flatMap((repo) => [
        ensurePolicy(db, repo),
        upsertApprover(db, { ...admin, repo_full_name: repo }),
      ]),
    ]);
    for (const repo of repos) await audit(db, { actor: user, action: "bootstrap.used", repo });
    return c.json({ redirect: "/" });
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
