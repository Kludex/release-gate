# Threat model

release-gate makes a release need two things: a tag push, and a fresh passkey assertion from an allowlisted approver.

## Protects against

| Threat | Why it fails |
| --- | --- |
| A stolen GitHub personal access token or OAuth token | The token can push a tag, but it can't answer a custom protection rule. Only the app can. The app needs a WebAuthn assertion, and a token can't register a passkey either: the first passkey needs an invite code or the setup of an unclaimed repository, and later ones need an existing passkey. |
| API-only approvals | Approving required reviewers through the REST API has no effect on the release-gate rule. |
| A malicious workflow change that keeps the environment | The job still pauses at the environment, and a human reviews the run and the diff before approving. |
| Releasing from a branch, a pull request or a commit outside the default branch | Auto-rejected: the deployment ref must be a tag that points to the deployed commit, and by default that commit must be on the default branch. |
| A maintainer approving their own release | `prevent_self_review` blocks the tag pusher, the run's actor and whoever re-ran it. |
| A replayed or redirected approval | Challenges are single-use, expire after 5 minutes, and are bound to one user, one request and one decision. The signature counter must not go backwards. |
| A forged webhook | `X-Hub-Signature-256` is verified with the webhook secret. The callback URL must be `api.github.com` for the same repository, so installation tokens are never sent anywhere else. |
| Cross-site requests | Every POST must carry `Origin: PUBLIC_ORIGIN`, session cookies are `SameSite=Strict`, and a strict CSP allows no inline scripts. |

## Does not protect against

| Threat | Mitigation |
| --- | --- |
| A repository admin removes the rule, edits the environment or enables admin bypass. The same token can also set up a repository nobody has set up yet. | Set up the repository right after installing the app. Manage environments as code, alert on audit log changes, and keep admin tokens off servers. |
| PyPI trusted publishing that isn't bound to the environment | Bind the trusted publisher to the environment name. Otherwise a workflow edit that drops `environment:` publishes without the gate. |
| A compromised Cloudflare account or a compromised deployment of this service | Either can approve requests. A release still needs a tag push. Protect the Cloudflare account with hardware keys. |
| The operator of a hosted instance | The operator holds the app's private key and can approve anything on repositories that installed it. Use an instance whose operator you trust, or self-host. |
| A compromised maintainer device together with its passkey | Use `min_approvals: 2` for high-value packages, and remove the device's passkey from `/passkeys` as soon as you know. |
| Private repositories on plans without custom protection rules | GitHub only offers custom deployment protection rules there on Enterprise. |
