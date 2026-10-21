import { GitHubError, githubFetch, githubJson } from "@/github/app";

type GitRef = { object: { type: string; sha: string } };
type WorkflowRun = { actor: { id: number } | null; triggering_actor: { id: number } | null };

const encodePath = (value: string): string => value.split("/").map(encodeURIComponent).join("/");

export function tagName(ref: string): string | null {
  if (ref.startsWith("refs/tags/")) return ref.slice("refs/tags/".length);
  // Deployments created by Actions carry the short ref name.
  return ref === "" || ref.startsWith("refs/") ? null : ref;
}

export async function tagCommit(token: string, repo: string, tag: string): Promise<string | null> {
  const response = await githubFetch(`/repos/${repo}/git/ref/tags/${encodePath(tag)}`, token);
  if (response.status === 404) return null;
  if (!response.ok) throw new GitHubError(`Tag lookup failed with HTTP ${response.status}`);
  let { object } = await response.json<GitRef>();
  while (object.type === "tag") {
    ({ object } = await githubJson<GitRef>(`/repos/${repo}/git/tags/${object.sha}`, token));
  }
  return object.sha;
}

export async function isOnBranch(
  token: string,
  repo: string,
  branch: string,
  sha: string,
): Promise<boolean> {
  const { status } = await githubJson<{ status: string }>(
    `/repos/${repo}/compare/${encodePath(branch)}...${sha}?per_page=1`,
    token,
  );
  return status === "identical" || status === "behind";
}

export async function runInitiators(token: string, repo: string, runId: number): Promise<number[]> {
  const run = await githubJson<WorkflowRun>(`/repos/${repo}/actions/runs/${runId}`, token);
  return [run.actor?.id, run.triggering_actor?.id].filter((id) => id !== undefined);
}

export async function previousTag(
  token: string,
  repo: string,
  tag: string,
): Promise<string | null> {
  const tags = await githubJson<{ name: string }[]>(`/repos/${repo}/tags?per_page=100`, token);
  const index = tags.findIndex((t) => t.name === tag);
  return index === -1 ? null : (tags[index + 1]?.name ?? null);
}
