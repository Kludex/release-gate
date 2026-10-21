import type { ApprovalRequest } from "@/db/requests";
import { ArrowIcon, Blob, GitHubIcon } from "@/ui/Icons";
import { Padlock } from "@/ui/Illustration";
import { Band, Empty, formatTime, link, PageTitle, rows, Section, Tag } from "@/ui/Layout";

type Props = {
  login: string;
  open: ApprovalRequest[];
  recent: ApprovalRequest[];
  repos: string[];
};

const STATUS_COLORS = {
  checking: "grey",
  pending: "yellow",
  delivering: "blue",
  approved: "green",
  rejected: "red",
  error: "black",
} as const;

export const StatusBadge = ({
  status,
  big,
}: {
  status: ApprovalRequest["status"];
  big?: boolean;
}) => (
  <Tag color={STATUS_COLORS[status]} big={big}>
    {status}
  </Tag>
);

export const displayRef = (ref: string): string => ref.replace(/^refs\/tags\//, "");

const Row = ({ request }: { request: ApprovalRequest }) => (
  <li>
    <a
      href={`/requests/${request.id}`}
      class="group grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-2 px-5 py-5 transition-colors hover:bg-yellow sm:grid-cols-[7.5rem_1fr_auto_auto]"
    >
      <span class="col-span-2 sm:col-span-1">
        <StatusBadge status={request.status} />
      </span>
      <span class="min-w-0">
        <span class="block break-words text-2xl font-bold leading-tight">
          {displayRef(request.ref)}
        </span>
        <span class="block break-words text-base text-grey-700">
          {request.repo_full_name} to <strong class="text-black">{request.environment}</strong>
        </span>
      </span>
      <time class="hidden text-base sm:block">{formatTime(request.created_at)}</time>
      <ArrowIcon class="size-7 transition-transform group-hover:translate-x-1" />
    </a>
  </li>
);

const List = ({ requests, empty }: { requests: ApprovalRequest[]; empty: string }) =>
  requests.length === 0 ? (
    <Empty>{empty}</Empty>
  ) : (
    <ul class={rows}>
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
      <Band tone="caramel">
        <p class="text-lg font-medium">
          You are not an approver for any repository. Ask an admin for an invite code and enter it
          on the{" "}
          <a href="/invite" class={link}>
            invite page
          </a>
          .
        </p>
      </Band>
    )}
    <Section title="Waiting for a decision">
      <List requests={open} empty="Nothing is waiting for you." />
    </Section>
    <Section title="Recent decisions" tone="caramel">
      <List requests={recent} empty="No decisions yet." />
    </Section>
    {repos.length > 0 && (
      <Section title="Repositories you administer">
        <ul class="flex flex-wrap gap-4">
          {repos.map((repo) => (
            <li>
              <a
                href={`/admin/${repo}`}
                class="flex items-center gap-4 border-3 border-black bg-cream px-5 py-4 text-lg font-bold transition-colors hover:bg-green"
              >
                {repo}
                <ArrowIcon class="size-5" />
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
    <Band>
      <div class="grid items-center gap-10 lg:grid-cols-[1fr_22rem]">
        <div class="space-y-8">
          <h1 class="text-5xl font-extrabold leading-[0.95] tracking-tight lg:text-[5.5rem]">
            Every release waits for a{" "}
            <span class="relative isolate inline-block">
              <Blob />
              passkey.
            </span>
          </h1>
          <p class="max-w-[46ch] text-lg font-medium lg:text-2xl">
            Releases on protected environments wait here until an approver confirms with a passkey.
          </p>
          <a
            href="/auth/login"
            class="inline-flex items-center gap-3 border-3 border-black bg-coral px-7 py-4 text-base font-bold uppercase leading-none transition-colors hover:bg-green lg:px-9 lg:py-5 lg:text-lg"
          >
            <GitHubIcon class="size-6" />
            Sign in with GitHub
          </a>
        </div>
        <Padlock class="mx-auto w-56 lg:w-full" />
      </div>
    </Band>
    <Band tone="caramel">
      <ol class="grid divide-y-3 divide-black border-3 border-black bg-cream md:grid-cols-3 md:divide-x-3 md:divide-y-0">
        {STEPS.map(([title, text], index) => (
          <li class="space-y-3 p-6">
            <span class="grid size-10 place-items-center border-3 border-black bg-yellow text-lg font-extrabold">
              {index + 1}
            </span>
            <h2 class="text-2xl font-bold leading-tight">{title}</h2>
            <p class="text-base">{text}</p>
          </li>
        ))}
      </ol>
    </Band>
  </>
);
