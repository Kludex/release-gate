type Handler = (request: Request) => Response | Promise<Response>;

export const SHA = "a".repeat(40);
export const API = "https://api.github.com";
export const REPO = "acme/widgets";
export const RUN_ID = 42;
export const CALLBACK_URL = `${API}/repos/${REPO}/actions/runs/${RUN_ID}/deployment_protection_rule`;

const routes = new Map<string, Handler>();
const calls: { method: string; url: string; body: string }[] = [];

/** A fake GitHub behind `fetch`. Unknown routes fail the test loudly. */
export const github = {
  calls,
  reset(): void {
    routes.clear();
    calls.length = 0;
  },
  on(method: string, url: string, handler: Handler | unknown): void {
    routes.set(
      `${method} ${url}`,
      typeof handler === "function" ? (handler as Handler) : () => Response.json(handler),
    );
  },
  async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const request = new Request(input, init);
    const key = `${request.method} ${request.url}`;
    calls.push({ method: request.method, url: request.url, body: await request.clone().text() });
    const handler = routes.get(key);
    if (!handler) throw new Error(`Unexpected fetch: ${key}`);
    return handler(request);
  },
  callbacks(): { environment_name: string; state: string; comment: string }[] {
    return calls.filter((c) => c.url === CALLBACK_URL).map((c) => JSON.parse(c.body));
  },
};

/** Routes for a healthy tag release of `v1.0.0` on `acme/widgets`. */
export function releaseRoutes(
  options: { initiators?: number[]; callbackStatus?: number } = {},
): void {
  const [actor = 100, triggering = actor] = options.initiators ?? [];
  github.on("POST", `${API}/app/installations/7/access_tokens`, { token: "installation-token" });
  github.on("GET", `${API}/repos/${REPO}/git/ref/tags/v1.0.0`, {
    object: { type: "commit", sha: SHA },
  });
  github.on("GET", `${API}/repos/${REPO}/compare/main...${SHA}?per_page=1`, { status: "behind" });
  github.on("GET", `${API}/repos/${REPO}/actions/runs/${RUN_ID}`, {
    actor: { id: actor },
    triggering_actor: { id: triggering },
  });
  github.on("GET", `${API}/repos/${REPO}/tags?per_page=100`, [
    { name: "v1.0.0" },
    { name: "v0.9.0" },
  ]);
  github.on(
    "POST",
    CALLBACK_URL,
    () => new Response(null, { status: options.callbackStatus ?? 204 }),
  );
}
