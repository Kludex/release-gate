import githubAppJwt from "universal-github-app-jwt";
import type { Env } from "@/env";

const GITHUB_API = "https://api.github.com";

export class GitHubError extends Error {}

export async function githubFetch(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(path.startsWith("https://") ? path : `${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "release-gate",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
}

export async function githubJson<T>(path: string, token: string): Promise<T> {
  const response = await githubFetch(path, token);
  if (!response.ok) throw new GitHubError(`GET ${path} failed with HTTP ${response.status}`);
  return response.json<T>();
}

export async function installationToken(
  env: Env,
  installationId: number,
  repoFullName: string,
): Promise<string> {
  const { token: jwt } = await githubAppJwt({
    id: env.GITHUB_APP_ID,
    privateKey: env.GITHUB_APP_PRIVATE_KEY,
  });
  const response = await githubFetch(`/app/installations/${installationId}/access_tokens`, jwt, {
    method: "POST",
    body: JSON.stringify({ repositories: [repoFullName.split("/")[1]] }),
  });
  if (!response.ok) {
    throw new GitHubError(`Installation token request failed with HTTP ${response.status}`);
  }
  return (await response.json<{ token: string }>()).token;
}
