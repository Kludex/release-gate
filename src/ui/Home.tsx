import { Blob, GitHubIcon } from "@/ui/Icons";
import { Padlock } from "@/ui/Illustration";
import { link, meta, Section } from "@/ui/Layout";

const INCIDENT = "https://docs.litellm.ai/blog/security-incident-oct-21-2026";

const TIMELINE = [
  ["11:11", "A stolen token approves the production release."],
  ["11:39", "Malicious wheels land on PyPI."],
  ["13:23", "PyPI removes them, two hours later."],
];

const STEPS = [
  ["A tag push pauses the job", "GitHub holds the deployment and asks release-gate."],
  ["An approver reviews it", "Tag, commit, workflow run and the diff since the last release."],
  ["A passkey releases it", "Touch ID or a security key. A stolen token is not enough."],
];

const SETUP = [
  [
    "Install the app",
    "On the repository that publishes releases. In an organization, an owner approves it.",
  ],
  ["Set it up here", "Sign in with GitHub, pick the repository and register a passkey."],
  [
    "Protect the environment",
    "Run the publishing job in an environment, and enable release-gate on it.",
  ],
];

const Steps = ({ steps }: { steps: string[][] }) => (
  <ol class="grid gap-10 md:grid-cols-3">
    {steps.map(([title, text], index) => (
      <li class="space-y-2">
        <span class="relative isolate grid size-12 place-items-center font-display text-2xl">
          <Blob class="inset-0 size-full" />
          {index + 1}
        </span>
        <h3 class="text-balance text-2xl font-bold leading-tight">{title}</h3>
        <p class="text-lg leading-relaxed">{text}</p>
      </li>
    ))}
  </ol>
);

export const Home = ({ signedIn }: { signedIn: boolean }) => (
  <>
    <div class="grid items-center gap-12 pt-10 lg:grid-cols-[1fr_20rem] lg:pt-16">
      <div class="space-y-8">
        <h1 class="text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
          Every release waits for a{" "}
          <span class="relative isolate inline-block">
            <Blob class="top-[0.3em] left-[0.5em] h-[0.95em] w-[1.6em]" />
            passkey.
          </span>
        </h1>
        <p class="max-w-[42ch] text-xl leading-relaxed lg:text-2xl">
          Releases on protected environments wait here until an approver confirms with a passkey.
        </p>
        <a
          href={signedIn ? "/releases" : "/auth/login"}
          class="inline-flex items-center gap-3 rounded-full border-2 border-black bg-black px-6 py-3 text-lg font-semibold text-white transition hover:-rotate-2 hover:bg-yellow hover:text-black motion-reduce:hover:rotate-0"
        >
          {signedIn ? (
            "Open your releases"
          ) : (
            <>
              <GitHubIcon class="size-5" />
              Sign in with GitHub
            </>
          )}
        </a>
      </div>
      <Padlock class="mx-auto w-60 rotate-6 lg:w-full" />
    </div>
    <Section title="Why this exists">
      <div class="grid gap-10 lg:grid-cols-[1fr_18rem]">
        <div class="max-w-[60ch] space-y-5 text-xl leading-relaxed">
          <p>
            On October 21, 2026, LiteLLM 1.107.0 reached PyPI and Docker Hub with a credential
            stealer inside. The release workflow had a required approval. The attacker passed it
            with a GitHub token stolen from a maintainer.
          </p>
          <p>
            This can happen to any project. Tokens leak through logs, laptops, CI caches and AI
            tools. Any of them can click "Approve" on GitHub. None of them can produce a passkey,
            and release-gate only accepts a passkey.
          </p>
          <p>
            <a href={INCIDENT} class={link}>
              Read LiteLLM's incident report
            </a>
          </p>
        </div>
        <ol class="space-y-4 self-start rounded-3xl bg-cream p-6">
          {TIMELINE.map(([time, text]) => (
            <li>
              <span class={`${meta} block text-grey-600`}>{time} UTC</span>
              <span class="text-lg leading-snug">{text}</span>
            </li>
          ))}
        </ol>
      </div>
      <p class="max-w-[60ch] text-lg text-grey-600">
        A stolen token of an organization owner can still remove the rule from the environment. Keep
        owners few, and protect their accounts with passkeys too.
      </p>
    </Section>
    <Section title="How it works">
      <Steps steps={STEPS} />
    </Section>
    <Section title="Set it up">
      <Steps steps={SETUP} />
    </Section>
  </>
);
