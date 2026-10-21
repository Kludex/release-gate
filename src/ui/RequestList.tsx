import type { ApprovalRequest } from "@/db/requests";
import { Card, formatTime, Section } from "@/ui/Layout";

type Props = { open: ApprovalRequest[]; recent: ApprovalRequest[]; repos: string[] };

const STATUS_STYLES: Record<ApprovalRequest["status"], string> = {
  checking: "bg-stone-100 text-stone-700",
  pending: "bg-amber-100 text-amber-800",
  delivering: "bg-sky-100 text-sky-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  error: "bg-red-100 text-red-800",
};

export const StatusBadge = ({ status }: { status: ApprovalRequest["status"] }) => (
  <span class={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
    {status}
  </span>
);

export const displayRef = (ref: string): string => ref.replace(/^refs\/tags\//, "");

const Row = ({ request }: { request: ApprovalRequest }) => (
  <li>
    <a
      href={`/requests/${request.id}`}
      class="flex items-center gap-3 px-4 py-3 text-sm hover:bg-stone-50"
    >
      <StatusBadge status={request.status} />
      <span class="font-medium">{request.repo_full_name}</span>
      <span class="font-mono">{displayRef(request.ref)}</span>
      <span class="text-stone-500">→ {request.environment}</span>
      <span class="ml-auto text-stone-500">{formatTime(request.created_at)}</span>
    </a>
  </li>
);

const List = ({ requests, empty }: { requests: ApprovalRequest[]; empty: string }) =>
  requests.length === 0 ? (
    <p class="text-sm text-stone-500">{empty}</p>
  ) : (
    <ul class="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
      {requests.map((request) => (
        <Row request={request} />
      ))}
    </ul>
  );

export const RequestList = ({ open, recent, repos }: Props) => (
  <>
    {repos.length === 0 && (
      <Card>
        <p class="text-sm">
          You are not an approver for any repository. Ask an admin for an invite code and enter it
          on the{" "}
          <a href="/invite" class="underline">
            invite page
          </a>
          .
        </p>
      </Card>
    )}
    <Section title="Waiting for a decision">
      <List requests={open} empty="Nothing is waiting for you." />
    </Section>
    <Section title="Recent decisions">
      <List requests={recent} empty="No decisions yet." />
    </Section>
    {repos.length > 0 && (
      <Section title="Repositories">
        <ul class="space-y-1 text-sm">
          {repos.map((repo) => (
            <li>
              <a href={`/admin/${repo}`} class="underline">
                {repo}
              </a>
            </li>
          ))}
        </ul>
      </Section>
    )}
  </>
);

export const SignIn = () => (
  <Card>
    <div class="space-y-3 text-sm">
      <p>Releases on protected environments wait here until an approver confirms with a passkey.</p>
      <a
        href="/auth/login"
        class="inline-block rounded-md bg-stone-800 px-4 py-2 font-medium text-white hover:bg-stone-900"
      >
        Sign in with GitHub
      </a>
    </div>
  </Card>
);
