import { raw } from "hono/html";
import type { Child } from "hono/jsx";
import type { User } from "@/env";
import { Blob, GitHubIcon } from "@/ui/Icons";

type Page = "requests" | "passkeys" | "audit";

type Props = { title: string; user: User | null; page?: Page; children: Child };

const NAV: [Page, string, string][] = [
  ["requests", "/", "Releases"],
  ["passkeys", "/passkeys", "Passkeys"],
  ["audit", "/audit", "Audit log"],
];

/** Thick yellow underline that skips descenders, as on patrick.wtf. */
export const link =
  "font-semibold underline decoration-yellow decoration-[0.22em] underline-offset-[0.1em] transition-colors hover:decoration-black";

const WOBBLE = [
  "rotate-3",
  "-rotate-6 translate-y-1",
  "rotate-2 -translate-y-0.5",
  "-rotate-3",
  "rotate-6 translate-y-0.5",
  "-rotate-2 -translate-y-1",
  "rotate-1",
  "-rotate-6 translate-y-1",
  "rotate-3 -translate-y-0.5",
  "-rotate-2 translate-y-0.5",
  "rotate-6",
  "-rotate-3 -translate-y-1",
];

const Logo = () => (
  <a
    href="/"
    aria-label="release-gate home"
    class="inline-block -rotate-3 font-display text-5xl leading-none transition-transform hover:rotate-0 lg:text-6xl"
  >
    {[..."release-gate"].map((letter, index) => (
      <span aria-hidden="true" class={`inline-block ${WOBBLE[index]}`}>
        {letter}
      </span>
    ))}
  </a>
);

const navLink = "decoration-[0.22em] underline-offset-[0.1em] transition-colors hover:underline";

export const Layout = ({ title, user, page, children }: Props) => (
  <>
    {raw("<!doctype html>")}
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{`${title} · release-gate`}</title>
        <link rel="preload" href="/fonts/jost.woff2" as="font" type="font/woff2" crossorigin="" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="stylesheet" href="/app.css" />
        <script type="module" src="/app.js" />
      </head>
      <body class="flex min-h-screen flex-col font-sans text-lg font-[450]">
        <header class="flex flex-col items-center gap-6 px-5 pt-10 pb-4">
          <Logo />
          {user && (
            <nav class="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-semibold">
              {NAV.map(([key, href, label]) => (
                <a
                  href={href}
                  aria-current={key === page ? "page" : undefined}
                  class={`${navLink} ${key === page ? "underline decoration-yellow" : "decoration-black"}`}
                >
                  {label}
                </a>
              ))}
              <form method="post" action="/auth/logout" class="flex items-center gap-2">
                <span class="text-grey-600">@{user.login}</span>
                <button type="submit" class={`${navLink} cursor-pointer font-semibold`}>
                  Sign out
                </button>
              </form>
            </nav>
          )}
        </header>
        <main class="mx-auto w-full max-w-4xl flex-1 px-5 pb-24 lg:px-8">{children}</main>
        <footer class="space-y-3 px-5 pb-10 text-center text-base text-grey-600">
          <p>
            Built with{" "}
            <span role="img" aria-label="love">
              ❤️
            </span>{" "}
            by Marcelo Trylesinski
          </p>
          <a
            href="https://github.com/Kludex/release-gate"
            class={`${link} inline-flex items-center gap-2 text-black`}
          >
            <GitHubIcon class="size-4" />
            Kludex/release-gate
          </a>
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

type TitleProps = { title: Child; meta?: Child; subtitle?: Child };

/** A big title with the yellow blob tucked behind it, like the name on patrick.wtf. */
export const PageTitle = ({ title, meta, subtitle }: TitleProps) => (
  <div class="space-y-5 pt-10 lg:pt-16">
    <h1 class="relative isolate inline-block max-w-full break-words text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
      <Blob class="top-[0.25em] left-[0.25em] h-[1.05em] w-[1.6em]" />
      {title}
    </h1>
    {meta && <div class="flex flex-wrap items-center gap-3">{meta}</div>}
    {subtitle && (
      <p class="max-w-[50ch] text-pretty text-xl leading-relaxed lg:text-2xl">{subtitle}</p>
    )}
  </div>
);

type SectionProps = { title: string; children: Child };

export const Section = ({ title, children }: SectionProps) => (
  <section class="mt-16 space-y-6 lg:mt-20">
    <h2 class="text-2xl font-bold lg:text-3xl">{title}</h2>
    {children}
  </section>
);

/** Plain rows split by hairlines. */
export const rows = "divide-y divide-grey-200 border-y border-grey-200";

export const Empty = ({ children }: { children: Child }) => (
  <p class="text-xl text-grey-600">{children}</p>
);

/** The small uppercase line patrick.wtf puts under every title. */
export const meta = "text-sm font-semibold uppercase tracking-wide";

const TAG_COLORS = {
  grey: "bg-grey-200",
  yellow: "bg-yellow",
  sky: "bg-sky",
  mint: "bg-mint",
  rose: "bg-rose",
  black: "bg-black text-white",
  cream: "bg-cream",
};

type TagProps = { color: keyof typeof TAG_COLORS; children: Child };

/** A hand-cut sticker label. */
export const Tag = ({ color, children }: TagProps) => (
  <span
    class={`${meta} inline-block shrink-0 rounded-[55%_45%_60%_40%/60%_50%_50%_40%] px-3 py-1 text-xs ${TAG_COLORS[color]}`}
  >
    {children}
  </span>
);

const DATE = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

export const formatTime = (ms: number): string =>
  `${DATE.format(ms)} · ${new Date(ms).toISOString().slice(11, 16)} UTC`;
