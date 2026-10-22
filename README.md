# release-gate

A GitHub App that holds a release until a maintainer approves it with a passkey.

```yaml
# .github/workflows/publish.yml
jobs:
  pypi-publish:
    runs-on: ubuntu-latest
    environment: pypi # release-gate is a protection rule on this environment
    permissions:
      id-token: write
    steps:
      - uses: pypa/gh-action-pypi-publish@release/v1
```

When the job reaches the `pypi` environment, GitHub pauses it and asks release-gate. release-gate approves only after an
approver for that repository signs in with GitHub and passes a WebAuthn check (passkey or security key, user
verification required) on its web page.

## Why

On October 21, 2026, LiteLLM 1.107.0 reached PyPI and Docker Hub with a credential stealer inside. Their release
workflow had a required approval, and the attacker passed it with a stolen maintainer token. See
[LiteLLM's incident report](https://docs.litellm.ai/blog/security-incident-oct-21-2026).

GitHub's "required reviewers" can be approved through the REST API with any token that has `repo` scope. That approval
never asks for 2FA, sudo mode or a passkey. A stolen token can push a tag and approve its own release.

A custom deployment protection rule can only be answered by the app that owns it. release-gate answers only after a
fresh passkey assertion, so a stolen token alone can't release.

## How it works

1. A tag push starts a workflow. The job with `environment: pypi` pauses, and GitHub sends a
   `deployment_protection_rule` webhook.
2. release-gate verifies the webhook signature and validates the callback URL. Then it checks the policy:
   - The deployment ref must be a tag that points to the deployed commit.
   - If the policy requires it, the commit must be on the default branch.
   - Anything else is rejected right away, with a comment that explains why.
3. An approver opens release-gate, signs in with GitHub and reviews the tag, the commit, the workflow run and the diff
   from the previous tag.
4. The approver clicks **Approve** or **Reject**, and the browser runs a WebAuthn ceremony. The challenge is single-use,
   expires after 5 minutes, and is bound to that user, that request and that decision.
5. Once `min_approvals` distinct approvers approve, or anyone rejects, release-gate posts the decision to GitHub.

GitHub sign-in only identifies the user. The passkey is the second factor.

## Policy

Each repository has a policy that admins edit in the UI. Every change requires a passkey.

| Setting | Default | Meaning |
| --- | --- | --- |
| `min_approvals` | `1` | Distinct approvers needed before the job is released. |
| `prevent_self_review` | on | Whoever started the deployment can't approve it: the tag pusher, the run's `actor` and its `triggering_actor` (re-runs). They can still reject. |
| `require_default_branch` | on | The tagged commit must be on the default branch. |
| `notify_url` | none | A Slack or Discord incoming webhook. It gets a message when a release waits for approval, when a decision reaches GitHub or fails to, and when the policy or the approvers change. |

A release you didn't start waiting for approval is the first sign of a stolen token, so set up notifications in a
channel your maintainers read.

Approvers are an explicit allowlist per repository. GitHub permissions are used once: the first admin of a repository
must be one of its admins on GitHub, who could remove the protection rule anyway. After that, a repository grows only by
invites, because a token holder could change GitHub permissions.

## Getting started

1. Install the app on your repository. The hosted instance is
   [secure-release-gate](https://github.com/apps/secure-release-gate), or [host your own](docs/self-hosting.md).
2. Open the instance, sign in with GitHub, and pick the repository under **Set up a repository**. You register your first passkey
   and become its admin.
3. Under **Settings → Environments**, enable the app as a deployment protection rule on the release environment.

> [!WARNING]
> Whoever operates an instance can approve releases for every repository that installed its app. Use the hosted
> instance only if you trust its operator. Otherwise, self-host.

## Documentation

- [Self-hosting](docs/self-hosting.md): create the GitHub App, deploy to Cloudflare, set up a repository.
- [Threat model](docs/threat-model.md): what release-gate protects against, and what it doesn't.
- [Rollout checklist](docs/rollout.md): the sandbox test and the Starlette rollout.
- [Security policy](SECURITY.md)

## Development

```sh
pnpm install
pnpm build              # Tailwind CSS and the WebAuthn client into public/
pnpm check              # biome, tsc, vitest with 100% coverage
cp .dev.vars.example .dev.vars
pnpm exec wrangler d1 migrations apply release-gate --local
pnpm dev
```

The tests run inside `workerd` with `@cloudflare/vitest-plugin`. They use a fake GitHub API behind `fetch` and a
software authenticator that produces real ES256 WebAuthn responses.

## License

[MIT](LICENSE)
