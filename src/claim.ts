import { ensurePolicy, listApprovers, upsertApprover } from "@/db/repos";
import type { Env, User } from "@/env";
import { githubFetch, githubJson, installationToken, repoInstallation } from "@/github/app";
import { fail } from "@/http";

export const REPO_NAME = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;

/**
 * GitHub is the root of trust: the app must be installed on the repository and the user must
 * be one of its GitHub admins, who could remove the protection rule anyway.
 * Returns the repository name with GitHub's casing.
 */
export async function claimableRepo(env: Env, user: User, name: string): Promise<string> {
  const installation = await repoInstallation(env, name);
  if (installation === null) fail(404, "Install the release-gate app on this repository first");
  const token = await installationToken(env, installation, name);
  const { full_name: repo } = await githubJson<{ full_name: string }>(`/repos/${name}`, token);
  const response = await githubFetch(
    `/repos/${repo}/collaborators/${user.login}/permission`,
    token,
  );
  const access = response.ok
    ? await response.json<{ permission: string; user: { id: number } | null }>()
    : null;
  if (access?.permission !== "admin" || access.user?.id !== user.id) {
    fail(403, "Only admins of the repository on GitHub can set it up");
  }
  // shortcut: two GitHub admins claiming at the same instant can both succeed, which is harmless.
  if ((await listApprovers(env.DB, repo)).length > 0) {
    fail(409, "This repository is already set up. Ask one of its admins for an invite");
  }
  return repo;
}

export function claimStatements(db: D1Database, user: User, repo: string): D1PreparedStatement[] {
  return [
    ensurePolicy(db, repo),
    upsertApprover(db, {
      repo_full_name: repo,
      github_user_id: user.id,
      login: user.login,
      role: "admin",
      added_by: null,
    }),
  ];
}
