import { raw } from "hono/html";
import type { Child } from "hono/jsx";
import type { User } from "@/env";

type Page = "requests" | "passkeys" | "audit";

type Props = { title: string; user: User | null; page?: Page; children: Child };

const NAV: [Page, string, string][] = [
  ["requests", "/", "Requests"],
  ["passkeys", "/passkeys", "Passkeys"],
  ["audit", "/audit", "Audit log"],
];

const box =
  "flex h-12 items-center whitespace-nowrap border-3 border-black text-xs font-bold uppercase transition-colors sm:text-sm";

export const Layout = ({ title, user, page, children }: Props) => (
  <>
    {raw("<!doctype html>")}
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{`${title} · release-gate`}</title>
        <link rel="preload" href="/fonts/onest.woff2" as="font" type="font/woff2" crossorigin="" />
        <link rel="stylesheet" href="/app.css" />
        <script type="module" src="/app.js" />
      </head>
      <body class="flex min-h-screen flex-col font-sans">
        <header class="border-b-3 border-black">
          <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-y-4 px-4 py-4 lg:px-8">
            <a
              href="/"
              class="flex h-12 border-3 border-black text-xl font-extrabold uppercase leading-none"
            >
              <span class="flex items-center bg-milk px-3">Release</span>
              <span class="flex items-center border-l-3 border-black bg-coral px-3">Gate</span>
            </a>
            {user && (
              <>
                <nav class="order-last flex w-full lg:order-none lg:ml-auto lg:w-auto">
                  {NAV.map(([key, href, label]) => (
                    <a
                      href={href}
                      aria-current={key === page ? "page" : undefined}
                      class={`${box} -ml-[3px] flex-1 justify-center px-4 first:ml-0 ${
                        key === page ? "bg-black text-milk" : "bg-cream hover:bg-green"
                      }`}
                    >
                      {label}
                    </a>
                  ))}
                </nav>
                <form
                  method="post"
                  action="/auth/logout"
                  class={`${box} ml-auto bg-milk lg:-ml-[3px]`}
                >
                  <span class="hidden px-4 normal-case sm:block">@{user.login}</span>
                  <button
                    type="submit"
                    class="h-full cursor-pointer border-black px-4 sm:border-l-3 font-bold uppercase transition-colors hover:bg-green"
                  >
                    Sign out
                  </button>
                </form>
              </>
            )}
          </div>
        </header>
        <main class="flex-1">{children}</main>
        <footer class="mx-auto w-full max-w-6xl px-4 py-8 text-sm text-grey-700 lg:px-8">
          release-gate is open source under the BSD-3-Clause license.{" "}
          <a href="https://github.com/Kludex/release-gate" class={link}>
            Read the code
          </a>
          .
        </footer>
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

/** Bold text link with the thick yellow underline from patrick.wtf. */
export const link =
  "font-bold underline decoration-yellow decoration-3 underline-offset-4 transition-colors hover:decoration-black";

const TONES = { milk: "bg-milk", caramel: "bg-caramel" };

type BandProps = { tone?: keyof typeof TONES; children: Child };

/** A full-bleed stripe of the page, closed by a 3px rule. */
export const Band = ({ tone = "milk", children }: BandProps) => (
  <section class={`border-b-3 border-black ${TONES[tone]}`}>
    <div class="mx-auto max-w-6xl space-y-6 px-4 py-10 lg:px-8 lg:py-14">{children}</div>
  </section>
);

type TitleProps = { title: Child; subtitle?: Child; aside?: Child };

export const PageTitle = ({ title, subtitle, aside }: TitleProps) => (
  <Band>
    <div class="flex flex-wrap items-end justify-between gap-6">
      <div class="min-w-0 space-y-4">
        <h1 class="break-words text-5xl font-extrabold leading-[0.95] tracking-tight lg:text-[5rem]">
          {title}
        </h1>
        {subtitle && (
          <p class="max-w-[52ch] text-pretty text-lg font-medium lg:text-2xl">{subtitle}</p>
        )}
      </div>
      {aside}
    </div>
  </Band>
);

type SectionProps = { title: string; tone?: keyof typeof TONES; children: Child };

export const Section = ({ title, tone, children }: SectionProps) => (
  <Band tone={tone}>
    <h2 class="text-3xl font-semibold leading-tight lg:text-[2.5rem]">{title}</h2>
    {children}
  </Band>
);

export const Card = ({ children }: { children: Child }) => (
  <div class="border-3 border-black bg-cream p-5 lg:p-8">{children}</div>
);

/** A cream card split into rows by 3px rules. */
export const rows = "divide-y-3 divide-black border-3 border-black bg-cream";

export const Empty = ({ children }: { children: Child }) => (
  <p class="border-3 border-dashed border-black px-5 py-6 text-lg font-medium">{children}</p>
);

const TAG_COLORS = {
  grey: "bg-grey-100",
  yellow: "bg-yellow",
  blue: "bg-blue",
  green: "bg-green",
  red: "bg-red",
  purple: "bg-purple",
  black: "bg-black text-milk",
  milk: "bg-milk",
};

type TagProps = { color: keyof typeof TAG_COLORS; big?: boolean; children: Child };

export const Tag = ({ color, big = false, children }: TagProps) => (
  <span
    class={`inline-flex shrink-0 items-center border-3 border-black font-bold uppercase leading-none ${
      big ? "px-5 py-3 text-lg" : "px-2.5 py-1.5 text-xs"
    } ${TAG_COLORS[color]}`}
  >
    {children}
  </span>
);

export const formatTime = (ms: number): string =>
  new Date(ms).toISOString().replace("T", " ").slice(0, 16);
