import { Hono } from "hono";
import { authenticationChallenge, verifyAuthentication } from "@/auth/webauthn";
import { audit } from "@/db/audit";
import { getApprover, getPolicy, listAdminRepos, type RepoPolicy } from "@/db/repos";
import {
  type ApprovalRequest,
  getRequest,
  insertVote,
  listRequestsForApprover,
  listVotes,
  startDelivery,
  type Vote,
} from "@/db/requests";
import type { AppEnv, Env, User } from "@/env";
import { installationToken } from "@/github/app";
import { decide, deliver } from "@/github/callback";
import { previousTag, tagName } from "@/github/repo";
import { currentUser, fail, jsonBody } from "@/http";
import { voteViolation } from "@/policy";
import { Layout } from "@/ui/Layout";
import { RequestDetail } from "@/ui/RequestDetail";
import { RequestList, SignIn } from "@/ui/RequestList";

export const requests = new Hono<AppEnv>();

requests.get("/", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.html(
      <Layout title="Sign in" user={null}>
        <SignIn />
      </Layout>,
    );
  }
  const [open, recent, repos] = await Promise.all([
    listRequestsForApprover(c.env.DB, user.id, true),
    listRequestsForApprover(c.env.DB, user.id, false),
    listAdminRepos(c.env.DB, user.id),
  ]);
  return c.html(
    <Layout title="Requests" user={user}>
      <RequestList open={open} recent={recent} repos={repos} />
    </Layout>,
  );
});

requests.get("/requests/:id", async (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/");
  const { request, approver, policy } = await load(c.env, c.req.param("id"), user);
  const votes = await listVotes(c.env.DB, request.id);
  return c.html(
    <Layout title={request.repo_full_name} user={user}>
      <RequestDetail
        request={request}
        votes={votes}
        policy={policy}
        approver={approver}
        previousTag={await findPreviousTag(c.env, request)}
        approveBlocked={voteViolation(policy, request, user, "approve")}
      />
    </Layout>,
  );
});

requests.post("/requests/:id/challenge", async (c) => {
  const user = currentUser(c);
  const { action } = await jsonBody(c);
  const { request, approver, policy } = await load(c.env, c.req.param("id"), user);
  if (action === "approve" || action === "reject") {
    const violation = voteViolation(policy, request, user, action);
    if (violation) fail(403, violation);
  } else if (action === "retry") {
    checkRetry(request, approver.role);
  } else {
    fail(400, "Unknown action");
  }
  return c.json(await authenticationChallenge(c.env, user, action, request.id));
});

requests.post("/requests/:id/decision", async (c) => {
  const user = currentUser(c);
  const id = c.req.param("id");
  const verified = await verifyAuthentication(
    c.env,
    user,
    await jsonBody(c),
    ["approve", "reject"],
    id,
  );
  const vote = verified.purpose as Vote;
  const { request, policy } = await load(c.env, id, user);
  const violation = voteViolation(policy, request, user, vote);
  if (violation) fail(403, violation);
  const recorded = await insertVote(c.env.DB, {
    request_id: id,
    github_user_id: user.id,
    login: user.login,
    decision: vote,
    credential_id: verified.credentialId,
    created_at: Date.now(),
  });
  if (!recorded) fail(409, "You already voted on this request");
  const target = { actor: user, repo: request.repo_full_name, requestId: id };
  await audit(c.env.DB, { ...target, action: `vote.${vote}`, details: verified });

  if (vote === "reject") {
    await decide(c.env, request, "pending", "rejected", `Rejected by @${user.login} via passkey`);
  } else {
    const approvals = (await listVotes(c.env.DB, id)).filter((v) => v.decision === "approve");
    if (approvals.length >= policy.min_approvals) {
      const logins = approvals.map((v) => `@${v.login}`).join(", ");
      await decide(c.env, request, "pending", "approved", `Approved by ${logins} via passkey`);
    }
  }
  return c.json({ redirect: `/requests/${id}` });
});

requests.post("/requests/:id/retry-callback", async (c) => {
  const user = currentUser(c);
  const id = c.req.param("id");
  await verifyAuthentication(c.env, user, await jsonBody(c), ["retry"], id);
  const { request, approver } = await load(c.env, id, user);
  checkRetry(request, approver.role);
  const { decision, status_reason } = request as {
    decision: "approved" | "rejected";
    status_reason: string;
  };
  if (!(await startDelivery(c.env.DB, id, "error", decision, status_reason))) {
    fail(409, "Another retry is already running");
  }
  await audit(c.env.DB, {
    actor: user,
    action: "callback.retry",
    repo: request.repo_full_name,
    requestId: id,
  });
  await deliver(c.env, request);
  return c.json({ redirect: `/requests/${id}` });
});

async function load(env: Env, id: string, user: User) {
  const request = await getRequest(env.DB, id);
  const approver = request && (await getApprover(env.DB, request.repo_full_name, user.id));
  if (!request || !approver) fail(404, "Request not found");
  const policy = (await getPolicy(env.DB, request.repo_full_name)) as RepoPolicy;
  return { request, approver, policy };
}

function checkRetry(request: ApprovalRequest, role: string): void {
  if (role !== "admin") fail(403, "Only admins can retry callbacks");
  if (request.status !== "error") fail(409, "This request has no failed callback");
}

async function findPreviousTag(env: Env, request: ApprovalRequest): Promise<string | null> {
  const tag = tagName(request.ref);
  if (tag === null) return null;
  try {
    const token = await installationToken(env, request.installation_id, request.repo_full_name);
    return await previousTag(token, request.repo_full_name, tag);
  } catch {
    return null;
  }
}
