import { audit } from "@/db/audit";
import { type ApprovalRequest, type Decision, finishDelivery, startDelivery } from "@/db/requests";
import type { Env } from "@/env";
import { GitHubError, githubFetch, installationToken } from "@/github/app";

const CALLBACK_URL =
  /^https:\/\/api\.github\.com\/repos\/([^/]+\/[^/]+)\/actions\/runs\/(\d+)\/deployment_protection_rule$/;

export function parseCallbackUrl(url: string, repoFullName: string): number | null {
  const match = CALLBACK_URL.exec(url);
  if (!match || match[1] !== repoFullName) return null;
  return Number(match[2]);
}

/** Moves a request from `from` to a final decision and tells GitHub, unless another worker already did. */
export async function decide(
  env: Env,
  request: ApprovalRequest,
  from: ApprovalRequest["status"],
  decision: Decision,
  comment: string,
): Promise<void> {
  if (await startDelivery(env.DB, request.id, from, decision, comment)) {
    await deliver(env, { ...request, decision, status_reason: comment });
  }
}

export async function deliver(env: Env, request: ApprovalRequest): Promise<void> {
  const state = request.decision as Decision;
  const target = { repo: request.repo_full_name, requestId: request.id };
  try {
    const token = await installationToken(env, request.installation_id, request.repo_full_name);
    const response = await githubFetch(request.callback_url, token, {
      method: "POST",
      body: JSON.stringify({
        environment_name: request.environment,
        state,
        comment: request.status_reason,
      }),
    });
    if (!response.ok) throw new GitHubError(`Callback failed with HTTP ${response.status}`);
  } catch (error) {
    await finishDelivery(env.DB, request.id, "error");
    await audit(env.DB, {
      ...target,
      action: "callback.failed",
      details: { state, error: String(error) },
    });
    return;
  }
  await finishDelivery(env.DB, request.id, state);
  await audit(env.DB, { ...target, action: "callback.delivered", details: { state } });
}
