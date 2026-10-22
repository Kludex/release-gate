import { type Context, Hono } from "hono";
import {
  authenticationChallenge,
  registrationChallenge,
  verifyAuthentication,
} from "@/auth/webauthn";
import { claimableRepo, claimStatements, REPO_NAME } from "@/claim";
import { audit, listAudit } from "@/db/audit";
import { listCredentials } from "@/db/credentials";
import { insertInvite, listOpenInvites } from "@/db/enrollment";
import {
  getApprover,
  getPolicy,
  listAdminRepos,
  listApprovers,
  type RepoPolicy,
  removeApprover,
  updatePolicy,
} from "@/db/repos";
import type { AppEnv, User } from "@/env";
import {
  type Body,
  currentUser,
  fail,
  jsonBody,
  randomToken,
  sha256Hex,
  stringField,
} from "@/http";
import { Admin } from "@/ui/Admin";
import { Audit } from "@/ui/Audit";
import { Layout } from "@/ui/Layout";

const INVITE_TTL_MS = 24 * 60 * 60 * 1000;
const LOGIN = /^[A-Za-z0-9-]{1,39}$/;

export const admin = new Hono<AppEnv>();

admin.post("/repos/challenge", async (c) => {
  return c.json(await authenticationChallenge(c.env, currentUser(c), "add-repo"));
});

admin.post("/repos", async (c) => {
  const user = currentUser(c);
  const body = await jsonBody(c);
  const name = stringField(body, "repo").trim();
  if (!REPO_NAME.test(name)) fail(400, "Enter the repository as owner/name");
  const hasPasskey = (await listCredentials(c.env.DB, user.id)).length > 0;
  if (hasPasskey) await verifyAuthentication(c.env, user, body, ["add-repo"]);
  const repo = await claimableRepo(c.env, user, name);
  if (!hasPasskey) {
    return c.json({ registration: await registrationChallenge(c.env, user, `claim:${repo}`) });
  }
  await c.env.DB.batch(claimStatements(c.env.DB, user, repo));
  await audit(c.env.DB, { actor: user, action: "repo.claimed", repo });
  return c.json({ redirect: `/admin/${repo}` });
});

admin.get("/audit", async (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/");
  const entries = await listAudit(c.env.DB, await listAdminRepos(c.env.DB, user.id));
  return c.html(
    <Layout title="Audit log" user={user} page="audit">
      <Audit entries={entries} />
    </Layout>,
  );
});

admin.get("/admin/:owner/:repo", async (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/");
  const { repo, policy } = await requireAdmin(c, user);
  const [approvers, invites] = await Promise.all([
    listApprovers(c.env.DB, repo),
    listOpenInvites(c.env.DB, repo),
  ]);
  return c.html(
    <Layout title={repo} user={user}>
      <Admin repo={repo} policy={policy} approvers={approvers} invites={invites} />
    </Layout>,
  );
});

admin.post("/admin/:owner/:repo/challenge", async (c) => {
  const user = currentUser(c);
  const { repo } = await requireAdmin(c, user);
  return c.json(await authenticationChallenge(c.env, user, `admin:${repo}`));
});

admin.post("/admin/:owner/:repo/policy", async (c) => {
  const { user, repo, body } = await verifiedAdmin(c);
  const minApprovals = Number(body.min_approvals);
  if (!Number.isInteger(minApprovals) || minApprovals < 1 || minApprovals > 10) {
    fail(400, "Minimum approvals must be between 1 and 10");
  }
  const policy = {
    min_approvals: minApprovals,
    prevent_self_review: body.prevent_self_review === "1" ? 1 : 0,
    require_default_branch: body.require_default_branch === "1" ? 1 : 0,
  };
  await updatePolicy(c.env.DB, repo, policy);
  await audit(c.env.DB, { actor: user, action: "policy.updated", repo, details: policy });
  return c.json({ redirect: `/admin/${repo}` });
});

admin.post("/admin/:owner/:repo/invites", async (c) => {
  const { user, repo, body } = await verifiedAdmin(c);
  const login = stringField(body, "login").replace(/^@/, "");
  const role = body.role === "admin" ? "admin" : "approver";
  if (!LOGIN.test(login)) fail(400, "Invalid GitHub login");
  const code = randomToken();
  await insertInvite(c.env.DB, {
    code_hash: await sha256Hex(code),
    repo_full_name: repo,
    github_login: login,
    role,
    created_by: user.id,
    expires_at: Date.now() + INVITE_TTL_MS,
  });
  await audit(c.env.DB, { actor: user, action: "invite.created", repo, details: { login, role } });
  return c.json({
    message: `Invite code for @${login}: ${code}. It is shown once and expires in 24 hours. Send it outside this app.`,
  });
});

admin.post("/admin/:owner/:repo/approvers/remove", async (c) => {
  const { user, repo, body } = await verifiedAdmin(c);
  const userId = Number(body.user_id);
  const removed = await removeApprover(c.env.DB, repo, userId);
  if (removed === "missing") fail(404, "Approver not found");
  if (removed === "last-admin") fail(409, "Add another admin before removing the last one");
  await audit(c.env.DB, { actor: user, action: "approver.removed", repo, details: { userId } });
  return c.json({ redirect: `/admin/${repo}` });
});

async function requireAdmin(
  c: Context<AppEnv>,
  user: User,
): Promise<{ repo: string; policy: RepoPolicy }> {
  const repo = `${c.req.param("owner")}/${c.req.param("repo")}`;
  const approver = await getApprover(c.env.DB, repo, user.id);
  const policy = await getPolicy(c.env.DB, repo);
  if (approver?.role !== "admin" || !policy) fail(404, "Repository not found");
  return { repo, policy };
}

async function verifiedAdmin(
  c: Context<AppEnv>,
): Promise<{ user: User; repo: string; body: Body }> {
  const user = currentUser(c);
  const { repo } = await requireAdmin(c, user);
  const body = await jsonBody(c);
  await verifyAuthentication(c.env, user, body, [`admin:${repo}`]);
  return { user, repo, body };
}
