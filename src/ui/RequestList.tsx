import type { ApprovalRequest } from "@/db/requests";
import { Blob, GitHubIcon } from "@/ui/Icons";
import { Padlock } from "@/ui/Illustration";
import { Empty, formatTime, link, meta, PageTitle, Section, Tag } from "@/ui/Layout";

type Props = {
  login: string;
  open: ApprovalRequest[];
  recent: ApprovalRequest[];
  repos: string[];
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

export const RequestList = ({ login, open, recent, repos }: Props) => (
  <>
    <PageTitle
      title="Releases"
      subtitle={`Hi @${login}. Tag pushes to protected environments wait here for your passkey.`}
    />
    {repos.length === 0 && (
      <p class="mt-10 max-w-[60ch] rounded-3xl bg-cream px-6 py-5 text-xl">
        You are not an approver for any repository. Ask an admin for an invite code and enter it on
        the{" "}
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
  </>
);

const STEPS = [
  ["A tag push pauses the job", "GitHub holds the deployment and asks release-gate."],
  ["An approver reviews it", "Tag, commit, workflow run and the diff since the last release."],
  ["A passkey releases it", "Touch ID or a security key. A stolen token is not enough."],
];

export const SignIn = () => (
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
          href="/auth/login"
          class="inline-flex items-center gap-3 rounded-full border-2 border-black bg-black px-6 py-3 text-lg font-semibold text-white transition hover:-rotate-2 hover:bg-yellow hover:text-black motion-reduce:hover:rotate-0"
        >
          <GitHubIcon class="size-5" />
          Sign in with GitHub
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
