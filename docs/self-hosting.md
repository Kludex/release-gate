# Self-hosting

release-gate runs on Cloudflare Workers with a D1 database. The free tier is enough.

You need:

- a Cloudflare account and `wrangler login`
- permission to create a GitHub App on the account that owns the repositories
- `openssl` and `pnpm`

## 1. Choose the domain first

Passkeys are bound to the hostname in `PUBLIC_ORIGIN`. If you change the domain later, every registered passkey stops
working, and every approver has to enroll again.

> [!WARNING]
> **Pick the final domain before onboarding approvers.** `https://release-gate.<account>.workers.dev` works. A custom
> domain needs a route in `wrangler.jsonc`.

## 2. Create the D1 database

```sh
pnpm install
pnpm exec wrangler d1 create release-gate
```

Copy the printed `database_id` into `wrangler.jsonc`, then apply the schema:

```sh
pnpm exec wrangler d1 migrations apply release-gate --remote
```

## 3. Configure `wrangler.jsonc`

| Variable | Example | Meaning |
| --- | --- | --- |
| `PUBLIC_ORIGIN` | `https://release-gate.acme.workers.dev` | The exact origin users visit. Requests for any other host get `421`. |
| `RP_NAME` | `release-gate` | The name authenticators show during registration. |
| `BOOTSTRAP_REPOS` | `acme/widgets,acme/gadgets` | Repositories whose admin is created by the bootstrap code. |

## 4. Create the GitHub App

Go to **Settings → Developer settings → GitHub Apps → New GitHub App** on the owning account.

| Field | Value |
| --- | --- |
| Homepage URL | `PUBLIC_ORIGIN` |
| Callback URL | `PUBLIC_ORIGIN/auth/callback` |
| Request user authorization (OAuth) during installation | off |
| Webhook URL | `PUBLIC_ORIGIN/webhook` |
| Webhook secret | `openssl rand -hex 32` |
| Repository permissions | Deployments: read and write; Actions: read; Contents: read; Metadata: read |
| Subscribe to events | Deployment protection rule |
| Where can this app be installed | Any account |

Then generate a private key. GitHub gives you PKCS#1, but WebCrypto needs PKCS#8:

```sh
openssl pkcs8 -topk8 -nocrypt -in release-gate.*.private-key.pem -out release-gate.pkcs8.pem
```

## 5. Set the secrets

```sh
pnpm exec wrangler secret put GITHUB_APP_ID
pnpm exec wrangler secret put GITHUB_APP_PRIVATE_KEY < release-gate.pkcs8.pem
pnpm exec wrangler secret put GITHUB_WEBHOOK_SECRET
pnpm exec wrangler secret put GITHUB_CLIENT_ID
pnpm exec wrangler secret put GITHUB_CLIENT_SECRET
openssl rand -hex 32 | pnpm exec wrangler secret put SESSION_SECRET
openssl rand -hex 32 | tee /dev/tty | pnpm exec wrangler secret put BOOTSTRAP_CODE
```

Keep the printed bootstrap code for step 7, then delete the `.pem` files.

## 6. Deploy

```sh
pnpm run deploy
```

Deploys are manual. CI never holds Cloudflare credentials.

## 7. Bootstrap the first admin

1. Open `PUBLIC_ORIGIN` and sign in with GitHub.
2. Go to `PUBLIC_ORIGIN/bootstrap`, enter the bootstrap code and register a passkey.

You become `admin` of every repository in `BOOTSTRAP_REPOS`. The code works once. Its hash is stored in D1.

## 8. Protect an environment

1. Install the app on the repository.
2. Open **Settings → Environments → your environment**.
3. Under **Deployment protection rules**, enable release-gate.
4. Turn off **Allow administrators to bypass configured protection rules**.

A repository that isn't in release-gate's policy table gets every deployment rejected.

## Adding approvers

1. As an admin, open `PUBLIC_ORIGIN/admin/<owner>/<repo>`, enter the approver's GitHub login and confirm with your
   passkey.
2. Send them the one-time code over a separate channel. It is shown once, stored hashed and valid for 24 hours.
3. They sign in with GitHub, open `PUBLIC_ORIGIN/invite`, enter the code and register their first passkey.

To add another passkey, an approver opens `/passkeys` and confirms with an existing one first.

## Removing access

- **A lost or stolen device:** open `/passkeys` from another device and remove its passkey. You confirm with any of
  your other passkeys. Your last passkey can't be removed, so add a replacement first.
- **An approver who leaves:** an admin removes them on the repository's admin page. A repository always keeps at
  least one admin, so promote someone else before the last admin steps down. Invites never demote an admin.

## Stuck callbacks

If GitHub can't be reached, the request ends in `error`. If the worker dies while sending the decision, the request
stays in `delivering`. In both cases an admin can confirm with a passkey and send the stored decision again, right
away for `error` and after 5 minutes for `delivering`.

## Recovery

If every passkey is lost, rotate the bootstrap code:

```sh
openssl rand -hex 32 | tee /dev/tty | pnpm exec wrangler secret put BOOTSTRAP_CODE
```

Then bootstrap again. This needs access to the Cloudflare account, which is the root of trust for this service.
