import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { oauth } from "@/auth/oauth";
import { session } from "@/auth/session";
import type { AppEnv } from "@/env";
import { handleWebhook } from "@/github/webhook";
import { admin } from "@/routes/admin";
import { enroll } from "@/routes/enroll";
import { passkeys } from "@/routes/passkeys";
import { requests } from "@/routes/requests";

const app = new Hono<AppEnv>();

app.use(
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'"],
      connectSrc: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
    },
    xFrameOptions: "DENY",
    referrerPolicy: "no-referrer",
  }),
);

app.use(async (c, next) => {
  // Passkeys are bound to PUBLIC_ORIGIN, so serve nothing from any other host.
  if (new URL(c.req.url).origin !== c.env.PUBLIC_ORIGIN) return c.text("Misdirected request", 421);
  if (
    c.req.method !== "GET" &&
    c.req.path !== "/webhook" &&
    c.req.header("Origin") !== c.env.PUBLIC_ORIGIN
  ) {
    return c.text("Cross-origin request blocked", 403);
  }
  await next();
});

app.post("/webhook", handleWebhook);
app.use(session);
app.route("/auth", oauth);
app.route("/", requests);
app.route("/", passkeys);
app.route("/", enroll);
app.route("/", admin);

app.onError((error, c) => {
  if (!(error instanceof HTTPException)) {
    console.error(error);
    return c.text("Internal server error", 500);
  }
  return c.req.method === "GET"
    ? c.text(error.message, error.status)
    : c.json({ error: error.message }, error.status);
});

export default app;
