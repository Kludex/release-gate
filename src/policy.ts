import type { RepoPolicy } from "@/db/repos";
import type { ApprovalRequest, Vote } from "@/db/requests";
import type { User } from "@/env";
import { isOnBranch, runInitiators, tagCommit, tagName } from "@/github/repo";

export type RequestCheck = { violation: string } | { initiatorIds: number[] };

export async function checkRequest(
  token: string,
  request: ApprovalRequest,
  policy: RepoPolicy,
  defaultBranch: string,
): Promise<RequestCheck> {
  const repo = request.repo_full_name;
  const tag = tagName(request.ref);
  if (tag === null) return { violation: `\`${request.ref}\` is not a tag` };
  const commit = await tagCommit(token, repo, tag);
  if (commit === null) return { violation: `\`${tag}\` is not a tag` };
  if (commit !== request.sha) {
    return { violation: `Tag \`${tag}\` points to ${commit}, not ${request.sha}` };
  }
  if (
    policy.require_default_branch &&
    !(await isOnBranch(token, repo, defaultBranch, request.sha))
  ) {
    return { violation: `${request.sha} is not on the default branch \`${defaultBranch}\`` };
  }
  const runActors = await runInitiators(token, repo, request.run_id);
  return { initiatorIds: [...new Set([request.sender_id, ...runActors])] };
}

export function voteViolation(
  policy: RepoPolicy,
  request: ApprovalRequest,
  user: User,
  vote: Vote,
): string | null {
  if (request.status !== "pending") return "This request is no longer pending";
  const initiators = JSON.parse(request.initiator_ids) as number[];
  if (vote === "approve" && policy.prevent_self_review && initiators.includes(user.id)) {
    return "You started this deployment and self-review is prevented";
  }
  return null;
}
