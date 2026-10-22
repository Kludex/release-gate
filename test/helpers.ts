import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { sign } from "@octokit/webhooks-methods";
import type { User } from "@/env";
import app from "@/index";
import { Authenticator } from "./authenticator";
import { API, CALLBACK_URL, claimRoutes, github, REPO, releaseRoutes, SHA } from "./github";

export const ORIGIN = "https://gate.test";
export const ADMIN: User = { id: 1, login: "admin" };
export const ALICE: User = { id: 2, login: "alice" };
export const BOB: User = { id: 3, login: "bob" };
export const PUSHER: User = { id: 100, login: "pusher" };

export type Member = { user: User; cookie: string; passkey: Authenticator };
export type Ceremony = { challengeId: string; options: { challenge: string } };

type CallOptions = {
  method?: string;
  body?: unknown;
  cookie?: string;
  origin?: string | null;
  headers?: Record<string, string>;
};

/** Sends a request through the Worker and waits for its background work. */
export async function call(path: string, options: CallOptions = {}): Promise<Response> {
  const method = options.method ?? (options.body === undefined ? "GET" : "POST");
  const headers = new Headers(options.headers);
  const origin = options.origin === undefined ? ORIGIN : options.origin;
  if (method !== "GET" && origin !== null) headers.set("Origin", origin);
  if (options.cookie) headers.set("Cookie", options.cookie);
  let body: string | undefined;
  if (options.body !== undefined) {
    body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
    headers.set("Content-Type", "application/json");
  }
  const url = path.startsWith("https://") ? path : `${ORIGIN}${path}`;
  const ctx = createExecutionContext();
  const response = await app.fetch(new Request(url, { method, headers, body }), env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

export function cookie(response: Response, name: string): string {
  const header = response.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
  if (!header) throw new Error(`No ${name} cookie`);
  return header.split(";")[0] as string;
}

export type Repositories = { full_name: string; permissions?: { admin: boolean } }[] | null;

/**
 * Signs in through GitHub, which reports the app's installations the user can see and their
 * repositories. `null` makes that GitHub call fail.
 */
export async function signIn(
  user: User,
  installations: Record<number, Repositories> | null = {},
): Promise<string> {
  const login = await call("/auth/login");
  const state = new URL(login.headers.get("Location") as string).searchParams.get("state");
  const failure = () => new Response(null, { status: 401 });
  github.on("POST", "https://github.com/login/oauth/access_token", { access_token: "user-token" });
  github.on("GET", `${API}/user`, user);
  const ids = Object.keys(installations ?? {}).map((id) => ({ id: Number(id) }));
  github.on(
    "GET",
    `${API}/user/installations?per_page=100`,
    installations ? { installations: ids } : failure,
  );
  for (const [id, repositories] of Object.entries(installations ?? {})) {
    const url = `${API}/user/installations/${id}/repositories?per_page=100`;
    github.on("GET", url, repositories ? { repositories } : failure);
  }
  const callback = await call(`/auth/callback?code=abc&state=${state}`, {
    cookie: cookie(login, "__Host-oauth_state"),
  });
  return cookie(callback, "__Host-session");
}

export async function register(member: Member, registration: Ceremony): Promise<Response> {
  return call("/passkeys/register/verify", {
    cookie: member.cookie,
    body: {
      challengeId: registration.challengeId,
      response: await member.passkey.register(registration.options),
      name: "Test key",
    },
  });
}

/** Signs in and registers a first passkey through `/invite` or by setting up a repository. */
export async function enroll(user: User, path: "/repos" | "/invite", code = ""): Promise<Member> {
  const member = { user, cookie: await signIn(user), passkey: await Authenticator.create() };
  const response = await call(path, { cookie: member.cookie, body: { code, repo: REPO } });
  if (!response.ok) throw new Error(`Enrollment failed: ${await response.text()}`);
  const { registration } = await response.json<{ registration: Ceremony }>();
  const verified = await register(member, registration);
  if (!verified.ok) throw new Error(`Registration failed: ${await verified.text()}`);
  return member;
}

/** A GitHub admin of `REPO` sets it up in release-gate with their first passkey. */
export function setUpAdmin(): Promise<Member> {
  claimRoutes(ADMIN);
  return enroll(ADMIN, "/repos");
}

/** Runs the same challenge, assertion and submit sequence as `client/webauthn.ts`. */
export async function passkeyAction(
  member: Member,
  challengeUrl: string,
  actionUrl: string,
  fields: Record<string, unknown> = {},
): Promise<Response> {
  const challenge = await call(challengeUrl, { cookie: member.cookie, body: fields });
  if (!challenge.ok) return challenge;
  const { challengeId, options } = await challenge.json<Ceremony>();
  const response = await member.passkey.authenticate(options);
  return call(actionUrl, { cookie: member.cookie, body: { ...fields, challengeId, response } });
}

export async function createInvite(
  admin: Member,
  login: string,
  role = "approver",
): Promise<string> {
  const response = await passkeyAction(
    admin,
    `/admin/${REPO}/challenge`,
    `/admin/${REPO}/invites`,
    {
      login,
      role,
    },
  );
  const { message } = await response.json<{ message: string }>();
  return (/: ([0-9a-f]{40})\./.exec(message) as RegExpExecArray)[1] as string;
}

export async function addMember(admin: Member, user: User, role = "approver"): Promise<Member> {
  return enroll(user, "/invite", await createInvite(admin, user.login, role));
}

export function protectionRule(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    action: "requested",
    environment: "pypi",
    event: "push",
    deployment_callback_url: CALLBACK_URL,
    deployment: { ref: "v1.0.0", sha: SHA },
    repository: { full_name: REPO, default_branch: "main", owner: { login: "acme" } },
    installation: { id: 7 },
    sender: PUSHER,
    ...overrides,
  };
}

export async function sendWebhook(
  payload: Record<string, unknown> | string,
  options: { delivery?: string; event?: string; signature?: string | null } = {},
): Promise<Response> {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  const signature =
    options.signature === undefined ? await sign("webhook-secret", body) : options.signature;
  const headers: Record<string, string> = {
    "X-GitHub-Event": options.event ?? "deployment_protection_rule",
    "X-GitHub-Delivery": options.delivery ?? crypto.randomUUID(),
  };
  if (signature !== null) headers["X-Hub-Signature-256"] = signature;
  return call("/webhook", { body, origin: null, headers });
}

export type RequestRow = { id: string; status: string; decision: string | null; ref: string };

export async function latestRequest(): Promise<RequestRow> {
  return (await env.DB.prepare(
    "SELECT id, status, decision, ref FROM approval_requests ORDER BY created_at DESC, rowid DESC",
  ).first<RequestRow>()) as RequestRow;
}

/** Sends a healthy release webhook and returns the pending request id. */
export async function pendingRequest(
  options: Parameters<typeof releaseRoutes>[0] = {},
): Promise<string> {
  releaseRoutes(options);
  await sendWebhook(protectionRule());
  const request = await latestRequest();
  if (request.status !== "pending") throw new Error(`Request is ${request.status}`);
  return request.id;
}

export async function setPolicy(admin: Member, policy: Record<string, string>): Promise<void> {
  const response = await passkeyAction(admin, `/admin/${REPO}/challenge`, `/admin/${REPO}/policy`, {
    min_approvals: "1",
    prevent_self_review: "1",
    require_default_branch: "1",
    ...policy,
  });
  if (!response.ok) throw new Error(`Policy update failed: ${await response.text()}`);
}

export const vote = (member: Member, id: string, action: string): Promise<Response> =>
  passkeyAction(member, `/requests/${id}/challenge`, `/requests/${id}/decision`, { action });
