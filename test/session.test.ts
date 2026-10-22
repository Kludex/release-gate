import { expect, it, vi } from "vitest";
import { ADMIN, BOB, call, cookie, ORIGIN, setUpAdmin, signIn } from "./helpers";

const home = async (session: string) => (await call("/releases", { cookie: session })).text();
const admin = (full_name: string) => ({ full_name, permissions: { admin: true } });

it("offers the installed repositories a user administers on GitHub", async () => {
  const session = await signIn(BOB, {
    7: [admin("acme/widgets"), { full_name: "acme/pushable", permissions: { admin: false } }],
    8: [{ full_name: "acme/public" }],
    9: null,
  });
  const page = await home(session);
  expect(page).toContain('<option value="acme/widgets">');
  expect(page).not.toContain("acme/pushable");
  expect(page).not.toContain("acme/public");
  expect(page).toContain("Register a passkey and set up");
});

it("hides repositories that are already set up", async () => {
  await setUpAdmin();
  const session = await signIn(ADMIN, {
    7: [admin("acme/widgets"), admin("acme/other")],
  });
  const page = await home(session);
  expect(page).toContain('<option value="acme/other">');
  expect(page).not.toContain('<option value="acme/widgets">');
  expect(page).toContain('data-challenge="/repos/challenge"');
  expect(await home(await signIn(BOB, { 7: [admin("acme/widgets")] }))).toContain(
    "No repositories to set up.",
  );
});

it("refreshes the list on every sign-in", async () => {
  expect(await home(await signIn(BOB, { 7: [admin("acme/widgets")] }))).toContain(
    '<option value="acme/widgets">',
  );
  const page = await home(await signIn(BOB, null));
  expect(page).toContain("No repositories to set up.");
  expect(page).toContain("not an approver for any repository yet");
});

it("signs in with GitHub and shows the dashboard", async () => {
  const session = await signIn(ADMIN);
  const page = await call("/releases", { cookie: session });
  expect(await page.text()).toContain("@admin");
});

it("redirects to GitHub with a state parameter", async () => {
  const response = await call("/auth/login");
  const location = new URL(response.headers.get("Location") as string);
  expect(location.origin + location.pathname).toBe("https://github.com/login/oauth/authorize");
  expect(location.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/auth/callback`);
  expect(response.headers.getSetCookie()[0]).toMatch(/HttpOnly; Secure; SameSite=Lax/);
});

it("refuses a callback with the wrong state", async () => {
  const login = await call("/auth/login");
  const response = await call("/auth/callback?code=abc&state=forged", {
    cookie: cookie(login, "__Host-oauth_state"),
  });
  expect(response.status).toBe(400);
});

it("refuses a callback when GitHub does not issue a token", async () => {
  const { github } = await import("./github");
  const login = await call("/auth/login");
  const state = new URL(login.headers.get("Location") as string).searchParams.get("state");
  github.on("POST", "https://github.com/login/oauth/access_token", {
    error: "bad_verification_code",
  });
  const response = await call(`/auth/callback?code=abc&state=${state}`, {
    cookie: cookie(login, "__Host-oauth_state"),
  });
  expect(response.status).toBe(400);
});

it("refuses a callback when the GitHub user cannot be read", async () => {
  const { github, API } = await import("./github");
  const login = await call("/auth/login");
  const state = new URL(login.headers.get("Location") as string).searchParams.get("state");
  github.on("POST", "https://github.com/login/oauth/access_token", { access_token: "t" });
  github.on("GET", `${API}/user`, () => new Response(null, { status: 401 }));
  const response = await call(`/auth/callback?code=abc&state=${state}`, {
    cookie: cookie(login, "__Host-oauth_state"),
  });
  expect(response.status).toBe(502);
});

it("sets a strict, host-only session cookie", async () => {
  const login = await call("/auth/login");
  const state = new URL(login.headers.get("Location") as string).searchParams.get("state");
  const { github, API } = await import("./github");
  github.on("POST", "https://github.com/login/oauth/access_token", { access_token: "t" });
  github.on("GET", `${API}/user`, ADMIN);
  github.on("GET", `${API}/user/installations?per_page=100`, { installations: [] });
  const callback = await call(`/auth/callback?code=abc&state=${state}`, {
    cookie: cookie(login, "__Host-oauth_state"),
  });
  const header = callback.headers.getSetCookie().find((c) => c.startsWith("__Host-session="));
  expect(header).toMatch(/Max-Age=43200; Path=\/; HttpOnly; Secure; SameSite=Strict/);
  expect(await callback.text()).toContain('http-equiv="refresh"');
});

it("ignores a tampered session cookie", async () => {
  const session = await signIn(ADMIN);
  const [name, value] = session.split("=") as [string, string];
  const [payload, signature] = decodeURIComponent(value).split(".") as [string, string];
  const forged = `${name}=${encodeURIComponent(`${payload.replace('"id":1', '"id":2')}.${signature}`)}`;
  const response = await call("/passkeys/challenge", { cookie: forged, body: {} });
  expect(response.status).toBe(401);
});

it("shows the home page whether or not you are signed in", async () => {
  expect(await (await call("/")).text()).toContain('href="/auth/login"');
  const page = await (await call("/", { cookie: await signIn(ADMIN) })).text();
  expect(page).toContain("Open your releases");
  expect(page).toContain("@admin");
});

it("expires sessions after 12 hours", async () => {
  const session = await signIn(ADMIN);
  vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + 12 * 60 * 60 * 1000 + 1 });
  expect(await (await call("/", { cookie: session })).text()).toContain("Sign in with GitHub");
});

it("signs out", async () => {
  const response = await call("/auth/logout", { method: "POST", cookie: await signIn(ADMIN) });
  expect(response.status).toBe(303);
  expect(response.headers.getSetCookie()[0]).toMatch(/^__Host-session=; Max-Age=0/);
});

it.each([
  ["a foreign", "https://evil.test"],
  ["a missing", null],
])("blocks POSTs with %s Origin", async (_, origin) => {
  const admin = await setUpAdmin();
  const response = await call("/passkeys/challenge", { cookie: admin.cookie, body: {}, origin });
  expect(response.status).toBe(403);
});

it("refuses requests for another host", async () => {
  const response = await call("https://release-gate.other.dev/");
  expect(response.status).toBe(421);
});

it("sets security headers on every response", async () => {
  const response = await call("/");
  expect(response.headers.get("Content-Security-Policy")).toBe(
    "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  );
  expect(response.headers.get("X-Frame-Options")).toBe("DENY");
  expect(response.headers.get("Referrer-Policy")).toBe("same-origin");
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
});

it("redirects anonymous visitors to the sign-in page", async () => {
  for (const path of [
    "/releases",
    "/passkeys",
    "/invite",
    "/audit",
    "/admin/acme/widgets",
    "/requests/x",
  ]) {
    const response = await call(path);
    expect(response.headers.get("Location"), path).toBe("/");
  }
});

it("rejects a non-JSON body", async () => {
  const admin = await setUpAdmin();
  const response = await call("/invite", { cookie: admin.cookie, body: "[]" });
  expect(await response.json()).toEqual({ error: "Expected a JSON object" });
  const broken = await call("/invite", { cookie: admin.cookie, body: "{" });
  expect(await broken.json()).toEqual({ error: "Expected a JSON object" });
  const missing = await call("/invite", { cookie: admin.cookie, body: {} });
  expect(await missing.json()).toEqual({ error: "Missing field: code" });
});
