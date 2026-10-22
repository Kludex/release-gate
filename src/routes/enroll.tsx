import { Hono } from "hono";
import { registrationChallenge } from "@/auth/webauthn";
import { findUsableInvite } from "@/db/enrollment";
import type { AppEnv } from "@/env";
import { currentUser, fail, jsonBody, sha256Hex, stringField } from "@/http";
import { Enroll } from "@/ui/Enroll";
import { Layout } from "@/ui/Layout";

export const enroll = new Hono<AppEnv>();

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
