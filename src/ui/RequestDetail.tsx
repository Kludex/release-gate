import type { Child } from "hono/jsx";
import type { Approver, RepoPolicy } from "@/db/repos";
import type { ApprovalRequest, VoteRow } from "@/db/requests";
import { formatTime, link, meta, PageTitle, Section } from "@/ui/Layout";
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

/** One dot per required approval, filled as approvals arrive. */
const Meter = ({ approvals, required }: { approvals: number; required: number }) => (
  <div class="flex flex-wrap items-center gap-3">
    <div class="flex gap-1.5" role="img" aria-label={`${approvals} of ${required} approvals`}>
      {Array.from({ length: required }, (_, index) => (
        <span
          class={`size-5 rounded-full border-2 border-black ${index < approvals ? "bg-black" : "bg-white"}`}
        />
      ))}
    </div>
    <span class="font-semibold">
      {approvals} of {required} {required === 1 ? "approval" : "approvals"}
    </span>
  </div>
);

const Fact = ({ label, children }: { label: string; children: Child }) => (
  <div class="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-6">
    <dt class={`${meta} text-grey-600 sm:pt-1`}>{label}</dt>
    <dd class="min-w-0 break-words text-xl">{children}</dd>
  </div>
);

const panel = "mt-10 space-y-6 rounded-[2rem] bg-cream px-6 py-7 lg:px-10 lg:py-9";

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
      <PageTitle
        title={tag}
        subtitle={
          <>
            <a href={repoUrl} class={link}>
              {request.repo_full_name}
            </a>{" "}
            to <strong>{request.environment}</strong>.
          </>
        }
        meta={<StatusBadge status={request.status} />}
      />
      {request.status === "pending" && (
        <div class={panel}>
          <Meter approvals={approvals} required={policy.min_approvals} />
          <div class="flex flex-wrap items-start gap-4">
            {approveBlocked ? (
              <p class="max-w-[48ch] self-center text-lg text-grey-600">{approveBlocked}</p>
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
        </div>
      )}
      {request.status === "error" && approver.role === "admin" && (
        <div class={panel}>
          <p class="max-w-[60ch] text-xl">
            Sending the decision to GitHub failed. Send it again once GitHub is reachable.
          </p>
          <PasskeyForm
            action={`/requests/${request.id}/retry-callback`}
            challenge={challenge}
            fields={{ action: "retry" }}
            label={`Retry sending "${request.decision}" to GitHub`}
            tone="primary"
          />
        </div>
      )}
      <Section title="What you are releasing">
        <dl class="space-y-5">
          <Fact label="Commit">
            <a href={`${repoUrl}/commit/${request.sha}`} class={`${link} font-mono`}>
              {request.sha.slice(0, 12)}
            </a>
          </Fact>
          <Fact label="Changes">
            {previousTag ? (
              <a href={`${repoUrl}/compare/${previousTag}...${tag}`} class={`${link} font-mono`}>
                {previousTag}...{tag}
              </a>
            ) : (
              "No previous tag found"
            )}
          </Fact>
          <Fact label="Workflow run">
            <a href={`${repoUrl}/actions/runs/${request.run_id}`} class={link}>
              #{request.run_id}
            </a>
          </Fact>
          <Fact label="Pushed by">@{request.sender_login}</Fact>
          <Fact label="Requested">
            <time>{formatTime(request.created_at)}</time>
          </Fact>
          {request.status_reason && <Fact label="Outcome">{request.status_reason}</Fact>}
        </dl>
      </Section>
      {votes.length > 0 && (
        <Section title="Votes">
          <ul class="space-y-4">
            {votes.map((vote) => (
              <li class="space-y-1">
                <p class="text-xl">
                  <strong class="font-semibold">@{vote.login}</strong>{" "}
                  {vote.decision === "approve" ? "approved" : "rejected"}
                </p>
                <time class={`${meta} block text-grey-600`}>{formatTime(vote.created_at)}</time>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
};
