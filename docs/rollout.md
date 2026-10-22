# Rollout checklist

These steps need the owner's accounts, so they are done by hand.

## 1. Sandbox repository

- [ ] Create the public repository `Kludex/release-gate-sandbox` with an environment named `gated`.
- [ ] Add this workflow as `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags: ["*"]

permissions: {}

jobs:
  release:
    runs-on: ubuntu-latest
    environment: gated
    steps:
      - run: echo released
```

## 2. Cloudflare

- [ ] `wrangler login`
- [ ] Choose the final domain and set `PUBLIC_ORIGIN` in `wrangler.jsonc`. Changing it later invalidates every passkey.
- [ ] `wrangler d1 create release-gate`, then copy the id into `wrangler.jsonc`.
- [ ] `wrangler d1 migrations apply release-gate --remote`
- [ ] Set the secrets from [self-hosting](self-hosting.md#5-set-the-secrets).
- [ ] `pnpm run deploy`

## 3. GitHub App

- [ ] Create the app with the settings in [self-hosting](self-hosting.md#4-create-the-github-app).
- [ ] Install it on `Kludex/release-gate-sandbox` only.
- [ ] In the sandbox, open **Settings → Environments → `gated`** and enable release-gate under **Deployment
      protection rules**.
- [ ] Open `PUBLIC_ORIGIN`, sign in, and set up the repository on the home page.

## 4. Sandbox tests

- [x] Push `v0.0.1`. The job waits, and the request shows up in release-gate. Approve it with your passkey, and the job
      prints `released`.
- [x] Push `v0.0.2` and reject it. The job fails a few minutes later. GitHub shows **Waiting** until then.
- [x] Run the workflow from a branch, for example by temporarily adding `workflow_dispatch` and starting it on `main`.
      It is auto-rejected with "is not a tag".
- [x] Push `v0.0.3`, then try to approve it with a PAT. GitHub answers "No pending deployment requests to approve":
      `gh api -X POST repos/Kludex/release-gate-sandbox/actions/runs/<run_id>/pending_deployments -f state=approved -F 'environment_ids[]=<id>' -f comment=x`
- [ ] Invite a second account, set `min_approvals` to 2, and check that the callback fires only after the second
      approval.
- [x] Check that the deployment's `ref` really is the tag. GitHub sends `v0.0.1`.

## 5. Starlette

- [ ] Install the app on `Kludex/starlette`.
- [ ] Set up `Kludex/starlette` on the home page right away.
- [ ] In **Settings → Environments → `pypi`**, enable release-gate. Keep the existing required reviewer for the first
      release.
- [ ] Turn off **Allow administrators to bypass configured protection rules**.
- [ ] Release once with both gates, then decide whether to remove the required reviewer.

## 6. PyPI

- [ ] On PyPI, check that Starlette's trusted publisher names the environment `pypi`. Without it, a workflow edit
      that drops `environment:` can publish without the gate.
