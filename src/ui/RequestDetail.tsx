import type { Child } from "hono/jsx";
import type { Approver, RepoPolicy } from "@/db/repos";
import type { ApprovalRequest, VoteRow } from "@/db/requests";
import { Band, formatTime, link, PageTitle, rows, Section, Tag } from "@/ui/Layout";
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

/** One box per required approval, filled as approvals arrive. */
const Meter = ({ approvals, required }: { approvals: number; required: number }) => (
  <div class="flex flex-wrap items-center gap-4">
    <div class="flex" role="img" aria-label={`${approvals} of ${required} approvals`}>
      {Array.from({ length: required }, (_, index) => (
        <span
          class={`-ml-[3px] size-10 border-3 border-black first:ml-0 ${
            index < approvals ? "bg-green" : "bg-milk"
          }`}
        />
      ))}
    </div>
    <span class="text-lg font-bold">
      {approvals} of {required} {required === 1 ? "approval" : "approvals"}
    </span>
  </div>
);

const Fact = ({ label, children }: { label: string; children: Child }) => (
  <div class="grid gap-1 px-5 py-4 sm:grid-cols-[11rem_1fr] sm:gap-6">
    <dt class="text-sm font-bold uppercase sm:pt-1">{label}</dt>
    <dd class="min-w-0 break-words text-lg">{children}</dd>
  </div>
);

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
        aside={<StatusBadge status={request.status} big />}
      />
      {request.status === "pending" && (
        <Band tone="caramel">
          <Meter approvals={approvals} required={policy.min_approvals} />
          <div class="flex flex-wrap items-start gap-4">
            {approveBlocked ? (
              <p class="max-w-[60ch] border-3 border-dashed border-black bg-milk px-5 py-4 text-lg font-medium">
                {approveBlocked}
              </p>
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
        </Band>
      )}
      {request.status === "error" && approver.role === "admin" && (
        <Band tone="caramel">
          <p class="max-w-[60ch] text-lg font-medium">
            Sending the decision to GitHub failed. Send it again once GitHub is reachable.
          </p>
          <PasskeyForm
            action={`/requests/${request.id}/retry-callback`}
            challenge={challenge}
            fields={{ action: "retry" }}
            label={`Retry sending "${request.decision}" to GitHub`}
            tone="primary"
          />
        </Band>
      )}
      <Section title="What you are releasing">
        <dl class={rows}>
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
            <time>{formatTime(request.created_at)} UTC</time>
          </Fact>
          {request.status_reason && <Fact label="Outcome">{request.status_reason}</Fact>}
        </dl>
      </Section>
      {votes.length > 0 && (
        <Section title="Votes" tone="caramel">
          <ul class={rows}>
            {votes.map((vote) => (
              <li class="flex flex-wrap items-center gap-4 px-5 py-4 text-lg">
                <Tag color={vote.decision === "approve" ? "green" : "red"}>{vote.decision}</Tag>
                <strong>@{vote.login}</strong>
                <time class="ml-auto text-base">{formatTime(vote.created_at)} UTC</time>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
};
