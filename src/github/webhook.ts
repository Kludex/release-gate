import { verify } from "@octokit/webhooks-methods";
import type { Context } from "hono";
import { audit } from "@/db/audit";
import { addUserRepos, getPolicy, setPolicyInstallation, upsertInstallation } from "@/db/repos";
import { type ApprovalRequest, getRequest, insertRequest, markPending } from "@/db/requests";
import type { AppEnv, Env } from "@/env";
import { installationToken } from "@/github/app";
import { decide, parseCallbackUrl } from "@/github/callback";
import { alert } from "@/notify";
import { checkRequest } from "@/policy";

type DeploymentProtectionRule = {
  action: string;
  environment: string;
  deployment_callback_url: string;
  deployment?: { ref: string; sha: string };
  repository: { full_name: string; default_branch: string; owner: { login: string } };
  installation?: { id: number };
  sender: { id: number; login: string };
};

type InstallationEvent = {
  action: string;
  repositories?: { full_name: string }[];
  repositories_added?: { full_name: string }[];
  requester?: { id: number } | null;
  sender: { id: number };
};

export async function handleWebhook(c: Context<AppEnv>): Promise<Response> {
  const body = await c.req.text();
  const signature = c.req.header("X-Hub-Signature-256");
  if (!signature || !(await verify(c.env.GITHUB_WEBHOOK_SECRET, body, signature))) {
    return c.text("Invalid signature", 401);
  }
  const payload = JSON.parse(body) as DeploymentProtectionRule & InstallationEvent;
  const event = `${c.req.header("X-GitHub-Event")}.${payload.action}`;
  if (event === "installation.created" || event === "installation_repositories.added") {
    const repos = (payload.repositories ?? payload.repositories_added) as { full_name: string }[];
    await addUserRepos(
      c.env.DB,
      [payload.sender.id, payload.requester?.id ?? payload.sender.id],
      repos.map((repo) => repo.full_name),
    );
    return c.text("Recorded");
  }
  if (event !== "deployment_protection_rule.requested") return c.text("Ignored");
  const deliveryId = c.req.header("X-GitHub-Delivery");
  const repo = payload.repository.full_name;
  const runId = parseCallbackUrl(payload.deployment_callback_url, repo);
  if (runId === null || !deliveryId || !payload.installation || !payload.deployment) {
    await audit(c.env.DB, {
      action: "webhook.invalid",
      repo,
      details: { deliveryId, callbackUrl: payload.deployment_callback_url },
    });
    return c.text("Invalid deployment protection rule payload", 400);
  }

  const id = crypto.randomUUID();
  const inserted = await insertRequest(c.env.DB, {
    id,
    delivery_id: deliveryId,
    installation_id: payload.installation.id,
    repo_full_name: repo,
    environment: payload.environment,
    run_id: runId,
    ref: payload.deployment.ref,
    sha: payload.deployment.sha,
    sender_login: payload.sender.login,
    sender_id: payload.sender.id,
    callback_url: payload.deployment_callback_url,
    created_at: Date.now(),
  });
  if (!inserted) return c.text("Duplicate delivery");

  await upsertInstallation(c.env.DB, payload.installation.id, payload.repository.owner.login);
  await audit(c.env.DB, {
    actor: payload.sender,
    action: "request.received",
    repo,
    requestId: id,
    details: { environment: payload.environment, ref: payload.deployment.ref, runId },
  });
  c.executionCtx.waitUntil(evaluate(c.env, id, payload.repository.default_branch));
  return c.text("Accepted");
}

async function evaluate(env: Env, id: string, defaultBranch: string): Promise<void> {
  const request = (await getRequest(env.DB, id)) as ApprovalRequest;
  const repo = request.repo_full_name;
  let violation: string;
  try {
    const policy = await getPolicy(env.DB, repo);
    if (!policy) {
      violation = "this repository is not configured on this release-gate instance";
    } else {
      await setPolicyInstallation(env.DB, repo, request.installation_id);
      const token = await installationToken(env, request.installation_id, repo);
      const check = await checkRequest(token, request, policy, defaultBranch);
      if ("initiatorIds" in check) {
        await markPending(env.DB, id, check.initiatorIds);
        await alert(env, { action: "request.pending", repo, requestId: id });
        return;
      }
      violation = check.violation;
    }
  } catch (error) {
    violation = `could not verify the request (${String(error)})`;
  }
  await audit(env.DB, {
    action: "request.auto_rejected",
    repo,
    requestId: id,
    details: { violation },
  });
  await decide(env, request, "checking", "rejected", `Rejected by release-gate: ${violation}`);
}
