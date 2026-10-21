import type { Approver, RepoPolicy } from "@/db/repos";
import type { ApprovalRequest, VoteRow } from "@/db/requests";
import { Card, formatTime, Section } from "@/ui/Layout";
import { PasskeyForm } from "@/ui/PasskeyForm";
import { displayRef, StatusBadge } from "@/ui/RequestList";

type Props = {
  request: ApprovalRequest;
  votes: VoteRow[];
  policy: RepoPolicy;
  approver: Approver;
  previousTag: string | null;
  approveBlocked: string | null;
};

export const RequestDetail = ({
  request,
  votes,
  policy,
  approver,
  previousTag,
  approveBlocked,
}: Props) => {
  const repoUrl = `https://github.com/${request.repo_full_name}`;
  const tag = displayRef(request.ref);
  const approvals = votes.filter((vote) => vote.decision === "approve").length;
  const challenge = `/requests/${request.id}/challenge`;
  return (
    <>
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-semibold">
          {request.repo_full_name} <span class="font-mono">{tag}</span>
        </h1>
        <StatusBadge status={request.status} />
      </div>
      <Card>
        <dl class="grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
          <dt class="text-stone-500">Environment</dt>
          <dd>{request.environment}</dd>
          <dt class="text-stone-500">Commit</dt>
          <dd>
            <a href={`${repoUrl}/commit/${request.sha}`} class="font-mono underline">
              {request.sha.slice(0, 12)}
            </a>
          </dd>
          <dt class="text-stone-500">Pushed by</dt>
          <dd>@{request.sender_login}</dd>
          <dt class="text-stone-500">Workflow run</dt>
          <dd>
            <a href={`${repoUrl}/actions/runs/${request.run_id}`} class="underline">
              #{request.run_id}
            </a>
          </dd>
          <dt class="text-stone-500">Changes</dt>
          <dd>
            {previousTag ? (
              <a href={`${repoUrl}/compare/${previousTag}...${tag}`} class="underline">
                {previousTag}...{tag}
              </a>
            ) : (
              "No previous tag found"
            )}
          </dd>
          <dt class="text-stone-500">Approvals</dt>
          <dd>
            {approvals} of {policy.min_approvals}
          </dd>
          <dt class="text-stone-500">Requested</dt>
          <dd>{formatTime(request.created_at)}</dd>
          {request.status_reason && (
            <>
              <dt class="text-stone-500">Outcome</dt>
              <dd>{request.status_reason}</dd>
            </>
          )}
        </dl>
      </Card>
      {votes.length > 0 && (
        <Section title="Votes">
          <ul class="space-y-1 text-sm">
            {votes.map((vote) => (
              <li>
                @{vote.login} voted <strong>{vote.decision}</strong> at{" "}
                {formatTime(vote.created_at)}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {request.status === "pending" && (
        <div class="flex flex-wrap items-start gap-4">
          {approveBlocked ? (
            <p class="text-sm text-stone-600">{approveBlocked}</p>
          ) : (
            <PasskeyForm
              action={`/requests/${request.id}/decision`}
              challenge={challenge}
              fields={{ action: "approve" }}
              label="Approve with passkey"
              tone="primary"
            />
          )}
          <PasskeyForm
            action={`/requests/${request.id}/decision`}
            challenge={challenge}
            fields={{ action: "reject" }}
            label="Reject"
            tone="danger"
          />
        </div>
      )}
      {request.status === "error" && approver.role === "admin" && (
        <PasskeyForm
          action={`/requests/${request.id}/retry-callback`}
          challenge={challenge}
          fields={{ action: "retry" }}
          label={`Retry sending "${request.decision}" to GitHub`}
        />
      )}
    </>
  );
};
