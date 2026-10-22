import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppEnv, Env, User } from "@/env";

export type Body = Record<string, unknown>;

export function fail(status: ContentfulStatusCode, message: string): never {
  throw new HTTPException(status, { message });
}

export async function jsonBody(c: Context<AppEnv>): Promise<Body> {
  const body: unknown = await c.req.json().catch(() => null);
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    fail(400, "Expected a JSON object");
  }
  return body as Body;
}

export function stringField(body: Body, name: string): string {
  const value = body[name];
  if (typeof value !== "string" || value === "") fail(400, `Missing field: ${name}`);
  return value;
}

export function currentUser(c: Context<AppEnv>): User {
  const user = c.get("user");
  if (!user) fail(401, "Sign in with GitHub first");
  return user;
}

export function isOwner(env: Env, user: User): boolean {
  return String(user.id) === env.OWNER_GITHUB_ID;
}

export function randomToken(bytes = 20): string {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(data, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
