import { Hono } from "hono";
import { registrationChallenge } from "@/auth/webauthn";
import { listCredentials } from "@/db/credentials";
import { findUsableInvite } from "@/db/enrollment";
import type { AppEnv, Env, User } from "@/env";
import { currentUser, fail, isOwner, jsonBody, sha256Hex, stringField } from "@/http";
import { Enroll } from "@/ui/Enroll";
import { Layout } from "@/ui/Layout";

export const enroll = new Hono<AppEnv>();

enroll.get("/setup", async (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/");
  await requireSetup(c.env, user);
  return c.html(
    <Layout title="Set up" user={user}>
      <Enroll
        action="/setup"
        title="Set up release-gate"
        help="You are the owner of this release-gate. Register your first passkey, then add your repositories."
      />
    </Layout>,
  );
});

enroll.post("/setup", async (c) => {
  const user = currentUser(c);
  await requireSetup(c.env, user);
  return c.json({ registration: await registrationChallenge(c.env, user, "setup") });
});

/** Only the owner, and only before their first passkey: later ones need an existing passkey. */
export async function requireSetup(env: Env, user: User): Promise<void> {
  if (!isOwner(env, user)) fail(404, "Not found");
  if ((await listCredentials(env.DB, user.id)).length > 0) fail(409, "You already have a passkey");
}

enroll.get("/invite", (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/");
  return c.html(
    <Layout title="Accept invite" user={user}>
      <Enroll
        action="/invite"
        title="Accept an invite"
        help="Enter the invite code an admin sent you. It is tied to your GitHub login and expires after 24 hours."
        askCode
      />
    </Layout>,
  );
});

enroll.post("/invite", async (c) => {
  const user = currentUser(c);
  const hash = await sha256Hex(stringField(await jsonBody(c), "code"));
  const invite = await findUsableInvite(c.env.DB, hash);
  if (!invite || invite.github_login.toLowerCase() !== user.login.toLowerCase()) {
    fail(403, "Invalid or expired invite code");
  }
  return c.json({ registration: await registrationChallenge(c.env, user, `invite:${hash}`) });
});
