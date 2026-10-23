import type { UserRepo } from "@/db/repos";
import type { ApprovalRequest } from "@/db/requests";
import { ConnectGuide } from "@/ui/ConnectGuide";
import { GitHubIcon } from "@/ui/Icons";
import { Empty, formatTime, link, meta, PageTitle, Section, Tag } from "@/ui/Layout";
import { Field, PasskeyForm, Select } from "@/ui/PasskeyForm";

type Props = {
  login: string;
  hasPasskey: boolean;
  open: ApprovalRequest[];
  recent: ApprovalRequest[];
  repos: string[];
  installed: UserRepo[];
  installUrl: string;
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

export const RequestList = ({
  login,
  hasPasskey,
  open,
  recent,
  repos,
  installed,
  installUrl,
}: Props) => {
  const claimable = installed.filter((repo) => !repo.claimed).map((repo) => repo.repo_full_name);
  const subtitle = `Hi @${login}. Tag pushes to protected environments wait here for your passkey.`;
  const setUp = claimable.length > 0 && (
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
  );
  const install = (
    <a
      href={installUrl}
      class={`inline-flex items-center gap-2.5 rounded-full border-2 border-black font-semibold transition hover:-rotate-2 motion-reduce:hover:rotate-0 ${
        claimable.length > 0
          ? "bg-white px-4 py-1.5 text-base hover:bg-yellow"
          : "bg-black px-6 py-3 text-lg text-white hover:bg-yellow hover:text-black"
      }`}
    >
      <GitHubIcon class="size-5 shrink-0" />
      {claimable.length > 0 ? "Install on another repository" : "Install on GitHub"}
    </a>
  );
  if (repos.length === 0) {
    return (
      <>
        <PageTitle title="Get started" subtitle={subtitle} />
        <ol class="mt-12 max-w-[60ch] list-decimal space-y-12 pl-8 text-xl leading-relaxed marker:text-2xl marker:font-bold lg:mt-16">
          <li class="space-y-4">
            <h2 class="text-2xl font-bold">Install the app on your repository</h2>
            <p>In an organization, an owner approves the install first.</p>
            {install}
          </li>
          <li class="space-y-4">
            <h2 class="text-2xl font-bold">Set it up here</h2>
            {setUp || (
              <p class="text-grey-600">
                {installed.length > 0
                  ? "Every repository you administer with the app installed is already set up. Ask one of its admins for an invite."
                  : "Repositories you administer show up here once the app is installed on them."}
              </p>
            )}
          </li>
          <li class="space-y-4">
            <h2 class="text-2xl font-bold">Connect your workflow</h2>
            <p>
              The publishing job runs in an environment, and that environment waits for
              release-gate.
            </p>
            <ConnectGuide />
          </li>
        </ol>
        <p class="mt-16 max-w-[60ch] text-lg text-grey-600">
          Joining a repository that is already set up? Enter the invite code from its admin on the{" "}
          <a href="/invite" class={link}>
            invite page
          </a>
          .
        </p>
      </>
    );
  }
  return (
    <>
      <PageTitle title="Releases" subtitle={subtitle} />
      <Section title="Waiting for a decision">
        <List requests={open} empty="Nothing is waiting for you." />
      </Section>
      <Section title="Recent decisions">
        <List requests={recent} empty="No decisions yet." />
      </Section>
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
      <Section title="Set up a repository">
        <p class="max-w-[60ch] text-xl">
          {claimable.length > 0
            ? "Pick a repository you administer on GitHub that has the release-gate app installed. You become its first admin."
            : "Install the release-gate app on another repository you administer to add it. In an organization, an owner approves the install first."}
        </p>
        {setUp}
        <div>{install}</div>
      </Section>
    </>
  );
};
