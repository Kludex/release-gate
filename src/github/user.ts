import { githubFetch } from "@/github/app";

type Repository = { full_name: string; permissions?: { admin: boolean } };

/** Repositories with the app installed where the user is a GitHub admin, read with their token. */
export async function installedAdminRepos(token: string): Promise<string[]> {
  // shortcut: reads the first 100 installations and 100 repositories each, paginate if users hit it.
  const response = await githubFetch("/user/installations?per_page=100", token);
  if (!response.ok) return [];
  const { installations } = await response.json<{ installations: { id: number }[] }>();
  const pages = await Promise.all(
    installations.map(async ({ id }) => {
      const page = await githubFetch(`/user/installations/${id}/repositories?per_page=100`, token);
      return page.ok ? (await page.json<{ repositories: Repository[] }>()).repositories : [];
    }),
  );
  return pages
    .flat()
    .filter((repo) => repo.permissions?.admin)
    .map((repo) => repo.full_name);
}
