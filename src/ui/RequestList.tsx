import type { UserRepo } from "@/db/repos";
import type { ApprovalRequest } from "@/db/requests";
import { Blob, GitHubIcon } from "@/ui/Icons";
import { Padlock } from "@/ui/Illustration";
import { Empty, formatTime, link, meta, PageTitle, Section, Tag } from "@/ui/Layout";
import { Field, PasskeyForm, Select } from "@/ui/PasskeyForm";

type Props = {
  login: string;
  hasPasskey: boolean;
  open: ApprovalRequest[];
  recent: ApprovalRequest[];
  repos: string[];
  installed: UserRepo[];
};

const STATUS_COLORS = {
  checking: "grey",
  pending: "yellow",
  delivering: "sky",
  approved: "mint",
  rejected: "rose",
  error: "black",
} as const;

export const StatusBadge = ({ status }: { status: ApprovalRequest["status"] }) => (
  <Tag color={STATUS_COLORS[status]}>{status}</Tag>
);

export const displayRef = (ref: string): string => ref.replace(/^refs\/tags\//, "");

const Row = ({ request }: { request: ApprovalRequest }) => (
  <li>
    <a href={`/requests/${request.id}`} class="group block space-y-2">
      <span class="block break-words text-3xl font-bold leading-tight">
        <span class="underline decoration-yellow decoration-[0.2em] underline-offset-[0.1em] transition-colors group-hover:decoration-black">
          {displayRef(request.ref)}
        </span>
      </span>
      <span class={`${meta} flex flex-wrap items-center gap-x-3 gap-y-1`}>
        <StatusBadge status={request.status} />
        <time>{formatTime(request.created_at)}</time>
      </span>
      <span class="block break-words text-xl">
        {request.repo_full_name} to <strong class="font-semibold">{request.environment}</strong>
      </span>
    </a>
  </li>
);

const List = ({ requests, empty }: { requests: ApprovalRequest[]; empty: string }) =>
  requests.length === 0 ? (
    <Empty>{empty}</Empty>
  ) : (
    <ul class="space-y-10">
      {requests.map((request) => (
        <Row request={request} />
      ))}
    </ul>
  );

export const RequestList = ({ login, hasPasskey, open, recent, repos, installed }: Props) => {
  const claimable = installed.filter((repo) => !repo.claimed).map((repo) => repo.repo_full_name);
  return (
    <>
      <PageTitle
        title="Releases"
        subtitle={`Hi @${login}. Tag pushes to protected environments wait here for your passkey.`}
      />
      {repos.length === 0 && (
        <p class="mt-10 max-w-[60ch] rounded-3xl bg-cream px-6 py-5 text-xl">
          You are not an approver for any repository yet. Set up one you administer on GitHub below,
          or enter an invite code from an admin on the{" "}
          <a href="/invite" class={link}>
            invite page
          </a>
          .
        </p>
      )}
      <Section title="Waiting for a decision">
        <List requests={open} empty="Nothing is waiting for you." />
      </Section>
      <Section title="Recent decisions">
        <List requests={recent} empty="No decisions yet." />
      </Section>
      {repos.length > 0 && (
        <Section title="Repositories you administer">
          <ul class="space-y-3 text-xl">
            {repos.map((repo) => (
              <li>
                <a href={`/admin/${repo}`} class={link}>
                  {repo}
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title="Set up a repository">
        <p class="mb-8 max-w-[60ch] text-xl">
          {installed.length === 0
            ? "Install the release-gate app on a repository you administer on GitHub, then "
            : claimable.length === 0
              ? "Every repository you administer with the release-gate app installed is already set up. To add another, install the app on it, then "
              : "Pick a repository you administer on GitHub that has the release-gate app installed. You become its first admin. Missing one? Install the app on it, then "}
          <a href="/auth/login" class={link}>
            refresh the list
          </a>
          .
        </p>
        {claimable.length > 0 && (
          <PasskeyForm
            action="/repos"
            challenge={hasPasskey ? "/repos/challenge" : undefined}
            label={hasPasskey ? "Set up repository" : "Register a passkey and set up"}
          >
            <Field label="Repository">
              <span class="block max-w-md font-mono">
                <Select name="repo" options={claimable} />
              </span>
            </Field>
          </PasskeyForm>
        )}
      </Section>
    </>
  );
};

const STEPS = [
  ["A tag push pauses the job", "GitHub holds the deployment and asks release-gate."],
  ["An approver reviews it", "Tag, commit, workflow run and the diff since the last release."],
  ["A passkey releases it", "Touch ID or a security key. A stolen token is not enough."],
];

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
    <Section title="How it works">
      <ol class="grid gap-10 md:grid-cols-3">
        {STEPS.map(([title, text], index) => (
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
    </Section>
  </>
);
