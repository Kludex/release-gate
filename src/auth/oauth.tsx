import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { endSession, startSession } from "@/auth/session";
import { audit } from "@/db/audit";
import { replaceUserRepos } from "@/db/repos";
import type { AppEnv, User } from "@/env";
import { installedAdminRepos } from "@/github/user";
import { fail, randomToken } from "@/http";
import { Redirect } from "@/ui/Layout";

const STATE_COOKIE = "oauth_state";

export const oauth = new Hono<AppEnv>();

oauth.get("/login", (c) => {
  const state = randomToken();
  // Lax, not Strict: the callback is a cross-site navigation from github.com.
  setCookie(c, STATE_COOKIE, state, {
    prefix: "host",
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "Lax",
    maxAge: 600,
  });
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", c.env.GITHUB_CLIENT_ID);
  url.searchParams.set("redirect_uri", `${c.env.PUBLIC_ORIGIN}/auth/callback`);
  url.searchParams.set("state", state);
  return c.redirect(url.toString());
});

oauth.get("/callback", async (c) => {
  const expected = getCookie(c, STATE_COOKIE, "host");
  deleteCookie(c, STATE_COOKIE, { prefix: "host", path: "/", secure: true });
  const { code, state } = c.req.query();
  if (!expected || !code || state !== expected) fail(400, "Invalid OAuth state");

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: c.env.GITHUB_CLIENT_ID,
      client_secret: c.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${c.env.PUBLIC_ORIGIN}/auth/callback`,
    }),
  });
  const { access_token } = await tokenResponse.json<{ access_token?: string }>();
  if (!access_token) fail(400, "GitHub sign-in failed");

  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${access_token}`,
      "User-Agent": "release-gate",
    },
  });
  if (!userResponse.ok) fail(502, "Could not read the GitHub user");
  const { id, login } = await userResponse.json<User>();
  await replaceUserRepos(c.env.DB, id, await installedAdminRepos(access_token));
  await startSession(c, { id, login });
  await audit(c.env.DB, { actor: { id, login }, action: "session.created" });
  // A same-site navigation, so the browser sends the new Strict cookie.
  return c.html(<Redirect to="/releases" />);
});

oauth.post("/logout", (c) => {
  endSession(c);
  return c.redirect("/", 303);
});
