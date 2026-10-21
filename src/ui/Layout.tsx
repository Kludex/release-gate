import { raw } from "hono/html";
import type { Child } from "hono/jsx";
import type { User } from "@/env";

type Props = { title: string; user: User | null; children: Child };

export const Layout = ({ title, user, children }: Props) => (
  <>
    {raw("<!doctype html>")}
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{`${title} · release-gate`}</title>
        <link rel="stylesheet" href="/app.css" />
        <script type="module" src="/app.js" />
      </head>
      <body class="bg-stone-50 text-stone-900 antialiased">
        <header class="border-b border-stone-200 bg-white">
          <nav class="mx-auto flex max-w-3xl items-center gap-6 px-4 py-3 text-sm">
            <a href="/" class="font-semibold tracking-tight">
              release-gate
            </a>
            {user && (
              <>
                <a href="/passkeys" class="text-stone-600 hover:text-stone-900">
                  Passkeys
                </a>
                <a href="/audit" class="text-stone-600 hover:text-stone-900">
                  Audit log
                </a>
                <form method="post" action="/auth/logout" class="ml-auto flex items-center gap-3">
                  <span class="text-stone-500">@{user.login}</span>
                  <button type="submit" class="text-stone-600 hover:text-stone-900">
                    Sign out
                  </button>
                </form>
              </>
            )}
          </nav>
        </header>
        <main class="mx-auto max-w-3xl space-y-8 px-4 py-8">{children}</main>
      </body>
    </html>
  </>
);

export const Redirect = ({ to }: { to: string }) => (
  <>
    {raw("<!doctype html>")}
    <html lang="en">
      <head>
        <meta http-equiv="refresh" content={`0;url=${to}`} />
      </head>
      <body>
        <a href={to}>Continue</a>
      </body>
    </html>
  </>
);

export const Section = ({ title, children }: { title: string; children: Child }) => (
  <section class="space-y-3">
    <h2 class="text-sm font-semibold uppercase tracking-wide text-stone-500">{title}</h2>
    {children}
  </section>
);

export const Card = ({ children }: { children: Child }) => (
  <div class="rounded-lg border border-stone-200 bg-white p-4">{children}</div>
);

export const formatTime = (ms: number): string =>
  new Date(ms).toISOString().replace("T", " ").slice(0, 16);
