import { Hono } from "hono";
import { registrationChallenge } from "@/auth/webauthn";
import { findUsableInvite, isBootstrapUsed } from "@/db/enrollment";
import type { AppEnv } from "@/env";
import { currentUser, fail, jsonBody, sha256Hex, stringField } from "@/http";
import { Enroll } from "@/ui/Enroll";
import { Layout } from "@/ui/Layout";

export const enroll = new Hono<AppEnv>();

enroll.get("/bootstrap", (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/");
  return c.html(
    <Layout title="Bootstrap" user={user}>
      <Enroll
        action="/bootstrap"
        title="Bootstrap the first admin"
        help="Enter the BOOTSTRAP_CODE secret. You become an admin of the repositories in BOOTSTRAP_REPOS. The code works once."
      />
    </Layout>,
  );
});

enroll.post("/bootstrap", async (c) => {
  const user = currentUser(c);
  const hash = await sha256Hex(stringField(await jsonBody(c), "code"));
  if (!c.env.BOOTSTRAP_CODE || hash !== (await sha256Hex(c.env.BOOTSTRAP_CODE))) {
    fail(403, "Invalid bootstrap code");
  }
  if (await isBootstrapUsed(c.env.DB, hash)) fail(403, "This bootstrap code was already used");
  return c.json({ registration: await registrationChallenge(c.env, user, "bootstrap") });
});

enroll.get("/invite", (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/");
  return c.html(
    <Layout title="Accept invite" user={user}>
      <Enroll
        action="/invite"
        title="Accept an invite"
        help="Enter the invite code an admin sent you. It is tied to your GitHub login and expires after 24 hours."
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
