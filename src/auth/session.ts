import type { Context } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import type { AppEnv, User } from "@/env";

const COOKIE = "session";
const MAX_AGE_SECONDS = 12 * 60 * 60;

export async function startSession(c: Context<AppEnv>, user: User): Promise<void> {
  const value = JSON.stringify({ ...user, exp: Date.now() + MAX_AGE_SECONDS * 1000 });
  await setSignedCookie(c, COOKIE, value, c.env.SESSION_SECRET, {
    prefix: "host",
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "Strict",
    maxAge: MAX_AGE_SECONDS,
  });
}

export function endSession(c: Context<AppEnv>): void {
  deleteCookie(c, COOKIE, { prefix: "host", path: "/", secure: true });
}

export const session = createMiddleware<AppEnv>(async (c, next) => {
  const value = await getSignedCookie(c, c.env.SESSION_SECRET, COOKIE, "host");
  const data = value ? (JSON.parse(value) as User & { exp: number }) : null;
  c.set("user", data && data.exp > Date.now() ? { id: data.id, login: data.login } : null);
  await next();
});
