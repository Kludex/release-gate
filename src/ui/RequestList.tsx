import type { UserRepo } from "@/db/repos";
import type { ApprovalRequest } from "@/db/requests";
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
            ? "Install the release-gate app on a repository you administer on GitHub. You come back here to set it up and become its first admin."
            : claimable.length === 0
              ? "Every repository you administer with the release-gate app installed is already set up. Install the app on another one to add it."
              : "Pick a repository you administer on GitHub that has the release-gate app installed. You become its first admin."}
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
        <a
          href={installUrl}
          class={`inline-flex items-center gap-2.5 rounded-full border-2 border-black font-semibold transition hover:-rotate-2 motion-reduce:hover:rotate-0 ${
            claimable.length > 0
              ? "mt-6 bg-white px-4 py-1.5 text-base hover:bg-yellow"
              : "bg-black px-6 py-3 text-lg text-white hover:bg-yellow hover:text-black"
          }`}
        >
          <GitHubIcon class="size-5 shrink-0" />
          {claimable.length > 0 ? "Install on another repository" : "Install on GitHub"}
        </a>
      </Section>
    </>
  );
};
